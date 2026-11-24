import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '')
if (!/^https?:\/\/[^/]+$/i.test(siteUrl)) {
  console.warn('Sitemap not generated: configure SITE_URL with the public site origin.')
  process.exit(0)
}

const pages = [
  { path: '/', priority: '1.0' },
  { path: '/about', priority: '0.7' },
  { path: '/projects', priority: '0.8' },
  { path: '/writing', priority: '0.7' },
  { path: '/certifications', priority: '0.5' },
]

try {
  const stored = JSON.parse(await readFile(path.resolve(process.env.DATA_DIR || 'data/portfolio-content.json'), 'utf8'))
  for (const page of stored.pages || []) {
    if (page.status !== 'published' || page.visibility !== 'public') continue
    const urlPath = page.type === 'project'
      ? `/projects/${page.slug}`
      : page.type === 'article'
        ? `/writing/${page.slug}`
        : `/${page.slug}`
    pages.push({ path: urlPath, priority: page.featured ? '0.8' : '0.6' })
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  pages.push({ path: '/projects/calculator', priority: '0.7' })
}

const entries = [...new Map(pages.map((page) => [page.path, page])).values()]
  .map(({ path: route, priority }) => `  <url><loc>${siteUrl}${route}</loc><priority>${priority}</priority></url>`)
  .join('\n')
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
await writeFile(path.resolve('public/sitemap.xml'), sitemap, 'utf8')
await writeFile(path.resolve('public/robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${siteUrl}/sitemap.xml\n`, 'utf8')
console.log(`Generated sitemap with ${entries.split('\n').length} public URLs.`)
