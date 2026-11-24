import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import { coursework, education, projects } from './App'
import { usePublicContent, type PublicPage } from './lib/content'
import './routes.css'

const routeDescriptions: Record<string, { title: string; description: string }> = {
  '/about': {
    title: 'About Muiz Lawal | Software Developer',
    description: 'Learn about Muiz Lawal’s Computer Science studies, interests in software engineering, AI and cybersecurity, and current learning direction.',
  },
  '/projects': {
    title: 'Projects | Muiz Lawal',
    description: 'Published software projects and engineering case studies by Muiz Lawal.',
  },
  '/writing': {
    title: 'Writing | Muiz Lawal',
    description: 'Planned notes on Linux internals, secure software habits and programming language design.',
  },
  '/certifications': {
    title: 'Courses & Learning | Muiz Lawal',
    description: 'Coursework and ongoing learning listed without claiming unverified certificates or credentials.',
  },
  '/admin': {
    title: 'Private Content Admin | Muiz Lawal',
    description: 'Private portfolio content administration.',
  },
}

function getRouteMetadata(pathname: string) {
  const path = normalizePath(pathname)
  if (routeDescriptions[path]) return routeDescriptions[path]

  const projectMatch = path.match(/^\/projects\/([^/]+)$/)
  if (projectMatch) {
    const project = projects.find((item) => item.id === projectMatch[1] && item.status === 'Built')
    return project
      ? { title: `${project.title} | Projects | Muiz Lawal`, description: project.description }
      : { title: 'Project not found | Muiz Lawal', description: 'The requested project could not be found.' }
  }

  if (path.startsWith('/writing/')) return { title: 'Writing not found | Muiz Lawal', description: 'The requested writing page could not be found.' }

  if (path === '/') {
    return {
      title: 'Muiz Lawal | Software Developer, AI & Cybersecurity Enthusiast',
      description: 'Muiz Lawal — software developer exploring artificial intelligence, cybersecurity and secure systems engineering.',
    }
  }

  return { title: 'Page not found | Muiz Lawal', description: 'The requested page could not be found.' }
}

function normalizePath(pathname: string) {
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/, '')
}

function updateMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

export function RouteSeo() {
  const { pathname } = useLocation()
  const path = normalizePath(pathname)
  const { pages } = usePublicContent()
  const slug = path.startsWith('/projects/') ? path.slice('/projects/'.length)
    : path.startsWith('/writing/') ? path.slice('/writing/'.length)
      : path.startsWith('/') && path !== '/' ? path.slice(1) : ''
  const managedPage = pages.find((page) => page.slug === slug)
  const metadata = managedPage
    ? { title: managedPage.seoTitle || `${managedPage.title} | Muiz Lawal`, description: managedPage.seoDescription || managedPage.description }
    : getRouteMetadata(path)
  const siteUrl = import.meta.env.VITE_SITE_URL?.replace(/\/+$/, '')

  useEffect(() => {
    document.title = metadata.title
    updateMeta('meta[name="description"]', 'name', 'description', metadata.description)
    updateMeta('meta[property="og:title"]', 'property', 'og:title', metadata.title)
    updateMeta('meta[property="og:description"]', 'property', 'og:description', metadata.description)
    updateMeta('meta[property="og:type"]', 'property', 'og:type', managedPage?.type === 'article' || path.startsWith('/writing/') ? 'article' : 'website')
    updateMeta('meta[name="twitter:title"]', 'name', 'twitter:title', metadata.title)
    updateMeta('meta[name="twitter:description"]', 'name', 'twitter:description', metadata.description)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (siteUrl) {
      if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
      }
      canonical.href = `${siteUrl}${path}`
      updateMeta('meta[property="og:url"]', 'property', 'og:url', `${siteUrl}${path}`)
    } else {
      canonical?.remove()
      document.head.querySelector('meta[property="og:url"]')?.remove()
    }
    updateMeta('meta[name="robots"]', 'name', 'robots', path === '/admin' || (slug && !managedPage && !['about', 'projects', 'writing', 'certifications'].includes(path.slice(1))) ? 'noindex,nofollow' : 'index,follow')

    let structuredData = document.head.querySelector<HTMLScriptElement>('script[data-route-jsonld]')
    if (managedPage && siteUrl) {
      if (!structuredData) {
        structuredData = document.createElement('script')
        structuredData.type = 'application/ld+json'
        structuredData.dataset.routeJsonld = 'true'
        document.head.append(structuredData)
      }
      structuredData.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': managedPage.type === 'article' ? 'Article' : managedPage.type === 'project' ? 'SoftwareSourceCode' : 'WebPage',
        name: managedPage.title,
        description: managedPage.description,
        url: `${siteUrl}${path}`,
        author: { '@type': 'Person', name: 'Muiz Lawal' },
        keywords: managedPage.tags.join(', '),
      })
    } else {
      structuredData?.remove()
    }
  }, [metadata.description, metadata.title, managedPage, path, siteUrl, slug])

  return null
}

