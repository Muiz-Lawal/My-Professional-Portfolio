import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createReadStream, mkdirSync, existsSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { backup as sqliteBackup, DatabaseSync } from 'node:sqlite'
import { randomBytes, scryptSync } from 'node:crypto'
import { generateSecret, generateURI, verifySync } from 'otplib'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import sharp from 'sharp'

const app = express()
const port = Number(process.env.PORT || 5057)
const dataDirectory = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'))
const contentFile = path.join(dataDirectory, 'portfolio-content.json')
const databaseFile = path.join(dataDirectory, 'portfolio.sqlite')
const mediaDirectory = path.join(dataDirectory, 'media')

mkdirSync(dataDirectory, { recursive: true })
mkdirSync(mediaDirectory, { recursive: true })
let database = new DatabaseSync(databaseFile)
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('super_admin','editor','viewer')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('unread','read','archived')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS navigation_items (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    href TEXT NOT NULL,
    position INTEGER NOT NULL,
    menu TEXT NOT NULL,
    desktop_visible INTEGER NOT NULL,
    mobile_visible INTEGER NOT NULL,
    external INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    alt_text TEXT NOT NULL DEFAULT '',
    folder TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS content_revisions (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS portfolio_entities (
    id TEXT PRIMARY KEY,
    collection TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published',
    position INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS redirects (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL UNIQUE,
    destination TEXT NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 301,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS integrations (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    configuration TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unconfigured',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    path TEXT NOT NULL,
    metadata TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_attempts (
    id TEXT PRIMARY KEY,
    identity TEXT NOT NULL,
    success INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`)
try { database.exec("ALTER TABLE navigation_items ADD COLUMN parent_id TEXT") } catch {}

const defaultSections = [
  { id: 'home', title: 'Building technology that thinks, adapts and protects.', description: 'I’m Muiz Lawal, a Computer Science student and software developer interested in artificial intelligence, cybersecurity and engineering impactful technology.', visible: true, order: 0, inNavigation: true, imageUrl: '', ctaLabel: 'Explore my work', ctaHref: '#projects' },
  { id: 'about', title: 'Curious mind. Engineering purpose.', description: 'I’m developing a deep foundation in computing while turning ideas into working software.', visible: true, order: 1, inNavigation: true, imageUrl: '', ctaLabel: 'Read more about me', ctaHref: '/about' },
  { id: 'expertise', title: 'How I work.', description: 'I combine practical software development with an interest in understanding systems beneath the surface.', visible: true, order: 2, inNavigation: true, imageUrl: '', ctaLabel: '', ctaHref: '' },
  { id: 'projects', title: 'Projects built with intent.', description: 'A selection of practical work and experiments.', visible: true, order: 3, inNavigation: true, imageUrl: '', ctaLabel: 'View all projects', ctaHref: '/projects' },
  { id: 'experience', title: 'Learning through building together.', description: 'My practical experience comes through coursework, independent projects, educational initiatives and collaborative technical activities.', visible: true, order: 4, inNavigation: true, imageUrl: '', ctaLabel: '', ctaHref: '' },
  { id: 'education', title: 'Obafemi Awolowo University', description: 'Building foundations in Computer Science.', visible: true, order: 5, inNavigation: true, imageUrl: '', ctaLabel: '', ctaHref: '' },
  { id: 'contact', title: 'Have an interesting problem to solve?', description: 'Let’s build something.', visible: true, order: 6, inNavigation: true, imageUrl: '', ctaLabel: 'Send a message', ctaHref: '#contact' },
]

const initialPages = [
  {
    id: '36a67f3a-3e21-4f4d-8a08-03bde8914c00',
    slug: 'about',
    type: 'page',
    title: 'About Muiz Lawal',
    description: 'I’m developing a deep foundation in computing while turning ideas into working software.',
    content: 'I study Computer Science at Obafemi Awolowo University, building my understanding of algorithms, systems, mathematics and software engineering. Outside the classroom, I explore Linux, Android development, artificial intelligence and cybersecurity. My direction is to become a Secure AI Systems Engineer.',
    status: 'published',
    visibility: 'public',
    inNavigation: false,
    template: 'default',
    seoTitle: 'About Muiz Lawal | Software Developer',
    seoDescription: 'Learn about Muiz Lawal’s Computer Science studies, software engineering interests and direction toward secure AI systems.',
    category: 'About',
    tags: ['Computer Science', 'Software Engineering', 'Secure AI'],
    featured: false,
    repositoryUrl: '',
    liveUrl: '',
    mediaUrls: [],
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    publishedAt: '',
  },
  {
    id: '36a67f3a-3e21-4f4d-8a08-03bde8914c01',
    slug: 'calculator',
    type: 'project',
    title: 'Scientific Calculator',
    description: 'A Kotlin Android scientific calculator developed for university coursework, including scientific expressions, matrix tools, statistics and calculation history.',
    content: 'A mobile scientific calculator developed as coursework. The Android application separates calculator, matrix and statistics workflows into Kotlin activities and XML layouts. Calculation history is stored with SharedPreferences, and exp4j evaluates expressions.',
    status: 'published',
    visibility: 'public',
    inNavigation: false,
    template: 'project',
    seoTitle: 'Scientific Calculator | Muiz Lawal Projects',
    seoDescription: 'A Kotlin Android scientific calculator coursework project by Muiz Lawal.',
    category: 'Android',
    tags: ['Kotlin', 'Android', 'exp4j'],
    featured: true,
    repositoryUrl: 'https://github.com/Muiz-Lawal/SEN104-Basic-Scientific-Calculator',
    liveUrl: '',
    mediaUrls: [],
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    publishedAt: '2026-11-23',
  },
  {
    id: '36a67f3a-3e21-4f4d-8a08-03bde8914c02',
    slug: 'educational-platform',
    type: 'project',
    title: 'Educational Platform',
    description: 'A learning platform direction exploring class management, student access and secure delivery of online education.',
    content: 'Product concept only. Implementation details and shipped features have not been verified.',
    status: 'draft',
    visibility: 'private',
    inNavigation: false,
    template: 'project',
    seoTitle: '',
    seoDescription: '',
    category: 'Education',
    tags: ['Product', 'Learning'],
    featured: false,
    repositoryUrl: '',
    liveUrl: '',
    mediaUrls: [],
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    publishedAt: '',
  },
  {
    id: '36a67f3a-3e21-4f4d-8a08-03bde8914c03',
    slug: 'secure-learning',
    type: 'project',
    title: 'Secure Learning Concept',
    description: 'A proposed secure paid-learning platform with controlled access, subscriptions, meeting integration and AI-generated transcripts.',
    content: 'Product concept only. The suggested feature set is not presented as implemented.',
    status: 'draft',
    visibility: 'private',
    inNavigation: false,
    template: 'project',
    seoTitle: '',
    seoDescription: '',
    category: 'Education',
    tags: ['Security', 'Payments', 'AI'],
    featured: false,
    repositoryUrl: '',
    liveUrl: '',
    mediaUrls: [],
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    publishedAt: '',
  },
  ...[
    ['linux-processes', 'How Linux processes see the world', 'Linux internals', 'A grounded introduction to processes, files, permissions and the mental models behind operating systems.'],
    ['secure-software-habits', 'Building secure software habits', 'Application security', 'Practical application-security principles that can become part of the everyday engineering workflow.'],
    ['personal-programming-language', 'Designing a personal programming language', 'Programming languages', 'From the first grammar and parser to interpreter decisions, semantics and a sustainable implementation path.'],
  ].map(([slug, title, category, description], index) => ({
    id: `36a67f3a-3e21-4f4d-8a08-03bde8914c0${4 + index}`,
    slug,
    type: 'article',
    title,
    description,
    content: 'This writing topic is planned and has not been published.',
    status: 'draft',
    visibility: 'private',
    inNavigation: false,
    template: 'article',
    seoTitle: '',
    seoDescription: '',
    category,
    tags: [],
    featured: false,
    repositoryUrl: '',
    liveUrl: '',
    mediaUrls: [],
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    publishedAt: '',
  })),
]

const safeHttpsUrl = z.string().url().refine((value) => /^https:\/\//i.test(value))

const pageSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: z.enum(['page', 'project', 'article']),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300),
  content: z.string().max(100000),
  status: z.enum(['draft', 'review', 'published', 'scheduled', 'archived']),
  visibility: z.enum(['public', 'private']),
  inNavigation: z.boolean(),
  template: z.enum(['default', 'project', 'article']),
  seoTitle: z.string().trim().max(160),
  seoDescription: z.string().trim().max(300),
  category: z.string().trim().max(80),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  featured: z.boolean(),
  repositoryUrl: safeHttpsUrl.or(z.literal('')),
  liveUrl: safeHttpsUrl.or(z.literal('')),
  mediaUrls: z.array(safeHttpsUrl).max(20),
  problem: z.string().max(5000).optional().default(''),
  objectives: z.string().max(5000).optional().default(''),
  role: z.string().max(3000).optional().default(''),
  implementation: z.string().max(10000).optional().default(''),
  challenges: z.string().max(5000).optional().default(''),
  outcomes: z.string().max(5000).optional().default(''),
  relatedSlugs: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(10).optional().default([]),
  blocks: z.array(z.object({
    type: z.enum(['hero','text','image','gallery','video','projects','statistics','timeline','testimonials','cards','cta','download','buttons','code','faq','contact']),
    content: z.string().max(100000),
  })).max(100).optional().default([]),
  publishedAt: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
  scheduledAt: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}T.*Z$/).optional().default(''),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  showInProjects: z.boolean().optional(),
  showInWriting: z.boolean().optional(),
}).strict()

const sectionSchema = z.object({
  id: z.enum(['home', 'about', 'expertise', 'projects', 'experience', 'education', 'contact']),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(500),
  visible: z.boolean(),
  order: z.number().int().min(0).max(100),
  inNavigation: z.boolean(),
  imageUrl: z.string().max(2000).refine((value) => !value || value.startsWith('/') && !value.startsWith('//') || /^https:\/\//i.test(value)),
  ctaLabel: z.string().max(80),
  ctaHref: z.string().max(500).refine((value) => !value || value.startsWith('#') || value.startsWith('/') && !value.startsWith('//') || /^https:\/\//i.test(value) || /^mailto:/i.test(value)),
})

app.disable('x-powered-by')
app.use(helmet())
const corsOrigins = (process.env.CORS_ORIGINS || 'http://127.0.0.1:4317,http://localhost:4317,http://127.0.0.1:4318,http://localhost:4318').split(',').map((origin) => origin.trim())
app.use(cors({ origin: corsOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(express.json({ limit: '128kb' }))

let writeQueue = Promise.resolve()

async function readContent() {
  try {
    const stored = JSON.parse(await readFile(contentFile, 'utf8'))
    let changed = false
    for (const page of stored.pages || []) {
      if (page.status === 'scheduled' && page.scheduledAt && new Date(page.scheduledAt).getTime() <= Date.now()) {
        page.status = 'published'
        page.publishedAt = page.publishedAt || new Date().toISOString().slice(0, 10)
        changed = true
      }
    }
    if (changed) await saveContent({ pages: stored.pages, sections: stored.sections || defaultSections })
    return {
      pages: Array.isArray(stored.pages) ? stored.pages : initialPages,
      sections: Array.isArray(stored.sections) ? stored.sections : defaultSections,
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return { pages: initialPages, sections: defaultSections }
  }
}

function saveContent(content) {
  const task = writeQueue.then(async () => {
    await mkdir(dataDirectory, { recursive: true })
    const temporaryFile = `${contentFile}.${randomUUID()}.tmp`
    await writeFile(temporaryFile, JSON.stringify(content, null, 2), 'utf8')
    await rename(temporaryFile, contentFile)
  })
  writeQueue = task.catch(() => {})
  return task
}

function requireAdmin(request, response, next) {
  const expected = process.env.ADMIN_TOKEN
  const cookieHeader = request.get('cookie') || ''
  const cookies = Object.fromEntries(cookieHeader.split(';').map((part) => {
    const index = part.indexOf('=')
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]
  }).filter(([key]) => key))
  const authorization = request.get('authorization') || ''
  const provided = cookies.admin_session || (authorization.startsWith('Bearer ') ? authorization.slice(7) : '')

  if (provided) {
    const session = database.prepare('SELECT s.*, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?').get(provided)
    if (session && new Date(session.expires_at).getTime() > Date.now()) {
      request.adminUser = { id: session.user_id, email: session.email, role: session.role }
      return next()
    }
  }

  if (expected) {
    const providedHash = createHash('sha256').update(provided).digest()
    const expectedHash = createHash('sha256').update(expected).digest()
    if (provided && timingSafeEqual(expectedHash, providedHash)) {
      request.adminUser = { id: 'legacy-admin', email: process.env.ADMIN_EMAIL || 'owner@localhost', role: 'super_admin' }
      return next()
    }
  }

  if (!expected && !process.env.ADMIN_PASSWORD_HASH) return response.status(503).json({ error: 'Admin access is not configured on this server.' })
  return response.status(401).json({ error: 'Authentication required.' })
}

const contactLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many messages. Please try again later.' },
})

const adminLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Try again later.' },
})
app.use('/api/admin', adminLimit)

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(20).max(3000),
  website: z.string().max(0).optional(),
})

function verifyPassword(password, storedHash) {
  if (!storedHash) return false
  const [scheme, saltHex, hashHex] = storedHash.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  try {
    const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), 64)
    const actual = Buffer.from(hashHex, 'hex')
    return actual.length === derived.length && timingSafeEqual(actual, derived)
  } catch {
    return false
  }
}

function recordAudit(action, actor, details) {
  database.prepare('INSERT INTO audit_logs (id, action, actor, details, created_at) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), action, actor, details, new Date().toISOString())
}

const backupDirectory = path.join(dataDirectory, 'backups')
const backupTables = [
  'contact_messages',
  'navigation_items',
  'settings',
  'media',
  'content_revisions',
  'audit_logs',
  'portfolio_entities',
  'redirects',
  'integrations',
  'analytics_events',
]

async function getDirectorySize(directory) {
  let size = 0
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) size += await getDirectorySize(entryPath)
    else if (entry.isFile()) size += (await stat(entryPath)).size
  }
  return size
}

function tarHeader(name, size, modifiedAt) {
  if (Buffer.byteLength(name) > 100) throw new Error('Backup archive path is too long.')
  const header = Buffer.alloc(512)
  header.write(name, 0, 100, 'utf8')
  const writeOctal = (value, offset, length) => header.write(`${Math.floor(value).toString(8).padStart(length - 1, '0')}\0`, offset, length, 'ascii')
  writeOctal(0o644, 100, 8)
  writeOctal(0, 108, 8)
  writeOctal(0, 116, 8)
  writeOctal(size, 124, 12)
  writeOctal(Math.floor(modifiedAt / 1000), 136, 12)
  header.fill(0x20, 148, 156)
  header[156] = 0x30
  header.write('ustar\0', 257, 6, 'ascii')
  header.write('00', 263, 2, 'ascii')
  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii')
  return header
}

async function* backupTarFiles(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    const archivePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      yield* backupTarFiles(filePath, archivePath)
      continue
    }
    if (!entry.isFile()) throw new Error('Backup archives cannot contain symbolic links or special files.')
    const details = await stat(filePath)
    yield tarHeader(archivePath, details.size, details.mtimeMs)
    for await (const chunk of createReadStream(filePath)) yield chunk
    const padding = (512 - details.size % 512) % 512
    if (padding) yield Buffer.alloc(padding)
  }
}

async function* backupTarArchive(directory) {
  yield* backupTarFiles(directory)
  yield Buffer.alloc(1024)
}

async function createBackup(actor) {
  await writeQueue
  await mkdir(backupDirectory, { recursive: true })
  const name = `portfolio-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
  const destination = path.join(backupDirectory, name)
  const mediaSnapshot = path.join(destination, 'media')
  await mkdir(destination, { recursive: true })
  try {
    const sqlitePath = path.join(destination, 'portfolio.sqlite')
    await sqliteBackup(database, sqlitePath)
    const snapshotDatabase = new DatabaseSync(sqlitePath)
    try {
      snapshotDatabase.exec("PRAGMA secure_delete = ON; DELETE FROM sessions; DELETE FROM login_attempts; DELETE FROM users; DELETE FROM settings WHERE key = 'mfaSecret'; VACUUM;")
    } finally {
      snapshotDatabase.close()
    }
    const content = await readContent()
    await writeFile(path.join(destination, 'portfolio-content.json'), JSON.stringify(content, null, 2), 'utf8')
    await cp(mediaDirectory, mediaSnapshot, { recursive: true })
    const createdAt = new Date().toISOString()
    await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({ formatVersion: 1, name, createdAt }, null, 2), 'utf8')
    recordAudit('backup_created', actor, name)
    return { name, createdAt, size: await getDirectorySize(destination), restorable: true }
  } catch (error) {
    await rm(destination, { recursive: true, force: true })
    throw error
  }
}

async function restoreBackup(name, actor) {
  if (!/^[a-zA-Z0-9._-]{1,120}$/.test(name)) throw new Error('Invalid backup name.')
  const sourceDirectory = path.join(backupDirectory, name)
  const manifest = JSON.parse(await readFile(path.join(sourceDirectory, 'manifest.json'), 'utf8'))
  if (manifest.formatVersion !== 1 || manifest.name !== name) throw new Error('Unsupported or invalid backup manifest.')

  const sourceDatabasePath = path.join(sourceDirectory, 'portfolio.sqlite')
  const sourceContentPath = path.join(sourceDirectory, 'portfolio-content.json')
  const sourceMediaPath = path.join(sourceDirectory, 'media')
  const savedContent = JSON.parse(await readFile(sourceContentPath, 'utf8'))
  if (!Array.isArray(savedContent.pages) || !Array.isArray(savedContent.sections)) throw new Error('The backup content file is invalid.')
  const savedMediaDirectory = await stat(sourceMediaPath)
  if (!savedMediaDirectory.isDirectory()) throw new Error('The backup media snapshot is invalid.')

  const sourceDatabase = new DatabaseSync(sourceDatabasePath)
  try {
    const integrity = sourceDatabase.prepare('PRAGMA integrity_check').get()
    if (integrity.integrity_check !== 'ok') throw new Error('The backup database failed its integrity check.')
    const availableTables = new Set(sourceDatabase.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name))
    for (const table of backupTables) {
      if (!availableTables.has(table)) throw new Error(`The backup is missing required data table: ${table}.`)
    }
    const mediaNames = sourceDatabase.prepare('SELECT name FROM media').all()
    for (const { name: mediaName } of mediaNames) {
      if (path.basename(mediaName) !== mediaName || !existsSync(path.join(sourceMediaPath, mediaName))) {
        throw new Error('The backup contains a media record with a missing or invalid file.')
      }
    }
  } catch (error) {
    sourceDatabase.close()
    throw error
  }

  const id = randomUUID()
  const stagedContent = path.join(dataDirectory, `portfolio-content-${id}.restore`)
  const stagedMedia = path.join(dataDirectory, `media-${id}.restore`)
  const previousContent = path.join(dataDirectory, `portfolio-content-${id}.previous`)
  const previousMedia = path.join(dataDirectory, `media-${id}.previous`)
  const hasPreviousContent = existsSync(contentFile)
  let previousContentMoved = false
  let contentInstalled = false
  let previousMediaMoved = false
  let mediaInstalled = false
  let transactionOpen = false

  try {
    await writeFile(stagedContent, JSON.stringify(savedContent, null, 2), 'utf8')
    await cp(sourceMediaPath, stagedMedia, { recursive: true })
    database.exec('BEGIN IMMEDIATE')
    transactionOpen = true
    for (const table of backupTables) {
      if (table === 'settings') database.prepare("DELETE FROM settings WHERE key != 'mfaSecret'").run()
      else database.prepare(`DELETE FROM "${table}"`).run()
      const rows = sourceDatabase.prepare(`SELECT * FROM "${table}"${table === 'settings' ? " WHERE key != 'mfaSecret'" : ''}`).all()
      if (rows.length === 0) continue
      const columns = sourceDatabase.prepare(`PRAGMA table_info("${table}")`).all().map((column) => column.name)
      const insert = database.prepare(`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
      for (const row of rows) insert.run(...columns.map((column) => row[column]))
    }
    database.exec('PRAGMA defer_foreign_keys = ON')
    if (hasPreviousContent) {
      await rename(contentFile, previousContent)
      previousContentMoved = true
    }
    await rename(stagedContent, contentFile)
    contentInstalled = true
    await rename(mediaDirectory, previousMedia)
    previousMediaMoved = true
    await rename(stagedMedia, mediaDirectory)
    mediaInstalled = true
    recordAudit('backup_restored', actor, name)
    database.exec('COMMIT')
    transactionOpen = false
  } catch (error) {
    if (transactionOpen) database.exec('ROLLBACK')
    if (contentInstalled) await rm(contentFile, { force: true })
    if (previousContentMoved) await rename(previousContent, contentFile)
    if (mediaInstalled) await rm(mediaDirectory, { recursive: true, force: true })
    if (previousMediaMoved) await rename(previousMedia, mediaDirectory)
    await rm(stagedContent, { force: true })
    await rm(stagedMedia, { recursive: true, force: true })
    sourceDatabase.close()
    throw error
  }

  sourceDatabase.close()
  if (previousContentMoved) await rm(previousContent, { force: true })
  if (previousMediaMoved) await rm(previousMedia, { recursive: true, force: true })
  return { name, restoredAt: new Date().toISOString() }
}

function enforceMutationOrigin(request, response, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return next()
  const origin = request.get('origin')
  if (!origin) return next()
  const allowed = (process.env.CORS_ORIGINS || 'http://127.0.0.1:4317,http://localhost:4317,http://127.0.0.1:4318,http://localhost:4318')
    .split(',').map((value) => value.trim())
  if (!allowed.includes(origin)) return response.status(403).json({ error: 'Request origin is not allowed.' })
  return next()
}
app.use(enforceMutationOrigin)

app.post('/api/admin/session/login', async (request, response) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(8).max(256), mfaCode: z.string().trim().optional() }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Enter a valid email and password.' })
  const recentFailures = database.prepare("SELECT COUNT(*) AS count FROM login_attempts WHERE identity = ? AND success = 0 AND created_at >= datetime('now', '-15 minutes')").get(parsed.data.email).count
  if (recentFailures >= 5) return response.status(429).json({ error: 'Too many login attempts. Try again later.' })
  const storedHash = process.env.ADMIN_PASSWORD_HASH
  if (!storedHash || parsed.data.email.toLowerCase().trim() !== (process.env.ADMIN_EMAIL || '').toLowerCase().trim()) {
    recordAudit('login_failed', parsed.data.email, 'Invalid credentials')
    database.prepare('INSERT INTO login_attempts (id, identity, success, created_at) VALUES (?, ?, 0, ?)').run(randomUUID(), parsed.data.email, new Date().toISOString())
    return response.status(401).json({ error: 'Invalid credentials.' })
  }
  if (!verifyPassword(parsed.data.password, storedHash)) {
    recordAudit('login_failed', parsed.data.email, 'Invalid credentials')
    database.prepare('INSERT INTO login_attempts (id, identity, success, created_at) VALUES (?, ?, 0, ?)').run(randomUUID(), parsed.data.email, new Date().toISOString())
    return response.status(401).json({ error: 'Invalid credentials.' })
  }
  const mfaRow = database.prepare("SELECT value FROM settings WHERE key = 'mfaSecret'").get()
  if (mfaRow) {
    const secret = JSON.parse(mfaRow.value)
    if (!parsed.data.mfaCode || !verifySync({ secret, token: parsed.data.mfaCode }).valid) {
      database.prepare('INSERT INTO login_attempts (id, identity, success, created_at) VALUES (?, ?, 0, ?)').run(randomUUID(), parsed.data.email, new Date().toISOString())
      recordAudit('mfa_failed', parsed.data.email, 'Invalid or missing MFA code')
      return response.status(401).json({ error: 'A valid MFA code is required.' })
    }
  }
  database.prepare('INSERT INTO login_attempts (id, identity, success, created_at) VALUES (?, ?, 1, ?)').run(randomUUID(), parsed.data.email, new Date().toISOString())
  const userId = 'owner'
  const now = new Date().toISOString()
  database.prepare('INSERT OR REPLACE INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, parsed.data.email, storedHash, 'super_admin', now, now)
  const sessionId = randomBytes(32).toString('hex')
  database.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(sessionId, userId, new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), now)
  recordAudit('login_success', parsed.data.email, 'Administrator session created')
  response.setHeader('Set-Cookie', `admin_session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${12 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
  response.json({ authenticated: true, user: { email: parsed.data.email, role: 'super_admin' } })
})

app.post('/api/admin/session/logout', requireAdmin, (request, response) => {
  const cookieHeader = request.get('cookie') || ''
  const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/)
  if (match) database.prepare('DELETE FROM sessions WHERE id = ?').run(decodeURIComponent(match[1]))
  recordAudit('logout', request.adminUser?.email || 'unknown', 'Administrator session ended')
  response.setHeader('Set-Cookie', 'admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
  response.json({ authenticated: false })
})

app.get('/api/admin/session', requireAdmin, (request, response) => {
  response.json({ authenticated: true, user: request.adminUser })
})

app.post('/api/admin/security/mfa/setup', requireAdmin, (request, response) => {
  const secret = generateSecret()
  const accountName = request.adminUser.email || 'portfolio-owner'
  const otpauth = generateURI({ issuer: 'Muiz Lawal Portfolio', label: accountName, secret })
  response.json({ secret, otpauth })
})

app.get('/api/admin/security/mfa/status', requireAdmin, (_request, response) => {
  response.json({ enabled: Boolean(database.prepare("SELECT 1 FROM settings WHERE key = 'mfaSecret'").get()) })
})

app.post('/api/admin/security/mfa/enable', requireAdmin, (request, response) => {
  const parsed = z.object({ secret: z.string().trim().min(16), code: z.string().trim().regex(/^\d{6}$/) }).safeParse(request.body)
  if (!parsed.success || !verifySync({ secret: parsed.data.secret, token: parsed.data.code }).valid) return response.status(400).json({ error: 'The MFA secret or code is invalid.' })
  database.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('mfaSecret', ?, ?)").run(JSON.stringify(parsed.data.secret), new Date().toISOString())
  recordAudit('mfa_enabled', request.adminUser.email, 'Authenticator MFA enabled')
  response.json({ enabled: true })
})

app.post('/api/admin/security/mfa/disable', requireAdmin, (_request, response) => {
  database.prepare("DELETE FROM settings WHERE key = 'mfaSecret'").run()
  recordAudit('mfa_disabled', _request.adminUser.email, 'Authenticator MFA disabled')
  response.json({ enabled: false })
})

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', port })
})

app.get('/api/content', async (_request, response, next) => {
  try {
    const content = await readContent()
    const settingRows = database.prepare('SELECT key, value FROM settings').all()
    const settings = Object.fromEntries(settingRows.map((row) => [row.key, JSON.parse(row.value)]))
    const navigation = database.prepare("SELECT * FROM navigation_items WHERE menu = 'primary' AND desktop_visible = 1 ORDER BY position ASC").all()
    const collections = {}
    for (const collection of allowedEntityCollections) {
      collections[collection] = database.prepare("SELECT * FROM portfolio_entities WHERE collection = ? AND status = 'published' ORDER BY position ASC, created_at ASC").all(collection)
        .map((row) => ({ id: row.id, status: row.status, position: row.position, ...JSON.parse(row.payload) }))
    }
    response.json({
      pages: content.pages.filter((page) => page.status === 'published' && page.visibility === 'public'),
      sections: content.sections,
      settings,
      navigation,
      collections,
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/content/pages/:slug', async (request, response, next) => {
  try {
    const content = await readContent()
    const page = content.pages.find((entry) => entry.slug === request.params.slug && entry.status === 'published' && entry.visibility === 'public')
    if (!page) return response.status(404).json({ error: 'Page not found.' })
    response.json(page)
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/content', requireAdmin, async (_request, response, next) => {
  try {
    response.json(await readContent())
  } catch (error) {
    next(error)
  }
})

app.put('/api/admin/content/sections', requireAdmin, async (request, response, next) => {
  const parsed = z.array(sectionSchema).length(defaultSections.length).safeParse(request.body)
  if (!parsed.success || new Set((parsed.success ? parsed.data : []).map((section) => section.id)).size !== defaultSections.length) {
    return response.status(400).json({ error: 'Provide each of the seven homepage sections exactly once.' })
  }
  try {
    const content = await readContent()
    content.sections = parsed.data
    await saveContent(content)
    recordAudit('homepage_sections_updated', request.adminUser.email, `${parsed.data.length} sections`)
    response.json({ sections: content.sections })
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/content/pages', requireAdmin, async (request, response, next) => {
  const parsed = pageSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid page content.', details: parsed.error.issues })
  if (['admin', 'api', 'about', 'projects', 'writing', 'certifications'].includes(parsed.data.slug)) return response.status(400).json({ error: 'That slug is reserved.' })
  try {
    const content = await readContent()
    if (content.pages.some((page) => page.slug === parsed.data.slug)) return response.status(409).json({ error: 'That URL slug is already in use.' })
    const page = { ...parsed.data, id: randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    content.pages.push(page)
    await saveContent(content)
    database.prepare('INSERT INTO content_revisions (id, entity_type, entity_id, snapshot, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), 'page', page.id, JSON.stringify(page), request.adminUser.email, new Date().toISOString())
    recordAudit('page_created', request.adminUser.email, page.slug)
    response.status(201).json(page)
  } catch (error) {
    next(error)
  }
})

app.put('/api/admin/content/pages/:id', requireAdmin, async (request, response, next) => {
  const parsed = pageSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid page content.', details: parsed.error.issues })
  try {
    const content = await readContent()
    const index = content.pages.findIndex((page) => page.id === request.params.id)
    if (index < 0) return response.status(404).json({ error: 'Page not found.' })
    if (['admin', 'api', 'projects', 'writing', 'certifications'].includes(parsed.data.slug) || parsed.data.slug === 'about' && content.pages[index].type !== 'page') {
      return response.status(400).json({ error: 'That slug is reserved.' })
    }
    if (content.pages.some((page) => page.id !== request.params.id && page.slug === parsed.data.slug)) return response.status(409).json({ error: 'That URL slug is already in use.' })
    content.pages[index] = { ...parsed.data, id: request.params.id, createdAt: content.pages[index].createdAt, updatedAt: new Date().toISOString() }
    await saveContent(content)
    database.prepare('INSERT INTO content_revisions (id, entity_type, entity_id, snapshot, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), 'page', request.params.id, JSON.stringify(content.pages[index]), request.adminUser.email, new Date().toISOString())
    recordAudit('page_updated', request.adminUser.email, parsed.data.slug)
    response.json(content.pages[index])
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/content/pages/:id/duplicate', requireAdmin, async (request, response, next) => {
  try {
    const content = await readContent()
    const original = content.pages.find((page) => page.id === request.params.id)
    if (!original) return response.status(404).json({ error: 'Page not found.' })
    const baseSlug = `${original.slug}-copy`
    let slug = baseSlug
    let suffix = 2
    while (content.pages.some((page) => page.slug === slug)) slug = `${baseSlug}-${suffix++}`
    const copy = { ...original, id: randomUUID(), slug, title: `${original.title} (Copy)`, status: 'draft', visibility: 'private', inNavigation: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    content.pages.push(copy)
    await saveContent(content)
    recordAudit('page_duplicated', request.adminUser.email, copy.slug)
    response.status(201).json(copy)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/admin/content/pages/:id', requireAdmin, async (request, response, next) => {
  try {
    const content = await readContent()
    const remaining = content.pages.filter((page) => page.id !== request.params.id)
    if (remaining.length === content.pages.length) return response.status(404).json({ error: 'Page not found.' })
    content.pages = remaining
    await saveContent(content)
    recordAudit('page_deleted', request.adminUser.email, request.params.id)
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/dashboard', requireAdmin, async (_request, response, next) => {
  try {
    const content = await readContent()
    const projects = content.pages.filter((page) => page.type === 'project')
    const pages = content.pages.filter((page) => page.type === 'page')
    const articles = content.pages.filter((page) => page.type === 'article')
    const messages = database.prepare('SELECT status, COUNT(*) AS count FROM contact_messages GROUP BY status').all()
    const recent = database.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 12').all()
    response.json({
      totals: {
        publishedProjects: projects.filter((page) => page.status === 'published').length,
        draftProjects: projects.filter((page) => page.status === 'draft').length,
        publishedPages: pages.filter((page) => page.status === 'published').length,
        articles: articles.length,
        publishedArticles: articles.filter((page) => page.status === 'published').length,
        media: database.prepare('SELECT COUNT(*) AS count FROM media').get().count,
        unreadMessages: messages.find((row) => row.status === 'unread')?.count || 0,
        contactMessages: messages.reduce((sum, row) => sum + row.count, 0),
      },
      recentContent: content.pages.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 8),
      recentActivity: recent,
      health: {
        application: 'operational',
        api: 'operational',
        database: 'operational',
        storage: existsSync(mediaDirectory) ? 'operational' : 'unavailable',
        email: process.env.RESEND_API_KEY ? 'configured' : 'needs-configuration',
      },
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/messages', requireAdmin, (_request, response) => {
  response.json(database.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all())
})

app.patch('/api/admin/messages/:id', requireAdmin, (request, response) => {
  const parsed = z.object({ status: z.enum(['unread', 'read', 'archived']) }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid message status.' })
  const result = database.prepare('UPDATE contact_messages SET status = ? WHERE id = ?').run(parsed.data.status, request.params.id)
  if (!result.changes) return response.status(404).json({ error: 'Message not found.' })
  recordAudit('message_status_changed', request.adminUser.email, request.params.id)
  response.json({ id: request.params.id, status: parsed.data.status })
})

app.delete('/api/admin/messages/:id', requireAdmin, (request, response) => {
  const result = database.prepare('DELETE FROM contact_messages WHERE id = ?').run(request.params.id)
  if (!result.changes) return response.status(404).json({ error: 'Message not found.' })
  recordAudit('message_deleted', request.adminUser.email, request.params.id)
  response.status(204).end()
})

app.get('/api/admin/settings', requireAdmin, (_request, response) => {
  const rows = database.prepare('SELECT key, value FROM settings').all()
  response.json(Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)])))
})

app.put('/api/admin/settings', requireAdmin, (request, response) => {
  const parsed = z.record(z.string(), z.unknown()).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid settings.' })
  const statement = database.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
  const now = new Date().toISOString()
  for (const [key, value] of Object.entries(parsed.data)) statement.run(key, JSON.stringify(value), now)
  recordAudit('settings_updated', request.adminUser.email, Object.keys(parsed.data).join(','))
  response.json(parsed.data)
})

app.get('/api/admin/navigation', requireAdmin, (_request, response) => {
  response.json(database.prepare('SELECT * FROM navigation_items ORDER BY position ASC').all())
})

app.put('/api/admin/navigation', requireAdmin, (request, response) => {
  const itemSchema = z.object({
    id: z.string().optional(),
    label: z.string().trim().min(1).max(80),
    href: z.string().trim().min(1).max(500),
    position: z.number().int().min(0),
    menu: z.enum(['primary', 'footer']),
    desktop_visible: z.boolean(),
    mobile_visible: z.boolean(),
    external: z.boolean(),
    parent_id: z.string().nullable().optional(),
  })
  const parsed = z.array(itemSchema).max(100).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid navigation configuration.' })
  database.exec('DELETE FROM navigation_items')
  const insert = database.prepare('INSERT INTO navigation_items (id, label, href, position, menu, desktop_visible, mobile_visible, external, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  for (const item of parsed.data) insert.run(item.id || randomUUID(), item.label, item.href, item.position, item.menu, item.desktop_visible ? 1 : 0, item.mobile_visible ? 1 : 0, item.external ? 1 : 0, item.parent_id || null)
  recordAudit('navigation_updated', request.adminUser.email, `${parsed.data.length} items`)
  response.json(parsed.data)
})

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, mediaDirectory),
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase().slice(0, 10)
      callback(null, `${randomUUID()}${extension}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4'].includes(file.mimetype)) return callback(new Error('Unsupported file type'))
    callback(null, true)
  },
})

async function normalizeMediaUpload(file) {
  if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif') {
    const webpName = `${path.parse(file.filename).name}.webp`
    const webpPath = path.join(mediaDirectory, webpName)
    await sharp(file.path).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(webpPath)
    unlinkSync(file.path)
    file.filename = webpName
    file.path = webpPath
    file.mimetype = 'image/webp'
    file.originalname = `${path.parse(file.originalname).name}.webp`
  }
  file.size = (await stat(file.path)).size
}

app.get('/api/admin/media', requireAdmin, (_request, response) => {
  response.json(database.prepare('SELECT * FROM media ORDER BY created_at DESC').all())
})

app.get('/api/media/:id', (request, response) => {
  const record = database.prepare('SELECT * FROM media WHERE id = ?').get(request.params.id)
  if (!record || record.folder === 'private') return response.status(404).json({ error: 'Media not found.' })
  const filePath = path.join(mediaDirectory, record.name)
  if (!existsSync(filePath)) return response.status(404).json({ error: 'Media not found.' })
  response.type(record.mime_type)
  response.setHeader('Cache-Control', 'public, max-age=86400')
  response.sendFile(filePath)
})

app.post('/api/admin/media', requireAdmin, upload.single('file'), async (request, response, next) => {
  if (!request.file) return response.status(400).json({ error: 'Choose a file to upload.' })
  try {
    await normalizeMediaUpload(request.file)
  } catch (error) {
    if (existsSync(request.file.path)) unlinkSync(request.file.path)
    return next(error)
  }
  const record = {
    id: randomUUID(),
    name: request.file.filename,
    original_name: request.file.originalname,
    mime_type: request.file.mimetype,
    size: request.file.size,
    alt_text: String(request.body.altText || '').slice(0, 300),
    folder: String(request.body.folder || '').slice(0, 80),
    created_at: new Date().toISOString(),
  }
  database.prepare('INSERT INTO media (id, name, original_name, mime_type, size, alt_text, folder, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(record.id, record.name, record.original_name, record.mime_type, record.size, record.alt_text, record.folder, record.created_at)
  recordAudit('media_uploaded', request.adminUser.email, record.original_name)
  response.status(201).json(record)
})

app.delete('/api/admin/media/:id', requireAdmin, (request, response, next) => {
  try {
    const record = database.prepare('SELECT * FROM media WHERE id = ?').get(request.params.id)
    if (!record) return response.status(404).json({ error: 'Media not found.' })
    const filePath = path.join(mediaDirectory, record.name)
    if (existsSync(filePath)) unlinkSync(filePath)
    database.prepare('DELETE FROM media WHERE id = ?').run(request.params.id)
    recordAudit('media_deleted', request.adminUser.email, record.original_name)
    return response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.patch('/api/admin/media/:id', requireAdmin, (request, response) => {
  const parsed = z.object({ alt_text: z.string().max(300).optional(), folder: z.string().max(80).optional(), original_name: z.string().trim().min(1).max(255).optional() }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid media metadata.' })
  const record = database.prepare('SELECT * FROM media WHERE id = ?').get(request.params.id)
  if (!record) return response.status(404).json({ error: 'Media not found.' })
  database.prepare('UPDATE media SET alt_text = ?, folder = ?, original_name = ? WHERE id = ?').run(
    parsed.data.alt_text ?? record.alt_text,
    parsed.data.folder ?? record.folder,
    parsed.data.original_name ?? record.original_name,
    request.params.id,
  )
  recordAudit('media_updated', request.adminUser.email, request.params.id)
  response.json(database.prepare('SELECT * FROM media WHERE id = ?').get(request.params.id))
})

app.put('/api/admin/media/:id/replace', requireAdmin, upload.single('file'), async (request, response, next) => {
  if (!request.file) return response.status(400).json({ error: 'Choose a replacement file.' })
  const record = database.prepare('SELECT * FROM media WHERE id = ?').get(request.params.id)
  if (!record) {
    unlinkSync(request.file.path)
    return response.status(404).json({ error: 'Media not found.' })
  }
  const oldPath = path.join(mediaDirectory, record.name)
  try {
    await normalizeMediaUpload(request.file)
    database.prepare('UPDATE media SET name = ?, original_name = ?, mime_type = ?, size = ?, created_at = ? WHERE id = ?').run(
      request.file.filename,
      request.file.originalname,
      request.file.mimetype,
      request.file.size,
      new Date().toISOString(),
      request.params.id,
    )
  } catch (error) {
    if (existsSync(request.file.path)) unlinkSync(request.file.path)
    return next(error)
  }
  if (existsSync(oldPath)) {
    try {
      unlinkSync(oldPath)
    } catch (error) {
      return next(error)
    }
  }
  recordAudit('media_replaced', request.adminUser.email, request.params.id)
  response.json(database.prepare('SELECT * FROM media WHERE id = ?').get(request.params.id))
})

app.get('/api/admin/audit', requireAdmin, (_request, response) => {
  response.json(database.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500').all())
})

app.get('/api/admin/users', requireAdmin, (_request, response) => {
  if (request.adminUser.role !== 'super_admin') return response.status(403).json({ error: 'Super admin access required.' })
  response.json(database.prepare('SELECT id, email, role, created_at, updated_at FROM users ORDER BY created_at DESC').all())
})

app.post('/api/admin/users', requireAdmin, (request, response) => {
  if (request.adminUser.role !== 'super_admin') return response.status(403).json({ error: 'Super admin access required.' })
  const parsed = z.object({ email: z.string().email(), role: z.enum(['super_admin', 'editor', 'viewer']) }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid user.' })
  const now = new Date().toISOString()
  const passwordPlaceholder = 'disabled'
  database.prepare('INSERT OR REPLACE INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), parsed.data.email, passwordPlaceholder, parsed.data.role, now, now)
  recordAudit('user_created', request.adminUser.email, parsed.data.email)
  response.status(201).json({ email: parsed.data.email, role: parsed.data.role })
})

app.get('/api/admin/backup/export', requireAdmin, async (_request, response, next) => {
  try {
    const content = await readContent()
    const settings = Object.fromEntries(database.prepare("SELECT key, value FROM settings WHERE key != 'mfaSecret'").all().map((row) => [row.key, JSON.parse(row.value)]))
    const navigation = database.prepare('SELECT * FROM navigation_items ORDER BY position ASC').all()
    const entities = database.prepare('SELECT * FROM portfolio_entities ORDER BY collection, position ASC').all()
    const exportPayload = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      content,
      settings,
      navigation,
      entities,
      redirects: database.prepare('SELECT * FROM redirects ORDER BY created_at ASC').all(),
      integrations: database.prepare('SELECT key, enabled, configuration, status, updated_at FROM integrations').all(),
      mediaInventory: database.prepare('SELECT id, name, original_name, mime_type, size, alt_text, folder, created_at FROM media').all(),
    }
    recordAudit('backup_exported', _request.adminUser.email, 'Configuration and content export')
    response.setHeader('Content-Disposition', 'attachment; filename="portfolio-backup.json"')
    response.json(exportPayload)
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/backup/create', requireAdmin, async (_request, response, next) => {
  try {
    response.status(201).json(await createBackup(_request.adminUser.email))
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/backup/history', requireAdmin, async (_request, response, next) => {
  try {
    await mkdir(backupDirectory, { recursive: true })
    const history = []
    for (const entry of await readdir(backupDirectory, { withFileTypes: true })) {
      const location = path.join(backupDirectory, entry.name)
      if (entry.isDirectory()) {
        const manifest = JSON.parse(await readFile(path.join(location, 'manifest.json'), 'utf8'))
        if (manifest.formatVersion !== 1 || manifest.name !== entry.name) throw new Error(`Invalid backup manifest: ${entry.name}`)
        history.push({ name: entry.name, createdAt: manifest.createdAt, size: await getDirectorySize(location), restorable: true })
      } else if (entry.isFile() && entry.name.endsWith('.sqlite')) {
        const details = await stat(location)
        history.push({ name: entry.name, createdAt: details.birthtime.toISOString(), size: details.size, restorable: false })
      }
    }
    response.json(history.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/backup/:name/download/:file', requireAdmin, (request, response, next) => {
  try {
    const { name, file } = request.params
    if (name === '.' || name === '..' || !/^[a-zA-Z0-9._-]{1,120}$/.test(name) || !['portfolio.sqlite', 'portfolio-content.json'].includes(file)) {
      return response.status(400).json({ error: 'Invalid backup file.' })
    }
    const location = path.join(backupDirectory, name)
    if (!existsSync(path.join(location, 'manifest.json'))) return response.status(404).json({ error: 'Backup not found.' })
    return response.download(path.join(location, file), (error) => {
      if (error && !response.headersSent) next(error)
    })
  } catch (error) {
    return next(error)
  }
})

app.get('/api/admin/backup/:name/download', requireAdmin, async (request, response, next) => {
  const { name } = request.params
  if (name === '.' || name === '..' || !/^[a-zA-Z0-9._-]{1,120}$/.test(name)) {
    return response.status(400).json({ error: 'Invalid backup name.' })
  }
  const location = path.join(backupDirectory, name)
  if (!existsSync(path.join(location, 'manifest.json'))) return response.status(404).json({ error: 'Backup not found.' })
  response.setHeader('Content-Type', 'application/gzip')
  response.setHeader('Content-Disposition', `attachment; filename="${name}.tar.gz"`)
  try {
    await pipeline(Readable.from(backupTarArchive(location)), createGzip(), response)
  } catch (error) {
    if (response.headersSent) response.destroy(error)
    else next(error)
  }
})

app.post('/api/admin/backup/:name/restore', requireAdmin, async (request, response, next) => {
  try {
    const name = request.params.name
    if (name === '.' || name === '..' || !/^[a-zA-Z0-9._-]{1,120}$/.test(name)) return response.status(400).json({ error: 'Invalid backup name.' })
    if (!existsSync(path.join(backupDirectory, name, 'manifest.json'))) return response.status(404).json({ error: 'Backup not found.' })
    const currentBackup = await createBackup(request.adminUser.email)
    const restored = await restoreBackup(name, request.adminUser.email)
    response.json({ ...restored, safetyBackup: currentBackup.name })
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/revisions/:entityType/:entityId', requireAdmin, (request, response) => {
  const allowedTypes = ['page', 'project', 'article']
  if (!allowedTypes.includes(request.params.entityType)) return response.status(400).json({ error: 'Invalid revision type.' })
  const revisions = database.prepare('SELECT id, entity_type, entity_id, snapshot, created_by, created_at FROM content_revisions WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC').all(request.params.entityType, request.params.entityId)
  response.json(revisions.map((revision) => ({ ...revision, snapshot: JSON.parse(revision.snapshot) })))
})

app.post('/api/admin/revisions/:entityType/:entityId/restore/:revisionId', requireAdmin, async (request, response, next) => {
  try {
    const revision = database.prepare('SELECT * FROM content_revisions WHERE id = ? AND entity_type = ? AND entity_id = ?').get(request.params.revisionId, request.params.entityType, request.params.entityId)
    if (!revision) return response.status(404).json({ error: 'Revision not found.' })
    const content = await readContent()
    const index = content.pages.findIndex((page) => page.id === request.params.entityId)
    if (index < 0) return response.status(404).json({ error: 'Page not found.' })
    content.pages[index] = { ...JSON.parse(revision.snapshot), id: request.params.entityId, updatedAt: new Date().toISOString() }
    await saveContent(content)
    recordAudit('revision_restored', request.adminUser.email, request.params.entityId)
    response.json(content.pages[index])
  } catch (error) {
    next(error)
  }
})

const allowedEntityCollections = new Set(['experience', 'education', 'certifications', 'skills', 'testimonials', 'initiatives', 'services'])

app.get('/api/public/entities/:collection', (request, response) => {
  if (!allowedEntityCollections.has(request.params.collection)) return response.status(404).json({ error: 'Collection not found.' })
  const rows = database.prepare("SELECT * FROM portfolio_entities WHERE collection = ? AND status = 'published' ORDER BY position ASC, created_at ASC").all(request.params.collection)
  response.json(rows.map((row) => ({ id: row.id, status: row.status, position: row.position, ...JSON.parse(row.payload) })))
})

app.get('/api/admin/entities/:collection', requireAdmin, (request, response) => {
  if (!allowedEntityCollections.has(request.params.collection)) return response.status(404).json({ error: 'Collection not found.' })
  const rows = database.prepare('SELECT * FROM portfolio_entities WHERE collection = ? ORDER BY position ASC, created_at ASC').all(request.params.collection)
  response.json(rows.map((row) => ({ id: row.id, status: row.status, position: row.position, ...JSON.parse(row.payload) })))
})

app.post('/api/admin/entities/:collection', requireAdmin, (request, response) => {
  const collection = request.params.collection
  if (!allowedEntityCollections.has(collection)) return response.status(404).json({ error: 'Collection not found.' })
  const parsed = z.record(z.string(), z.unknown()).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid entity.' })
  const id = randomUUID()
  const now = new Date().toISOString()
  const status = parsed.data.status === 'draft' ? 'draft' : 'published'
  const position = typeof parsed.data.position === 'number' ? parsed.data.position : 0
  database.prepare('INSERT INTO portfolio_entities (id, collection, status, position, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, collection, status, position, JSON.stringify(parsed.data), now, now)
  recordAudit('entity_created', request.adminUser.email, `${collection}:${id}`)
  response.status(201).json({ id, status, position, ...parsed.data })
})

app.put('/api/admin/entities/:collection/:id', requireAdmin, (request, response) => {
  const collection = request.params.collection
  if (!allowedEntityCollections.has(collection)) return response.status(404).json({ error: 'Collection not found.' })
  const parsed = z.record(z.string(), z.unknown()).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid entity.' })
  const existing = database.prepare('SELECT id FROM portfolio_entities WHERE id = ? AND collection = ?').get(request.params.id, collection)
  if (!existing) return response.status(404).json({ error: 'Entity not found.' })
  const now = new Date().toISOString()
  const status = parsed.data.status === 'draft' ? 'draft' : 'published'
  const position = typeof parsed.data.position === 'number' ? parsed.data.position : 0
  database.prepare('UPDATE portfolio_entities SET status = ?, position = ?, payload = ?, updated_at = ? WHERE id = ?').run(status, position, JSON.stringify(parsed.data), now, request.params.id)
  recordAudit('entity_updated', request.adminUser.email, `${collection}:${request.params.id}`)
  response.json({ id: request.params.id, status, position, ...parsed.data })
})

app.delete('/api/admin/entities/:collection/:id', requireAdmin, (request, response) => {
  const existing = database.prepare('SELECT id FROM portfolio_entities WHERE id = ? AND collection = ?').get(request.params.id, request.params.collection)
  if (!existing) return response.status(404).json({ error: 'Entity not found.' })
  database.prepare('DELETE FROM portfolio_entities WHERE id = ?').run(request.params.id)
  recordAudit('entity_deleted', request.adminUser.email, `${request.params.collection}:${request.params.id}`)
  response.status(204).end()
})

app.get('/api/admin/redirects', requireAdmin, (_request, response) => {
  response.json(database.prepare('SELECT * FROM redirects ORDER BY created_at DESC').all())
})
app.post('/api/admin/redirects', requireAdmin, (request, response) => {
  const parsed = z.object({
    source: z.string().trim().regex(/^\/.*/).max(500),
    destination: z.string().trim().regex(/^\/|^https:\/\//).max(1000),
    status_code: z.enum(['301', '302']).transform(Number).or(z.literal(301)).or(z.literal(302)),
  }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid redirect.' })
  const existing = database.prepare('SELECT id FROM redirects WHERE source = ?').get(parsed.data.source)
  if (existing) return response.status(409).json({ error: 'Source already exists.' })
  const id = randomUUID()
  database.prepare('INSERT INTO redirects (id, source, destination, status_code, active, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(id, parsed.data.source, parsed.data.destination, parsed.data.status_code, new Date().toISOString())
  recordAudit('redirect_created', request.adminUser.email, parsed.data.source)
  response.status(201).json({ id, ...parsed.data, active: true })
})
app.delete('/api/admin/redirects/:id', requireAdmin, (request, response) => {
  const result = database.prepare('DELETE FROM redirects WHERE id = ?').run(request.params.id)
  if (!result.changes) return response.status(404).json({ error: 'Redirect not found.' })
  recordAudit('redirect_deleted', request.adminUser.email, request.params.id)
  response.status(204).end()
})

app.get('/api/admin/integrations', requireAdmin, (_request, response) => {
  for (const key of ['github', 'linkedin', 'resend', 'plausible', 'storage', 'captcha']) {
    database.prepare('INSERT OR IGNORE INTO integrations (key, enabled, configuration, status, updated_at) VALUES (?, 0, ?, ?, ?)').run(key, '{}', 'unconfigured', new Date().toISOString())
  }
  response.json(database.prepare('SELECT key, enabled, status, updated_at FROM integrations').all().map((item) => ({ ...item, enabled: Boolean(item.enabled) })))
})
app.put('/api/admin/integrations/:key', requireAdmin, (request, response) => {
  const key = request.params.key
  if (!['github', 'linkedin', 'resend', 'plausible', 'storage', 'captcha'].includes(key)) return response.status(404).json({ error: 'Integration not found.' })
  const parsed = z.object({ enabled: z.boolean(), configuration: z.record(z.string(), z.unknown()).optional().default({}) }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid integration configuration.' })
  const safeConfiguration = Object.fromEntries(Object.entries(parsed.data.configuration).filter(([name]) => !/(secret|key|token|password)/i.test(name)))
  const now = new Date().toISOString()
  database.prepare('INSERT OR REPLACE INTO integrations (key, enabled, configuration, status, updated_at) VALUES (?, ?, ?, ?, ?)').run(key, parsed.data.enabled ? 1 : 0, JSON.stringify(safeConfiguration), parsed.data.enabled ? 'configured' : 'disabled', now)
  recordAudit('integration_updated', request.adminUser.email, key)
  response.json({ key, enabled: parsed.data.enabled, status: parsed.data.enabled ? 'configured' : 'disabled', updated_at: now })
})

app.post('/api/analytics/event', (request, response) => {
  const parsed = z.object({ event_type: z.string().trim().min(1).max(80), path: z.string().trim().max(500), metadata: z.record(z.string(), z.unknown()).optional().default({}) }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid analytics event.' })
  database.prepare('INSERT INTO analytics_events (id, event_type, path, metadata, created_at) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), parsed.data.event_type, parsed.data.path, JSON.stringify(parsed.data.metadata), new Date().toISOString())
  response.status(202).json({ accepted: true })
})

app.post('/api/analytics/export/plausible', async (request, response, next) => {
  try {
    const parsed = z.object({ period: z.enum(['24h', '7d', '30d']).default('7d') }).safeParse(request.body)
    if (!parsed.success) return response.status(400).json({ error: 'Invalid analytics period.' })
    const site = process.env.VITE_ANALYTICS_DOMAIN
    const apiUrl = process.env.VITE_ANALYTICS_API_URL
    const apiKey = process.env.PLAUSIBLE_API_KEY
    if (!site || !apiKey) return response.status(503).json({ error: 'Plausible API credentials are not configured.' })
    const period = parsed.data.period
    const upstream = await fetch(`${apiUrl || 'https://plausible.io/api/v1'}/stats/aggregate?site_id=${encodeURIComponent(site)}&period=${period}&metrics=visitors,pageviews`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!upstream.ok) return response.status(502).json({ error: 'Plausible could not be queried.' })
    response.json(await upstream.json())
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/analytics', requireAdmin, (_request, response) => {
  const total = database.prepare('SELECT COUNT(*) AS count FROM analytics_events').get().count
  const popular = database.prepare('SELECT path, COUNT(*) AS count FROM analytics_events GROUP BY path ORDER BY count DESC LIMIT 10').all()
  const events = database.prepare('SELECT event_type, COUNT(*) AS count FROM analytics_events GROUP BY event_type ORDER BY count DESC LIMIT 20').all()
  response.json({ total, popular, events, source: 'internal-first-party-events', configured: Boolean(process.env.VITE_ANALYTICS_ENABLED === 'true') })
})

app.post('/api/contact', contactLimit, async (request, response) => {
  const parsed = contactSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ error: 'Please provide valid name, email, subject and message fields.' })
  }

  const apiKey = process.env.RESEND_API_KEY
  const recipient = process.env.CONTACT_RECIPIENT || 'abdulmuizlawal208@gmail.com'
  const messageId = randomUUID()
  const { name, email, subject, message } = parsed.data
  database.prepare('INSERT INTO contact_messages (id, name, email, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(messageId, name, email, subject, message, 'unread', new Date().toISOString())
  if (!apiKey) {
    return response.status(503).json({ error: 'Email delivery is not configured on this server.' })
  }

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || 'Portfolio <onboarding@resend.dev>',
        to: [recipient],
        reply_to: email,
        subject: `[Portfolio] ${subject}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      }),
    })

    if (!resendResponse.ok) {
      const details = await resendResponse.text()
      console.error('Resend delivery failed:', details)
      return response.status(502).json({ error: 'Email delivery failed. Please try again later.' })
    }

    return response.status(200).json({ sent: true })
  } catch (error) {
    console.error('Contact delivery error:', error)
    return response.status(502).json({ error: 'Email delivery failed. Please try again later.' })
  }
})

app.use((error, _request, response, _next) => {
  if (error?.type === 'entity.parse.failed') return response.status(400).json({ error: 'Invalid JSON request body.' })
  console.error('Unhandled API error:', error)
  return response.status(500).json({ error: 'An unexpected server error occurred.' })
})

app.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`Portfolio API listening on http://127.0.0.1:${port}`)
})
