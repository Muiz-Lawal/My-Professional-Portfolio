import { test, expect } from '@playwright/test'

test('homepage section navigation and mobile menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://127.0.0.1:4317/#home')
  await page.getByRole('button', { name: 'Toggle navigation' }).click()
  await page.getByRole('link', { name: 'About', exact: true }).click()
  await expect(page).toHaveURL(/#about$/)
  await expect(page.locator('#about')).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'false')
})

test('project detail and browser history', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/projects/calculator')
  await expect(page.getByRole('heading', { name: 'Scientific Calculator', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: '← Back' }).click()
  await expect(page).toHaveURL(/\/projects$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/projects\/calculator$/)
})

test('unknown route displays 404', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/definitely-not-a-route')
  await expect(page.getByRole('heading', { name: 'This page isn’t here.' })).toBeVisible()
})

test('admin login and protected route', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/admin')
  await expect(page.getByRole('heading', { name: 'Administrator sign in' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Administrator email' })).toBeVisible()
})

test('managed project renders structured blocks and rejects unsafe media links', async ({ page }) => {
  const project = {
    id: 'block-render-test',
    slug: 'structured-blocks',
    type: 'project',
    title: 'Structured block case study',
    description: 'Public block renderer fixture.',
    content: 'Overview.',
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
    publishedAt: '',
    blocks: [
      { type: 'hero', content: JSON.stringify({ eyebrow: 'Feature', title: 'Structured hero', description: 'A custom block layout.' }) },
      { type: 'text', content: '## Markdown block\n\nReadable **formatted** content.' },
      { type: 'statistics', content: JSON.stringify({ entries: [{ value: '3', label: 'Block groups' }] }) },
      { type: 'timeline', content: JSON.stringify({ heading: 'Build timeline', entries: [{ date: '2026', title: 'First iteration', description: 'Built and reviewed.' }] }) },
      { type: 'faq', content: JSON.stringify({ entries: [{ question: 'Does this render?', answer: 'Yes, it does.' }] }) },
      { type: 'image', content: JSON.stringify({ imageUrl: 'javascript:alert(1)', altText: 'Unsafe image' }) },
      { type: 'cta', content: JSON.stringify({ heading: 'Unsafe link', label: 'Do not open', href: 'javascript:alert(1)' }) },
    ],
  }
  await page.route('**/api/content', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ pages: [project], sections: [], settings: {}, navigation: [], collections: {} }),
  }))
  await page.goto('http://127.0.0.1:4317/projects/structured-blocks')
  await expect(page.getByRole('heading', { name: 'Structured block case study', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Structured hero' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Markdown block' })).toBeVisible()
  await expect(page.getByText('Block groups')).toBeVisible()
  await page.locator('.route-timeline').scrollIntoViewIfNeeded()
  await expect(page.locator('.route-timeline')).toHaveClass(/motion-visible/)
  await expect(page.getByText('Does this render?')).toBeVisible()
  await expect(page.locator('a[href^="javascript:"], img[src^="javascript:"]')).toHaveCount(0)
})

