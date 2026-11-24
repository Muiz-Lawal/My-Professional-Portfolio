import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'

const outputDirectory = path.resolve('dist')
const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '')
let content = { pages: [], sections: [] }

try {
  const stored = JSON.parse(await readFile(path.resolve(process.env.DATA_DIR || 'data/portfolio-content.json'), 'utf8'))
  content = {
    pages: (stored.pages || []).filter((page) => page.status === 'published' && page.visibility === 'public'),
    sections: stored.sections || [],
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const routes = new Set(['/', '/about', '/projects', '/projects/calculator', '/writing', '/certifications'])
for (const page of content.pages) {
  routes.add(page.type === 'project'
    ? `/projects/${page.slug}`
    : page.type === 'article'
      ? `/writing/${page.slug}`
      : `/${page.slug}`)
}

const routeMetadata = {
  '/': ['Muiz Lawal | Software Developer, AI & Cybersecurity Enthusiast', 'Muiz Lawal — software developer exploring artificial intelligence, cybersecurity and secure systems engineering.'],
  '/about': ['About Muiz Lawal | Software Developer', 'Learn about Muiz Lawal’s Computer Science studies, software engineering interests and direction toward secure AI systems.'],
  '/projects': ['Projects | Muiz Lawal', 'Published software projects and engineering case studies by Muiz Lawal.'],
  '/writing': ['Writing | Muiz Lawal', 'Technical writing on systems, security, AI and software engineering.'],
  '/certifications': ['Courses & Learning | Muiz Lawal', 'Coursework and ongoing learning listed without claiming unverified certificates or credentials.'],
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character])

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const [{ StaticRouter }, { ContentProvider }, appModule] = await Promise.all([
    import('react-router'),
    server.ssrLoadModule('/src/lib/content.ts'),
    server.ssrLoadModule('/src/App.tsx'),
  ])
  const { default: App, projects } = appModule
  const template = await readFile(path.join(outputDirectory, 'index.html'), 'utf8')

  for (const route of routes) {
    const markup = renderToString(createElement(StaticRouter, { location: route },
      createElement(ContentProvider, { initialContent: content }, createElement(App))))
    const [defaultTitle, defaultDescription] = routeMetadata[route] || [
      `${content.pages.find((page) => route.endsWith(`/${page.slug}`))?.title || 'Portfolio'} | Muiz Lawal`,
      content.pages.find((page) => route.endsWith(`/${page.slug}`))?.description || 'Portfolio content by Muiz Lawal.',
    ]
    const page = content.pages.find((item) => route === `/${item.slug}` || route === `/projects/${item.slug}` || route === `/writing/${item.slug}`)
    const project = route.startsWith('/projects/') ? projects.find((item) => `/projects/${item.id}` === route) : undefined
    const title = page?.seoTitle || (page ? `${page.title} | Muiz Lawal` : project ? `${project.title} | Projects | Muiz Lawal` : defaultTitle)
    const description = page?.seoDescription || page?.description || project?.description || defaultDescription
    const canonical = siteUrl ? `<link rel="canonical" href="${escapeHtml(siteUrl + route)}" />` : ''
    const schema = {
      '@context': 'https://schema.org',
      '@type': page
        ? page.type === 'article' ? 'Article' : page.type === 'project' ? 'SoftwareSourceCode' : 'WebPage'
        : project ? 'SoftwareSourceCode' : route.startsWith('/writing/') ? 'Article' : 'WebPage',
      name: page?.title || project?.title || title,
      description: page?.description || description,
      ...(siteUrl ? { url: `${siteUrl}${route}` } : {}),
      author: { '@type': 'Person', name: 'Muiz Lawal' },
      ...(page?.tags?.length ? { keywords: page.tags.join(', ') } : {}),
    }
    const routeDataAttribute = page ? ' data-route-jsonld="true"' : ' data-static-jsonld="true"'
    const jsonLd = route === '/' ? '' : `<script type="application/ld+json"${routeDataAttribute}>${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`
    const contentScript = `<script>window.__PORTFOLIO_CONTENT__=${JSON.stringify(content).replace(/</g, '\\u003c')};window.__PRERENDERED_PATH__=${JSON.stringify(route)};</script>`
    let html = template
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
      .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
      .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`)
      .replace(/<meta property="og:type" content="[^"]*" \/>/, `<meta property="og:type" content="${page?.type === 'article' || route.startsWith('/writing/') ? 'article' : 'website'}" />`)
      .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
      .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
      .replace('</head>', `${canonical}${jsonLd}${contentScript}</head>`)

    const rootStart = html.indexOf('<div id="root">')
    const bodyEnd = html.indexOf('</body>', rootStart)
    const rootEnd = html.lastIndexOf('</div>', bodyEnd)
    if (rootStart < 0 || bodyEnd < 0 || rootEnd < 0) throw new Error(`Could not locate the app root in dist/index.html for ${route}.`)
    html = `${html.slice(0, rootStart)}<div id="root">${markup}</div>${html.slice(rootEnd + '</div>'.length)}`

    const relativeDirectory = route === '/' ? '' : route.slice(1)
    const destination = path.join(outputDirectory, relativeDirectory)
    await mkdir(destination, { recursive: true })
    await writeFile(path.join(destination, 'index.html'), html, 'utf8')
  }
  console.log(`Pre-rendered ${routes.size} public routes.`)
} finally {
  await server.close()
}