function PageIntro({ label, title, description }: { label: string; title: ReactNode; description: string }) {
  return (
    <header className="route-intro">
      <p className="section-index">{label}</p>
      <h1>{title}</h1>
      <p className="route-intro-copy">{description}</p>
    </header>
  )
}

function ManagedCard({ page }: { page: PublicPage }) {
  const href = page.type === 'project' ? `/projects/${page.slug}` : page.type === 'article' ? `/writing/${page.slug}` : `/${page.slug}`
  const readingMinutes = Math.max(1, Math.ceil(page.content.trim().split(/\s+/).filter(Boolean).length / 200))
  return (
    <article className="route-card">
      <div className="route-card-meta"><span>{page.category || page.type}</span><span>{page.type === 'article' ? `${page.publishedAt || 'Date pending'} · ${readingMinutes} min` : page.featured ? 'Featured' : 'Published'}</span></div>
      <h2>{page.title}</h2><p>{page.description}</p>
      <div className="tag-row">{page.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      <Link className="route-card-link" data-magnetic to={href}>Explore <span aria-hidden="true">→</span></Link>
    </article>
  )
}

function parseBlockContent(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    return { description: content }
  }
  return { description: content }
}

function blockText(data: Record<string, unknown>, key: string) {
  return typeof data[key] === 'string' ? data[key] as string : ''
}

function blockEntries(data: Record<string, unknown>) {
  return Array.isArray(data.entries)
    ? data.entries.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    : []
}

function blockHref(value: unknown) {
  if (typeof value !== 'string') return ''
  if ((value.startsWith('/') && !value.startsWith('//')) || /^https:\/\//i.test(value) || /^mailto:/i.test(value)) return value
  return ''
}

function BlockLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  if (!href) return null
  return href.startsWith('/') ? <Link className={className} data-magnetic={className?.includes('primary-button') || undefined} to={href}>{children}</Link> : <a className={className} data-magnetic={className?.includes('primary-button') || undefined} href={href} target="_blank" rel="noreferrer">{children}</a>
}