test('admin modules render consistently and remain usable on mobile', async ({ page }) => {
  const sections = ['home', 'about', 'expertise', 'projects', 'experience', 'education', 'contact'].map((id, order) => ({
    id,
    title: `${id} heading`,
    description: 'Section description.',
    visible: true,
    order,
    inNavigation: true,
    imageUrl: '',
    ctaLabel: '',
    ctaHref: '',
  }))
  const testPage = (id, type, title) => ({
    id,
    slug: id,
    type,
    title,
    description: `${title} description`,
    content: `${title} content`,
    status: 'published',
    visibility: 'public',
    inNavigation: false,
    template: type === 'page' ? 'default' : type,
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
    blocks: [],
    publishedAt: '',
    scheduledAt: '',
  })
  const pages = [
    testPage('admin-project-alpha', 'project', 'Alpha project'),
    testPage('admin-project-beta', 'project', 'Beta project'),
    testPage('admin-page-fixture', 'page', 'Fixture page'),
    testPage('admin-article-fixture', 'article', 'Fixture article'),
  ]
  const media = [{ id: 'media-fixture', name: 'media-fixture.pdf', original_name: 'portfolio-guide.pdf', mime_type: 'application/pdf', size: 1024, alt_text: 'Guide', folder: 'public', created_at: '2026-01-01T00:00:00.000Z' }]

  await page.addInitScript(() => sessionStorage.setItem('portfolio_admin_token', 'admin-ui-test-token'))
  await page.route('**/api/content', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ pages, sections, settings: {}, navigation: [], collections: {} }),
  }))
  await page.route('**/api/admin/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    let response = {}
    if (pathname.endsWith('/content')) response = { pages, sections }
    else if (pathname.endsWith('/dashboard')) response = { totals: { publishedProjects: 2, draftProjects: 0, publishedPages: 1, publishedArticles: 1, unreadMessages: 1, media: 1 }, recentContent: pages, recentActivity: [], health: { database: 'operational' } }
    else if (pathname.endsWith('/messages')) response = [{ id: 'message-fixture', name: 'Test sender', email: 'sender@example.test', subject: 'Portfolio question', message: 'A test message body.', status: 'unread', created_at: '2026-01-01T00:00:00.000Z' }]
    else if (pathname.endsWith('/media')) response = media
    else if (pathname.endsWith('/settings')) response = { fullName: 'Muiz Lawal', professionalTitle: 'Developer' }
    else if (pathname.endsWith('/navigation')) response = [{ id: 'nav-fixture', label: 'Home', href: '/#home', position: 0, menu: 'primary', desktop_visible: 1, mobile_visible: 1, external: 0, parent_id: null }]
    else if (pathname.endsWith('/audit')) response = [{ action: 'login_success', actor: 'admin@example.test', details: 'Test login', created_at: '2026-01-01T00:00:00.000Z' }]
    else if (pathname.endsWith('/security/mfa/status')) response = { enabled: false }
    else if (pathname.endsWith('/backup/history')) response = []
    else if (/\/entities\//.test(pathname)) response = [{ id: 'entity-fixture', title: 'Test record', description: 'Record details', status: 'published', position: 0 }]
    else if (pathname.endsWith('/redirects')) response = []
    else if (pathname.endsWith('/integrations')) response = [{ key: 'plausible', enabled: false, status: 'unconfigured', updated_at: '2026-01-01T00:00:00.000Z' }]
    else if (pathname.endsWith('/analytics')) response = { total: 0, popular: [], events: [], configured: false }
    else if (pathname.endsWith('/users')) response = [{ id: 'user-fixture', email: 'admin@example.test', role: 'super_admin', created_at: '2026-01-01T00:00:00.000Z' }]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) })
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://127.0.0.1:4317/admin')
  await expect(page.locator('.admin-page-heading h1')).toHaveText('Dashboard')

  const modules = [
    ['Homepage', 'Homepage & content'],
    ['Projects', 'Projects'],
    ['Pages', 'Pages'],
    ['Articles', 'Articles'],
    ['Experience', 'Experience'],
    ['Education', 'Education'],
    ['Skills', 'Skills'],
    ['Certifications', 'Certifications'],
    ['Testimonials', 'Testimonials'],
    ['Media library', 'Media library'],
    ['Navigation', 'Navigation'],
    ['Appearance', 'Appearance & settings'],
    ['SEO', 'SEO'],
    ['Contact messages', 'Contact messages'],
    ['Analytics', 'Analytics'],
    ['Integrations', 'Integrations'],
    ['Users & permissions', 'Users & permissions'],
    ['Redirects', 'Redirects'],
    ['Security & activity', 'Security & activity'],
    ['Backups', 'Backups'],
  ]
  for (const [label, title] of modules) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.locator('.admin-page-heading h1')).toHaveText(title)
    await expect(page.locator('.admin-panel').first()).toBeVisible()
  }

  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search projects' }).fill('alpha')
  await expect(page.getByRole('heading', { name: 'Alpha project' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Beta project' })).toHaveCount(0)

  await page.getByLabel('Admin theme').selectOption('light')
  await expect(page.locator('.admin-app')).toHaveAttribute('data-theme', 'light')
  await expect(page.evaluate(() => localStorage.getItem('portfolio_admin_theme'))).resolves.toBe('light')

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileNavigation = page.locator('.admin-mobile-nav')
  await expect(mobileNavigation).toBeVisible()
  await mobileNavigation.click()
  await expect(mobileNavigation).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Media library', exact: true }).click()
  await expect(page.locator('.admin-page-heading h1')).toHaveText('Media library')
  await expect(mobileNavigation).toHaveAttribute('aria-expanded', 'false')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(Number.parseFloat(await page.locator('.admin-view').evaluate((element) => getComputedStyle(element).animationDuration))).toBeLessThan(0.001)
})

test('hero ambient motion fades on scroll and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:4317/')
  const orbit = page.locator('.hero-visual .orbit-one')
  await expect(orbit).toBeVisible()
  expect(await orbit.evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
  expect(await page.locator('.expertise-card').first().evaluate((element) => getComputedStyle(element).opacity)).toBe('1')

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.reload()
  await expect(orbit).toBeVisible()
  expect(await orbit.evaluate((element) => getComputedStyle(element).animationName)).toBe('hero-orbit-one')
  expect(await page.locator('.about-section').evaluate((element) => getComputedStyle(element, '::before').animationName)).toBe('ambient-section-drift')
  await page.evaluate(() => window.scrollTo(0, 480))
  await expect.poll(async () => Number(await page.locator('.ambient-hero-field').evaluate((element) => getComputedStyle(element).opacity))).toBeLessThan(1)
  await expect(page.locator('.ambient-hero-field')).toHaveAttribute('data-scroll-depth', 'rest')
  await expect.poll(async () => page.locator('.about-section').evaluate((element) => getComputedStyle(element, '::before').animationPlayState)).toBe('paused')
  await page.goto('http://127.0.0.1:4317/#experience')
  await expect(page.locator('.experience-list')).toHaveClass(/motion-visible/)
})

test('dedicated pages transition and selected links respond gently to pointer movement', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://127.0.0.1:4317/projects/calculator')
  const content = page.locator('.route-content')
  await expect(page.getByRole('heading', { name: 'Scientific Calculator', level: 1 })).toBeVisible()
  expect(await content.evaluate((element) => getComputedStyle(element).animationName)).toBe('public-route-enter')

  const magneticLink = page.locator('.route-actions [data-magnetic]').first()
  await magneticLink.scrollIntoViewIfNeeded()
  const bounds = await magneticLink.boundingBox()
  if (!bounds) throw new Error('Expected the project navigation link to be visible.')
  await page.mouse.move(bounds.x + bounds.width * 0.9, bounds.y + bounds.height * 0.85)
  await expect.poll(async () => magneticLink.evaluate((element) => getComputedStyle(element).translate)).not.toBe('none')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(async () => magneticLink.evaluate((element) => getComputedStyle(element).translate)).toBe('none')
  expect(await content.evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
})
