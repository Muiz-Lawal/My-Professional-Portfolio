import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { randomBytes, scryptSync } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { generateSync } from 'otplib'

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'portfolio-admin-'))
const port = 5067
const adminToken = 'admin-feature-test-token'
const adminEmail = 'admin-feature@example.test'
const password = 'Admin-feature-test-password!'
const salt = randomBytes(16)
const passwordHash = `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`
const server = spawn(process.execPath, ['server/contact-server.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    DATA_DIR: temporaryDirectory,
    ADMIN_TOKEN: adminToken,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD_HASH: passwordHash,
    CORS_ORIGINS: 'http://127.0.0.1:4317',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverOutput = ''
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString() })
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString() })
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const base = `http://127.0.0.1:${port}`
let ready = false

try {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`)
      if (response.ok) {
        ready = true
        break
      }
    } catch {}
    if (server.exitCode !== null) throw new Error(`Admin test server exited before startup: ${serverOutput}`)
    await delay(100)
  }
  assert.equal(ready, true, `Admin test server did not start: ${serverOutput}`)

  const api = async (endpoint, { method = 'GET', body, headers = {} } = {}) => {
    const requestHeaders = { Authorization: `Bearer ${adminToken}`, ...headers }
    let requestBody = body
    if (body !== undefined && !(body instanceof FormData)) {
      requestHeaders['Content-Type'] = 'application/json'
      requestBody = JSON.stringify(body)
    }
    return fetch(`${base}${endpoint}`, { method, headers: requestHeaders, body: requestBody })
  }
  const json = async (response) => response.json()

  assert.equal((await fetch(`${base}/api/admin/security/mfa/status`)).status, 401, 'MFA settings must require admin authentication')
  assert.deepEqual(await json(await api('/api/admin/security/mfa/status')), { enabled: false })

  const secretResponse = await api('/api/admin/security/mfa/setup', { method: 'POST' })
  assert.equal(secretResponse.status, 200)
  const { secret } = await json(secretResponse)
  const mfaCode = generateSync({ secret })
  const enabled = await api('/api/admin/security/mfa/enable', { method: 'POST', body: { secret, code: mfaCode } })
  assert.equal(enabled.status, 200)
  assert.deepEqual(await json(await api('/api/admin/security/mfa/status')), { enabled: true })
  const missingMfa = await fetch(`${base}/api/admin/session/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password }),
  })
  assert.equal(missingMfa.status, 401, 'Login must reject a missing MFA code when MFA is enabled')
  const validLogin = await fetch(`${base}/api/admin/session/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password, mfaCode: generateSync({ secret }) }),
  })
  assert.equal(validLogin.status, 200, 'Valid password and TOTP must sign in')

  const uploadMedia = async (name, value, folder = '') => {
    const form = new FormData()
    form.set('file', new Blob([value], { type: 'application/pdf' }), name)
    form.set('folder', folder)
    form.set('altText', `${name} alternative text`)
    return api('/api/admin/media', { method: 'POST', body: form })
  }

  const uploadResponse = await uploadMedia('case-study.pdf', 'original media')
  assert.equal(uploadResponse.status, 201)
  let media = await json(uploadResponse)
  assert.equal((await fetch(`${base}/api/media/${media.id}`)).status, 200)
  const privateMedia = await api(`/api/admin/media/${media.id}`, {
    method: 'PATCH',
    body: { folder: 'private', original_name: 'private-case-study.pdf', alt_text: 'Private document' },
  })
  assert.equal(privateMedia.status, 200)
  assert.equal((await fetch(`${base}/api/media/${media.id}`)).status, 404, 'Private media must not be public')
  const publicMedia = await api(`/api/admin/media/${media.id}`, {
    method: 'PATCH',
    body: { folder: 'portfolio', original_name: 'renamed-case-study.pdf', alt_text: 'Public case study' },
  })
  assert.equal((await json(publicMedia)).original_name, 'renamed-case-study.pdf')
  const replacement = new FormData()
  replacement.set('file', new Blob(['replacement media'], { type: 'application/pdf' }), 'replacement.pdf')
  const replaced = await api(`/api/admin/media/${media.id}/replace`, { method: 'PUT', body: replacement })
  assert.equal(replaced.status, 200)
  media = await json(replaced)
  assert.equal(media.original_name, 'replacement.pdf')
  assert.equal(await (await fetch(`${base}/api/media/${media.id}`)).text(), 'replacement media')
  const disposableResponse = await uploadMedia('disposable.pdf', 'delete me')
  const disposable = await json(disposableResponse)
  assert.equal((await api(`/api/admin/media/${disposable.id}`, { method: 'DELETE' })).status, 204)
  assert.equal((await fetch(`${base}/api/media/${disposable.id}`)).status, 404, 'Deleted media must stop serving')

  const blocks = [
    { type: 'hero', content: JSON.stringify({ title: 'Block hero', description: 'Intro', primaryLabel: 'Start', primaryHref: '/about' }) },
    { type: 'text', content: '## Markdown\\n\\nReadable copy.' },
    { type: 'image', content: JSON.stringify({ imageUrl: `/api/media/${media.id}`, altText: 'Case study' }) },
    { type: 'gallery', content: JSON.stringify({ images: [`/api/media/${media.id}|Case study`] }) },
    { type: 'video', content: JSON.stringify({ videoUrl: `/api/media/${media.id}`, caption: 'Demo' }) },
    { type: 'projects', content: JSON.stringify({ heading: 'Selected projects', slugs: ['calculator'] }) },
    { type: 'statistics', content: JSON.stringify({ entries: [{ value: '4', label: 'Projects' }] }) },
    { type: 'timeline', content: JSON.stringify({ entries: [{ date: '2026', title: 'Built', description: 'Details' }] }) },
    { type: 'testimonials', content: JSON.stringify({ entries: [{ quote: 'Good work', name: 'Reviewer', role: 'Engineer' }] }) },
    { type: 'cards', content: JSON.stringify({ entries: [{ title: 'Card', description: 'Details', href: '/about' }] }) },
    { type: 'cta', content: JSON.stringify({ heading: 'Get in touch', description: 'Contact me', label: 'Contact', href: '/#contact' }) },
    { type: 'download', content: JSON.stringify({ label: 'Download', href: `/api/media/${media.id}` }) },
    { type: 'buttons', content: JSON.stringify({ entries: [{ label: 'Open', href: '/about' }] }) },
    { type: 'code', content: JSON.stringify({ language: 'js', code: 'console.log("hello")' }) },
    { type: 'faq', content: JSON.stringify({ entries: [{ question: 'Why?', answer: 'Because.' }] }) },
    { type: 'contact', content: JSON.stringify({ heading: 'Contact', email: 'admin@example.test' }) },
  ]
  const pagePayload = {
    slug: 'admin-feature-case-study',
    type: 'project',
    title: 'Admin Feature Case Study',
    description: 'Verifying the page block editors.',
    content: 'Page overview.',
    status: 'published',
    visibility: 'public',
    inNavigation: false,
    template: 'project',
    seoTitle: '',
    seoDescription: '',
    category: 'Test',
    tags: [],
    featured: false,
    repositoryUrl: '',
    liveUrl: '',
    mediaUrls: [],
    problem: '',
    objectives: '',
    role: '',
    implementation: '',
    challenges: '',
    outcomes: '',
    relatedSlugs: [],
    blocks,
    publishedAt: '',
    scheduledAt: '',
  }
  const createdPage = await api('/api/admin/content/pages', { method: 'POST', body: pagePayload })
  assert.equal(createdPage.status, 201, 'All supported page block types must pass content validation')
  const page = await json(createdPage)
  const publicPageResponse = await fetch(`${base}/api/content/pages/${page.slug}`)
  assert.equal(publicPageResponse.status, 200)
  assert.equal((await json(publicPageResponse)).blocks.length, blocks.length)
  const invalidBlock = await api('/api/admin/content/pages', {
    method: 'POST',
    body: { ...pagePayload, slug: 'invalid-admin-feature-case-study', blocks: [{ type: 'unknown', content: 'bad' }] },
  })
  assert.equal(invalidBlock.status, 400, 'Unknown block types must be rejected')

  const skillResponse = await api('/api/admin/entities/skills', {
    method: 'POST',
    body: { title: 'Backup baseline', description: 'Before snapshot', status: 'published', position: 0 },
  })
  assert.equal(skillResponse.status, 201)
  const skill = await json(skillResponse)

  const backupResponse = await api('/api/admin/backup/create', { method: 'POST' })
  assert.equal(backupResponse.status, 201)
  const backup = await json(backupResponse)
  assert.equal(backup.restorable, true)
  assert.ok(backup.size > 0)
  const databaseDownload = await api(`/api/admin/backup/${backup.name}/download/portfolio.sqlite`)
  assert.equal(databaseDownload.status, 200)
  const contentDownload = await api(`/api/admin/backup/${backup.name}/download/portfolio-content.json`)
  assert.equal(contentDownload.status, 200)
  const fullArchive = await api(`/api/admin/backup/${backup.name}/download`)
  assert.equal(fullArchive.status, 200)
  assert.match(fullArchive.headers.get('content-type'), /application\/gzip/)
  const archiveBytes = gunzipSync(Buffer.from(await fullArchive.arrayBuffer()))
  const archiveContents = archiveBytes.toString('utf8')
  const archivePaths = []
  let archiveOffset = 0
  while (archiveOffset + 512 <= archiveBytes.length && archiveBytes.subarray(archiveOffset, archiveOffset + 512).some((byte) => byte !== 0)) {
    const header = archiveBytes.subarray(archiveOffset, archiveOffset + 512)
    const expectedChecksum = Number.parseInt(header.toString('ascii', 148, 156).replace(/\0/g, '').trim(), 8)
    const checksumHeader = Buffer.from(header)
    checksumHeader.fill(0x20, 148, 156)
    assert.equal(checksumHeader.reduce((sum, byte) => sum + byte, 0), expectedChecksum, 'Archive entries must have valid tar checksums')
    archivePaths.push(header.toString('utf8', 0, 100).replace(/\0.*$/s, ''))
    const size = Number.parseInt(header.toString('ascii', 124, 136).replace(/\0/g, '').trim(), 8)
    archiveOffset += 512 + Math.ceil(size / 512) * 512
  }
  assert.ok(archivePaths.includes('portfolio.sqlite'))
  assert.ok(archivePaths.includes('portfolio-content.json'))
  assert.ok(archivePaths.includes(`media/${media.name}`), 'Full archive must contain uploaded media')
  assert.equal(archiveContents.includes(secret), false, 'Downloadable backups must exclude authenticator secrets')

  const changedSkill = await api(`/api/admin/entities/skills/${skill.id}`, {
    method: 'PUT',
    body: { title: 'Changed after backup', description: 'Changed', status: 'published', position: 0 },
  })
  assert.equal(changedSkill.status, 200)
  const changedPage = await api(`/api/admin/content/pages/${page.id}`, {
    method: 'PUT',
    body: { ...pagePayload, description: 'Changed after backup.' },
  })
  assert.equal(changedPage.status, 200)
  const extraMediaResponse = await uploadMedia('post-backup.pdf', 'media after backup')
  assert.equal(extraMediaResponse.status, 201)
  const extraMedia = await json(extraMediaResponse)

  assert.equal((await api('/api/admin/backup/missing-backup/restore', { method: 'POST' })).status, 404)
  const restored = await api(`/api/admin/backup/${backup.name}/restore`, { method: 'POST' })
  assert.equal(restored.status, 200, `Backup restore failed: ${await restored.clone().text()}`)
  const restoreResult = await json(restored)
  assert.ok(restoreResult.safetyBackup)
  const restoredSkills = await json(await api('/api/admin/entities/skills'))
  assert.equal(restoredSkills.find((item) => item.id === skill.id).title, 'Backup baseline')
  const restoredPage = await json(await fetch(`${base}/api/content/pages/${page.slug}`))
  assert.equal(restoredPage.description, pagePayload.description)
  assert.equal((await fetch(`${base}/api/media/${media.id}`)).status, 200, 'Restored media must be available')
  assert.equal((await fetch(`${base}/api/media/${extraMedia.id}`)).status, 404, 'Post-backup media must be removed by restore')
  assert.deepEqual(await json(await api('/api/admin/security/mfa/status')), { enabled: true }, 'Restore must preserve the current MFA configuration')

  const history = await json(await api('/api/admin/backup/history'))
  assert.ok(history.some((entry) => entry.name === backup.name && entry.restorable))
  assert.ok(history.some((entry) => entry.name === restoreResult.safetyBackup && entry.restorable))
  const exported = await api('/api/admin/backup/export')
  const exportText = await exported.text()
  assert.equal(exported.status, 200)
  assert.equal(exportText.includes(secret), false, 'JSON exports must not disclose MFA setup secrets')

  assert.equal((await api('/api/admin/security/mfa/disable', { method: 'POST' })).status, 200)
  assert.deepEqual(await json(await api('/api/admin/security/mfa/status')), { enabled: false })
  console.log('Admin feature tests passed (MFA, media, blocks, and full backup/restore).')
} finally {
  if (server.exitCode === null) {
    server.kill()
    await new Promise((resolve) => server.once('exit', resolve))
  }
  await rm(temporaryDirectory, { recursive: true, force: true })
}