function ManagedBlock({ block, pages }: { block: NonNullable<PublicPage['blocks']>[number]; pages: PublicPage[] }) {
  const data = parseBlockContent(block.content)
  const heading = blockText(data, 'heading')
  const description = blockText(data, 'description')
  const entries = blockEntries(data)
  const images = Array.isArray(data.images) ? data.images.filter((url): url is string => typeof url === 'string') : []
  const slugs = Array.isArray(data.slugs) ? data.slugs.filter((slug): slug is string => typeof slug === 'string') : []

  if (block.type === 'hero') return (
    <section className="route-block route-block-hero">
      {blockText(data, 'eyebrow') && <p className="section-index">{blockText(data, 'eyebrow')}</p>}
      <h2>{blockText(data, 'title') || ' '}</h2><p>{description}</p>
      <div className="route-actions"><BlockLink className="primary-button" href={blockHref(data.primaryHref)}>{blockText(data, 'primaryLabel')}</BlockLink><BlockLink className="text-button" href={blockHref(data.secondaryHref)}>{blockText(data, 'secondaryLabel')}</BlockLink></div>
    </section>
  )
  if (block.type === 'text') return <section className="route-prose"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize, rehypeHighlight]}>{description}</ReactMarkdown></section>
  if (block.type === 'image') {
    const src = blockHref(data.imageUrl)
    return src ? <figure className="route-block-image"><img src={src} alt={blockText(data, 'altText')} loading="lazy"/>{blockText(data, 'caption') && <figcaption>{blockText(data, 'caption')}</figcaption>}</figure> : null
  }
  if (block.type === 'gallery') return (
    <section className="route-block"><div className="route-gallery">{images.map((line,index)=>{
      const [rawUrl, ...captionParts] = line.split('|')
      const src = blockHref(rawUrl.trim())
      return src ? <figure key={`${src}-${index}`}><img src={src} alt={captionParts[0]?.trim()||''} loading="lazy"/>{captionParts.length>0&&<figcaption>{captionParts.join('|').trim()}</figcaption>}</figure> : null
    })}</div></section>
  )
  if (block.type === 'video') {
    const src = blockHref(data.videoUrl)
    return src ? <figure className="route-block-video"><video controls preload="metadata" src={src}/>{description && <figcaption>{description}</figcaption>}</figure> : null
  }
  if (block.type === 'projects') return (
    <section className="route-related">{heading && <h2>{heading}</h2>}<div className="route-card-grid">{pages.filter((page)=>page.type==='project'&&slugs.includes(page.slug)).map((page)=><ManagedCard key={page.id} page={page}/>)}</div></section>
  )
  if (block.type === 'statistics') return (
    <section className="route-block">{heading && <h2>{heading}</h2>}<div className="route-fact-grid">{entries.map((entry,index)=><article key={index}><strong>{String(entry.value||'')}</strong><p>{String(entry.label||'')}</p></article>)}</div></section>
  )
  if (block.type === 'timeline') return (
    <section className="route-block">{heading && <h2>{heading}</h2>}<div className="route-timeline" data-motion-timeline>{entries.map((entry,index)=><article key={index}><small>{String(entry.date||'')}</small><h3>{String(entry.title||'')}</h3><p>{String(entry.description||'')}</p></article>)}</div></section>
  )
  if (block.type === 'testimonials') return (
    <section className="route-block">{heading && <h2>{heading}</h2>}<div className="route-card-grid">{entries.map((entry,index)=><blockquote className="route-card" key={index}><p>{String(entry.quote||'')}</p><footer><strong>{String(entry.name||'')}</strong>{typeof entry.role === 'string' && entry.role && <span> · {entry.role}</span>}</footer></blockquote>)}</div></section>
  )
  if (block.type === 'cards') return (
    <section className="route-related">{heading && <h2>{heading}</h2>}<div className="route-card-grid">{entries.map((entry,index)=><article className="route-card" key={index}><h3>{String(entry.title||'')}</h3><p>{String(entry.description||'')}</p><BlockLink className="route-card-link" href={blockHref(entry.href)}>Learn more →</BlockLink></article>)}</div></section>
  )
  if (block.type === 'cta') return (
    <section className="route-block route-block-cta"><h2>{heading}</h2><p>{description}</p><BlockLink className="primary-button" href={blockHref(data.href)}>{blockText(data, 'label')}</BlockLink></section>
  )
  if (block.type === 'download') return (
    <section className="route-block"><p>{description}</p><BlockLink className="primary-button" href={blockHref(data.href)}>{blockText(data, 'label')||'Download'}</BlockLink></section>
  )
  if (block.type === 'buttons') return (
    <section className="route-block">{heading && <h2>{heading}</h2>}<div className="route-actions">{entries.map((entry,index)=><BlockLink key={index} className="primary-button" href={blockHref(entry.href)}>{String(entry.label||'Open link')}</BlockLink>)}</div></section>
  )
  if (block.type === 'code') return <section className="route-prose"><h2>{blockText(data, 'language')||'Code'}</h2><pre><code>{blockText(data, 'code')||block.content}</code></pre></section>
  if (block.type === 'faq') return (
    <section className="route-block">{heading && <h2>{heading}</h2>}{entries.map((entry,index)=><details className="route-faq-item" key={index}><summary>{String(entry.question||'')}</summary><p>{String(entry.answer||'')}</p></details>)}</section>
  )
  if (block.type === 'contact') {
    const email = blockText(data, 'email')
    return <section className="route-block route-block-cta"><h2>{heading}</h2><p>{description}</p>{email&&<a className="primary-button" href={`mailto:${email}`}>Email {email}</a>}</section>
  }
  return null
}

