import pg from 'pg'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('Set POSTGRES_URL or DATABASE_URL to run migrations.')
  process.exit(1)
}

const client = new pg.Client({ connectionString, ssl: process.env.POSTGRES_SSL === 'false' ? false : { rejectUnauthorized: false } })
await client.connect()
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)

const migrationDirectory = path.resolve('migrations')
const names = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort()
for (const name of names) {
  const existing = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name])
  if (existing.rowCount) continue
  const sql = await readFile(path.join(migrationDirectory, name), 'utf8')
  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
    await client.query('COMMIT')
    console.log(`Applied ${name}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

await client.end()
