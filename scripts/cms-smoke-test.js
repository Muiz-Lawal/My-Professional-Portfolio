import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'portfolio-cms-'))
const port = 5059
const server = spawn(process.execPath, ['server/contact-server.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', ADMIN_TOKEN: 'automated-smoke-token', DATA_DIR: temporaryDirectory, CORS_ORIGINS: 'http://127.0.0.1:4317' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverError = ''
server.stderr.on('data', (chunk) => { serverError += chunk.toString() })

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`)
    if (response.ok) break
  } catch {}
  if (server.exitCode !== null) throw new Error(`CMS server exited before startup: ${serverError}`)
  await delay(100)
}

try {
  const base = `http://127.0.0.1:${port}`
  const unauthorized = await fetch(`${base}/api/admin/dashboard`)
  if (unauthorized.status !== 401) throw new Error('Unauthorized dashboard access was accepted')

  const headers = { Authorization: 'Bearer automated-smoke-token', 'Content-Type': 'application/json' }
  const create = await fetch(`${base}/api/admin/entities/skills`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Automated Skill', description: 'Test record', status: 'published', position: 1 }),
  })
  if (create.status !== 201) throw new Error(`Entity create failed: ${create.status}`)
  const entity = await create.json()

  const publicResponse = await fetch(`${base}/api/public/entities/skills`)
  const publicEntities = await publicResponse.json()
  if (!publicEntities.some((item) => item.id === entity.id)) throw new Error('Published entity was not public')

  const remove = await fetch(`${base}/api/admin/entities/skills/${entity.id}`, { method: 'DELETE', headers })
  if (remove.status !== 204) throw new Error(`Entity delete failed: ${remove.status}`)

  const dashboard = await fetch(`${base}/api/admin/dashboard`, { headers })
  const dashboardJson = await dashboard.json()
  if (dashboardJson.health?.database !== 'operational') throw new Error('Database health check failed')

  console.log('CMS smoke tests passed.')
} finally {
  server.kill()
  await new Promise((resolve) => server.once('exit', resolve))
  await delay(100)
  await rm(temporaryDirectory, { recursive: true, force: true })
}