function ManagedDetail({ page }: { page: PublicPage }) {
  const { pages } = usePublicContent()
  const href = page.type === 'project' ? page.repositoryUrl : ''
  const relatedPages = pages.filter((candidate) => page.relatedSlugs?.includes(candidate.slug))
  const readingMinutes = Math.max(1, Math.ceil(page.content.trim().split(/\s+/).filter(Boolean).length / 200))
  return (
    <article className="route-content">
      <PageIntro label={`${page.type} / ${page.category || 'Portfolio'}`} title={page.title} description={page.description} />
      {page.mediaUrls.length > 0 && <div className="route-media">{page.mediaUrls.map((src) => <img key={src} src={src} alt={`${page.title} project media`} loading="lazy" />)}</div>}
      <section className="route-prose"><h2>Overview</h2><p>{page.content}</p></section>
      {page.blocks?.map((block,index) => <ManagedBlock key={`${block.type}-${index}`} block={block} pages={pages}/>)}
      {page.type === 'project' && <div className="route-prose-grid">
        {page.problem && <section><h2>Problem</h2><p>{page.problem}</p></section>}
        {page.objectives && <section><h2>Objectives</h2><p>{page.objectives}</p></section>}
        {page.role && <section><h2>Role & contributions</h2><p>{page.role}</p></section>}
        {page.implementation && <section><h2>Implementation</h2><p>{page.implementation}</p></section>}
        {page.challenges && <section><h2>Challenges & solutions</h2><p>{page.challenges}</p></section>}
        {page.outcomes && <section><h2>Outcomes</h2><p>{page.outcomes}</p></section>}
      </div>}
      {page.type === 'article' && <p className="route-status">{page.publishedAt ? <time dateTime={page.publishedAt}>{page.publishedAt}</time> : 'Publication date not set'} · {readingMinutes} min read</p>}
      {page.tags.length > 0 && <div className="tag-row">{page.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      <div className="route-actions">
        <Link className="text-button" data-magnetic to={page.type === 'project' ? '/projects' : page.type === 'article' ? '/writing' : '/'}>← Back</Link>
        {href && <a className="primary-button" data-magnetic href={href} target="_blank" rel="noreferrer">Repository ↗</a>}
        {page.liveUrl && <a className="primary-button" data-magnetic href={page.liveUrl} target="_blank" rel="noreferrer">Live demo ↗</a>}
      </div>
      {relatedPages.length > 0 && <section className="route-related"><h2>Related {page.type === 'article' ? 'articles' : 'projects'}</h2><div className="route-card-grid">{relatedPages.map((related) => <ManagedCard key={related.id} page={related} />)}</div></section>}
    </article>
  )
}

function ProjectDetail({ slug }: { slug: string }) {
  const project = projects.find((item) => item.id === slug && item.status === 'Built')
  if (!project) return <NotFoundPage kind="project" />

  return (
    <article className="route-content">
      <PageIntro label={`Project / ${project.index} · ${project.status}`} title={project.title} description={project.description} />
      {project.caseStudy ? (
        <>
          <div className="route-fact-grid">
            <section><h2>Role</h2><p>{project.caseStudy.role}</p></section>
            <section><h2>Overview</h2><p>{project.caseStudy.overview}</p></section>
          </div>
          <div className="route-prose-grid">
            <section><h2>Architecture</h2><p>{project.caseStudy.architecture}</p></section>
            <section><h2>Engineering decisions</h2><p>{project.caseStudy.decisions}</p></section>
            <section><h2>Challenge</h2><p>{project.caseStudy.challenges}</p></section>
          </div>
          <div className="route-feature-list"><h2>Features</h2>{project.caseStudy.features.map((feature) => <span key={feature}>{feature}</span>)}</div>
        </>
      ) : (
        <section className="route-prose">
          <h2>Project status</h2>
          <p>This entry describes a product direction, not a verified implementation. The available information does not establish a completed build or feature set.</p>
        </section>
      )}
      <div className="route-actions">
        <Link className="text-button" data-magnetic to="/projects">← All projects</Link>
        <a className="primary-button" data-magnetic href={project.href} target="_blank" rel="noreferrer">View repository <span aria-hidden="true">↗</span></a>
      </div>
    </article>
  )
}

export function RoutePage({ pathname }: { pathname: string }) {
  const path = normalizePath(pathname)
  const { pages, loading: contentLoading, error: contentError } = usePublicContent()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const slug = path.startsWith('/projects/') ? path.slice('/projects/'.length)
    : path.startsWith('/writing/') ? path.slice('/writing/'.length)
      : path.startsWith('/') && path !== '/' ? path.slice(1) : ''
  const managedPage = pages.find((page) => page.slug === slug)

  if (path === '/about') {
    const managedAbout = pages.find((page) => page.type === 'page' && page.slug === 'about')
    if (managedAbout) return <ManagedDetail page={managedAbout} />
    return (
      <article className="route-content">
        <PageIntro label="About" title={<>Curious mind.<br /><span>Engineering purpose.</span></>} description="I’m developing a deep foundation in computing while turning ideas into working software." />
        <div className="route-fact-grid">
          <section><h2>My direction</h2><p>I study Computer Science at Obafemi Awolowo University, building my understanding of algorithms, systems, mathematics and software engineering. Outside the classroom, I explore Linux, Android development, artificial intelligence and cybersecurity.</p></section>
          <section><h2>Current focus</h2><p>My direction is to become a Secure AI Systems Engineer: building intelligent systems that are useful, reliable and designed with security in mind.</p><p><strong>{education.programme}</strong><br />{education.institution} · {education.location}</p></section>
        </div>
      </article>
    )
  }

  if (path === '/projects') {
    const publishedProjects = pages.filter((page) => page.type === 'project')
    const projectEntries = publishedProjects.length
      ? publishedProjects
      : contentLoading || contentError ? projects.filter((project) => project.status === 'Built').map((project) => ({ ...project, slug: project.id, publishedAt: '', content: project.description, type: 'project' as const, visibility: 'public' as const, status: 'published' as const, inNavigation: false, template: 'project' as const, seoTitle: '', seoDescription: '', category: project.type, repositoryUrl: project.href, liveUrl: '', mediaUrls: [] })) : []
    const categories = [...new Set(projectEntries.map((project) => project.category).filter(Boolean))]
    const filteredProjects = projectEntries.filter((project) => {
      const matchesQuery = `${project.title} ${project.description} ${project.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())
      return matchesQuery && (category === 'all' || project.category === category) && (!featuredOnly || project.featured)
    })
    return (
      <section className="route-content">
        <PageIntro label="Selected work" title={<>Projects built<br /><span>with intent.</span></>} description="Published implementations, engineering decisions and verified project details." />
        <div className="directory-controls"><label>Search projects<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, tags or description" /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="directory-check"><input type="checkbox" checked={featuredOnly} onChange={(event) => setFeaturedOnly(event.target.checked)} /> Featured only</label></div>
        <div className="route-card-grid">{filteredProjects.map((project) => <ManagedCard key={project.id} page={project} />)}</div>
        {filteredProjects.length === 0 && <p className="route-empty" role="status">{projectEntries.length ? 'No projects match this search.' : 'No projects have been published yet.'}</p>}
      </section>
    )
  }

  if (path.startsWith('/projects/')) {
    if (managedPage?.type === 'project') return <ManagedDetail page={managedPage} />
    if (!contentLoading && !contentError) return <NotFoundPage kind="project" />
    return <ProjectDetail slug={path.slice('/projects/'.length)} />
  }

  if (path === '/writing') {
    const publishedArticles = pages.filter((page) => page.type === 'article')
    const articleEntries = publishedArticles.length ? publishedArticles : []
    const filteredArticles = articleEntries.filter((article) => `${article.title} ${article.description} ${article.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (category === 'all' || article.category === category))
    return (
      <section className="route-content">
        <PageIntro label="Notes & writing" title={<>Ideas worth<br /><span>documenting.</span></>} description="Long-form writing is being prepared around systems, security, AI and the craft of software engineering." />
        <div className="directory-controls"><label>Search articles<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search published writing" /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{[...new Set(articleEntries.map((article) => article.category).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select></label></div>
        <div className="route-card-grid">{filteredArticles.map((article) => <ManagedCard key={article.id} page={article} />)}</div>
        {filteredArticles.length === 0 && <p className="route-empty" role="status">{articleEntries.length ? 'No published articles match this search.' : 'No articles have been published yet. Drafts remain private.'}</p>}
      </section>
    )
  }

  if (path.startsWith('/writing/')) return managedPage?.type === 'article' ? <ManagedDetail page={managedPage} /> : <NotFoundPage kind="writing" />

  if (path === '/certifications') {
    return (
      <section className="route-content">
        <PageIntro label="Professional development" title={<>Courses &<br /><span>continuous learning.</span></>} description="Coursework is presented without overstating completion or credentials until exact certificates and verification links are confirmed." />
        <div className="route-card-grid">{coursework.map(([issuer, course, status]) => (
          <article className="route-card" key={course}>
            <div className="route-card-meta"><span>{issuer}</span><span>{status}</span></div>
            <h2>{course}</h2><p>Coursework or study listed for professional development. Certificate completion and verification have not been confirmed.</p>
            <span className="route-status">Verification pending</span>
          </article>
        ))}</div>
      </section>
    )
  }

  if (path.startsWith('/') && path !== '/' && !path.includes('/')) {
    if (managedPage?.type === 'page') return <ManagedDetail page={managedPage} />
  }

  if (managedPage?.type === 'page') return <ManagedDetail page={managedPage} />

  return <NotFoundPage />
}

export function NotFoundPage({ kind = 'page' }: { kind?: string }) {
  return (
    <section className="route-content not-found-page">
      <PageIntro label="404 / Not found" title="This page isn’t here." description={`The ${kind} you requested could not be found.`} />
      <Link className="primary-button" data-magnetic to="/">Return home <span aria-hidden="true">→</span></Link>
    </section>
  )
}
