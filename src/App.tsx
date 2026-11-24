import { lazy, Suspense, useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { motion } from 'motion/react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { initializeAnalytics, trackEvent } from './lib/analytics'
import { usePublicContent } from './lib/content'
import { NotFoundPage, RoutePage, RouteSeo } from './RoutePages'
import { AmbientHero } from './components/AmbientHero'
import './App.css'
import './styles/ambient-motion.css'

const AdminDashboard = lazy(() => import('./AdminDashboard').then((module) => ({ default: module.AdminDashboard })))

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.66.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.72 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 7.03c.85 0 1.7.12 2.5.35 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.95-2.34 4.81-4.58 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.13 10.13 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z"/></svg>
)

const CURRENT_YEAR = new Date().getFullYear()

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 7.8H1.9V22h3.3V7.8ZM3.55 2A2 2 0 1 0 3.5 6a2 2 0 0 0 .05-4ZM22 13.7c0-4.25-2.27-6.22-5.29-6.22-2.44 0-3.53 1.34-4.14 2.28V7.8H9.24V22h3.33v-7.03c0-1.86.35-3.66 2.66-3.66 2.27 0 2.3 2.12 2.3 3.78V22H22v-8.3Z"/></svg>
)

const ArrowIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5"/></svg>
)

interface CaseStudy {
  role: string
  overview: string
  architecture: string
  decisions: string
  challenges: string
  features: string[]
}

interface Project {
  id: string
  index: string
  title: string
  type: string
  status: string
  description: string
  tags: string[]
  href: string
  featured: boolean
  caseStudy?: CaseStudy
}

interface TerminalEntry {
  command: string
  output: string
}

export const expertise = [
  { number: '01', title: 'Software Engineering', text: 'Building practical products with thoughtful architecture, maintainable code and reliable delivery.', tags: ['Python', 'JavaScript', 'TypeScript', 'React'] },
  { number: '02', title: 'AI & Machine Learning', text: 'Exploring intelligent systems, model behavior and how to integrate AI responsibly into real products.', tags: ['Python', 'ML foundations', 'AI apps', 'Model security'] },
  { number: '03', title: 'Cybersecurity', text: 'Learning to identify weaknesses and engineer systems that protect users, data and infrastructure.', tags: ['Linux', 'Networking', 'AppSec', 'Security testing'] },
]

export const experience = [
  { index: '01', title: 'Innovation Syndicate', role: 'Innovation & technology involvement', description: 'Participates in an initiative focused on identifying problems, sharing ideas and developing practical solutions with technology.', status: 'Initiative' },
  { index: '02', title: 'Educational technology', role: 'Developer & student educator', description: 'Builds educational software ideas and teaches introductory Python concepts to a young learner.', status: 'Ongoing' },
  { index: '03', title: 'University technology activities', role: 'Technical collaboration & publicity', description: 'Contributes to technology activities and has supported communication and publicity materials for university community initiatives.', status: 'Activity' },
]

export const education = {
  institution: 'Obafemi Awolowo University', programme: 'BSc Computer Science', location: 'Nigeria', period: 'Five-year programme', note: 'Building foundations in algorithms, mathematics, software engineering, computer systems and artificial intelligence.', coursework: ['Algorithms & data structures', 'Discrete mathematics', 'Programming', 'Computer systems', 'Software engineering']
}

export const learningInterests = [
  ['Secure AI Systems', 'Developing, evaluating and protecting intelligent systems.'],
  ['Adversarial Machine Learning', 'Understanding model behavior under adversarial conditions and improving robustness.'],
  ['Cybersecurity Engineering', 'Application security, networking, system security and security architecture.'],
  ['Programming Languages', 'Language design, interpreters, compilers and programming paradigms.'],
  ['Robotics & Autonomous Systems', 'Embedded development and intelligent physical systems.'],
  ['Blockchain & Distributed Systems', 'Trust, decentralized architecture and distributed computing.'],
]

export const projects: Project[] = [
  { id: 'calculator', index: '01', title: 'Scientific Calculator', type: 'Android Application', status: 'Built', description: 'A Kotlin Android application developed for university coursework, featuring expression evaluation, matrix operations, statistics, history and a responsive calculator interface.', tags: ['Kotlin', 'Android', 'exp4j'], href: 'https://github.com/Muiz-Lawal/SEN104-Basic-Scientific-Calculator', featured: true, caseStudy: { role: 'Solo coursework project', overview: 'A mobile scientific calculator that moves beyond basic arithmetic by supporting expression evaluation, matrix tools and descriptive statistics.', architecture: 'The app uses Kotlin activities and Android XML layouts. SharedPreferences records calculation history, while exp4j handles expression parsing and evaluation.', decisions: 'Separate activities and screens keep matrix, statistics and calculator workflows distinct. Material components provide a consistent interface across screen orientations.', challenges: 'The implementation combines expression parsing, matrix layout, data formatting and persistent history in a responsive mobile interface.', features: ['Scientific expressions', 'Matrix operations', 'Statistical calculations', 'Calculation history', 'Landscape layouts'] } },
]

export const coursework = [
  ['Google', 'Introduction to Git and GitHub', 'Coursework'],
  ['University of Michigan', 'Python Data Structures', 'Coursework'],
  ['Udemy', 'Complete Python course', 'Coursework'],
  ['ZTM', 'Complete Ethical Hacking Bootcamp', 'Coursework'],
  ['Self-directed', 'Linux operating systems', 'Ongoing study'],
  ['Arduino', 'Intermediate development', 'Coursework'],
]

function App() {
  const location = useLocation()
  const pathname = location.pathname.replace(/\/+$/, '') || '/'
  const { pages: managedPages, sections: managedSections, navigation: managedNavigation, settings: managedSettings, collections: managedCollections, loading: contentLoading, error: contentError } = usePublicContent()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('home')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [contactStatus, setContactStatus] = useState('')
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalHistory, setTerminalHistory] = useState<TerminalEntry[]>([{ command: '', output: 'Type “help” to explore.' }])
  const sectionSettings = (id: string, defaultOrder: number) => {
    const section = managedSections.find((item) => item.id === id)
    return {
      hidden: section ? !section.visible : false,
      style: { order: section?.order ?? defaultOrder },
      'data-managed-section': true as const,
    }
  }
  const sectionImage = (id: string, alt: string) => {
    const imageUrl = managedSections.find((section) => section.id === id)?.imageUrl
    return imageUrl ? <img className={id === 'home' ? 'hero-managed-image' : 'section-managed-image'} src={imageUrl} alt={alt} loading="lazy" /> : null
  }
  const sectionCta = (id: string, defaultHref = '', defaultLabel = '') => {
    const section = managedSections.find((item) => item.id === id)
    const href = section?.ctaHref || defaultHref
    const label = section?.ctaLabel || defaultLabel
    return href && label ? <a className="text-button" data-magnetic href={href}>{label} <span aria-hidden="true">↗</span></a> : null
  }
  const homepageProjects: Project[] = managedPages.some((page) => page.type === 'project')
    ? managedPages.filter((page) => page.type === 'project').map((page, index) => ({
      id: page.slug,
      index: String(index + 1).padStart(2, '0'),
      title: page.title,
      type: page.category || 'Project',
      status: page.featured ? 'Featured' : 'Published',
      description: page.description,
      tags: page.tags,
      href: page.repositoryUrl || page.liveUrl || `/projects/${page.slug}`,
      featured: page.featured,
      caseStudy: projects.find((project) => project.id === page.slug)?.caseStudy,
    }))
    : contentLoading || contentError ? projects.filter((project) => project.status === 'Built') : []

  useEffect(() => {
    initializeAnalytics()
  }, [])

  useEffect(() => {
    if (typeof managedSettings?.primaryColor === 'string') {
      document.documentElement.style.setProperty('--violet', managedSettings.primaryColor)
    }
  }, [managedSettings?.primaryColor])

  useEffect(() => {
    if (location.pathname !== '/') return
    const hash = decodeURIComponent(location.hash.slice(1))
    if (!hash) return
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView())
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (pathname === '/admin' || !('IntersectionObserver' in window)) return

    const root = document.querySelector<HTMLElement>(pathname === '/' ? '.homepage-sections' : '.route-content')
    if (!root) return

    const revealElements = (pathname === '/'
      ? Array.from(root.querySelectorAll<HTMLElement>('[data-motion-reveal], [data-motion-timeline]'))
      : [
        ...Array.from(root.children).filter((element): element is HTMLElement => element instanceof HTMLElement && !element.classList.contains('route-intro')),
        ...Array.from(root.querySelectorAll<HTMLElement>('.route-card, .route-timeline, .route-gallery figure, .route-media img, .route-fact-grid > section, .route-prose-grid > section, .route-feature-list > span')),
      ]).filter((element, index, elements) => !element.classList.contains('motion-visible') && elements.indexOf(element) === index)
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!revealElements.length || motionPreference.matches) return

    const reveal = (element: HTMLElement) => {
      element.classList.remove('motion-pending')
      element.classList.add('motion-visible')
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        reveal(entry.target as HTMLElement)
        observer.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

    revealElements.forEach((element) => {
      element.classList.add('motion-pending')
      observer.observe(element)
    })
    const disableReveals = () => {
      if (!motionPreference.matches) return
      revealElements.forEach(reveal)
      observer.disconnect()
    }
    motionPreference.addEventListener('change', disableReveals)

    return () => {
      observer.disconnect()
      motionPreference.removeEventListener('change', disableReveals)
    }
  }, [pathname, managedPages.length, managedCollections?.skills?.length, managedCollections?.experience?.length, managedCollections?.education?.length, managedCollections?.certifications?.length])

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return

    let activeTarget: HTMLElement | null = null
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reset = () => {
      activeTarget?.style.removeProperty('translate')
      activeTarget = null
    }
    const magnetize = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || motionPreference.matches) {
        reset()
        return
      }

      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-magnetic]') : null
      if (!target) {
        reset()
        return
      }
      if (activeTarget !== target) reset()
      activeTarget = target
      const bounds = target.getBoundingClientRect()
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
      target.style.translate = `${x * 4}px ${y * 3}px`
    }
    const resetForReducedMotion = () => {
      if (motionPreference.matches) reset()
    }

    document.addEventListener('pointermove', magnetize, { passive: true })
    motionPreference.addEventListener('change', resetForReducedMotion)
    return () => {
      document.removeEventListener('pointermove', magnetize)
      motionPreference.removeEventListener('change', resetForReducedMotion)
      reset()
    }
  }, [])

  useEffect(() => {
    const sections = ['home', 'about', 'expertise', 'projects', 'experience', 'education', 'contact']
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.isIntersecting && setActiveSection(entry.target.id))
    }, { rootMargin: '-35% 0px -55%', threshold: 0 })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [pathname])

  useEffect(() => {
    if (!selectedProject) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: globalThis.KeyboardEvent) => event.key === 'Escape' && setSelectedProject(null)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selectedProject])

  const runTerminalCommand = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const command = terminalInput.trim().toLowerCase()
    if (!command) return

    const responses: Record<string, string> = {
      help: 'Available: help, about, skills, projects, education, experience, contact, github, clear',
      about: 'Muiz Lawal studies Computer Science at OAU and is developing toward secure AI systems engineering.',
      skills: 'Python, JavaScript, TypeScript, React, Kotlin, Linux, networking and application-security foundations.',
      projects: 'Scientific Calculator is the currently published project in this portfolio.',
      education: 'Computer Science at Obafemi Awolowo University, Nigeria; five-year programme.',
      experience: 'Innovation Syndicate, educational technology and university technology activities.',
      contact: 'Email: abdulmuizlawal208@gmail.com',
      github: 'https://github.com/Muiz-Lawal',
    }

    if (command === 'clear') {
      setTerminalHistory([])
    } else {
      const output = responses[command] || `Command not found: ${terminalInput.trim()}. Type “help”.`
      setTerminalHistory((history) => [...history, { command: terminalInput.trim(), output }])
    }
    setTerminalInput('')
  }

  const closeMenu = () => setMenuOpen(false)

  const submitContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') || '').trim()
    const email = String(data.get('email') || '').trim()
    const subjectText = String(data.get('subject') || '').trim()
    const message = String(data.get('message') || '').trim()

    if (!name || !email || !subjectText || !message) {
      setContactStatus('Complete every field before opening your email draft.')
      return
    }

    setContactStatus('Sending…')
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5057'
      const response = await fetch(`${apiUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject: subjectText, message, website: String(data.get('website') || '') }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'The message could not be sent.')
      setContactStatus('Message sent successfully.')
      trackEvent('Contact Form Success')
      event.currentTarget.reset()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The message could not be sent.'
      setContactStatus(`${message} You can also email abdulmuizlawal208@gmail.com directly.`)
    }
  }

  if (pathname === '/admin') {
    return <Suspense fallback={<section className="route-content"><p role="status">Loading secure admin…</p></section>}><AdminDashboard /></Suspense>
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="nav-shell">
        <nav className="nav" aria-label="Primary navigation">
          <Link className="brand" to="/#home" aria-label={`${String(managedSettings?.fullName || 'Muiz Lawal')} home`} onClick={closeMenu}>{String(managedSettings?.brandName || 'MU')}<span>.</span></Link>
          <button className="menu-button" type="button" aria-expanded={menuOpen} aria-controls="nav-links" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>
            <span></span><span></span>
          </button>
          <div id="nav-links" className={`nav-links ${menuOpen ? 'open' : ''}`}>
            {[
              ['home', 'Home'],
              ['about', 'About'],
              ['expertise', 'Expertise'],
              ['projects', 'Projects'],
              ['experience', 'Experience'],
              ['education', 'Education'],
              ['contact', 'Contact'],
            ].filter(([section]) => {
              const settings = managedSections.find((item) => item.id === section)
              return settings?.inNavigation !== false && settings?.visible !== false
            }).map(([section, label]) => (
              <Link key={section} className={pathname === '/' && activeSection === section ? 'active' : ''} aria-current={pathname === '/' && activeSection === section ? 'location' : undefined} to={`/#${section}`} onClick={() => { closeMenu(); trackEvent('Navigation Click', { section }) }}>{label}</Link>
            ))}
            {managedPages.filter((page) => page.inNavigation).map((page) => (
              <Link key={page.id} to={page.type === 'project' ? `/projects/${page.slug}` : page.type === 'article' ? `/writing/${page.slug}` : `/${page.slug}`} onClick={closeMenu}>{page.title}</Link>
            ))}
            {managedNavigation?.filter((item) => !item.parent_id && (item.mobile_visible === 1 || item.desktop_visible === 1)).map((item) => {
              const children = managedNavigation?.filter((child) => child.parent_id === item.id && (child.mobile_visible === 1 || child.desktop_visible === 1)) || []
              return children.length
                ? <div className="nav-dropdown" key={item.id}><span>{item.label} <small>⌄</small></span><div>{children.map((child)=>child.external?<a key={child.id} href={child.href} target="_blank" rel="noreferrer" onClick={closeMenu}>{child.label}</a>:<Link key={child.id} to={child.href} onClick={closeMenu}>{child.label}</Link>)}</div></div>
                : item.external
                  ? <a key={item.id} href={item.href} target="_blank" rel="noreferrer" onClick={closeMenu}>{item.label}</a>
                  : <Link key={item.id} to={item.href} onClick={closeMenu}>{item.label}</Link>
            })}
            <a className="nav-cv" href="/resume/muiz-lawal-cv.pdf" download onClick={() => { closeMenu(); trackEvent('CV Download') }}>Download CV <ArrowIcon /></a>
          </div>
        </nav>
      </header>

      <RouteSeo />
      <main id="main">
        <Routes>
          <Route path="/" element={(
          <>
          <div className="homepage-sections">
        <section className="hero-section" id="home" {...sectionSettings('home', 0)}>
          <AmbientHero />
          <div className="hero-grid">
            <motion.div className="hero-copy" initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
              <p className="eyebrow"><span></span> {String(managedSettings?.professionalTitle || 'Software developer · AI & cybersecurity')}</p>
              <h1>{managedSections.find((section) => section.id === 'home')?.title || 'Building technology that thinks, adapts and protects.'}</h1>
              <p className="hero-intro">{String(managedSettings?.introduction || managedSections.find((section) => section.id === 'home')?.description || 'I’m Muiz Lawal, a Computer Science student and software developer interested in artificial intelligence, cybersecurity and engineering impactful technology.')}</p>
              <div className="hero-actions">
                <a className="primary-button" data-magnetic href={managedSections.find((section) => section.id === 'home')?.ctaHref || '#projects'}>{managedSections.find((section) => section.id === 'home')?.ctaLabel || 'Explore my work'} <ArrowIcon /></a>
                <a className="text-button" data-magnetic href="#contact">Let’s connect <span>↗</span></a>
              </div>
              <div className="social-row" aria-label="Social links">
                <a href="https://github.com/Muiz-Lawal" target="_blank" rel="noreferrer"><GitHubIcon /> GitHub</a>
                <a href="https://www.linkedin.com/in/muiz-lawal-a5862b274/" target="_blank" rel="noreferrer"><LinkedInIcon /> LinkedIn</a>
                <a href="mailto:abdulmuizlawal208@gmail.com">Email</a>
              </div>
            </motion.div>

            <div className="hero-visual" aria-label="Abstract engineering system visualization">
              {sectionImage('home', 'Homepage feature')}
              <div className="visual-orbit orbit-one"></div>
              <div className="visual-orbit orbit-two"></div>
              <div className="visual-core"><span>MU</span></div>
              <span className="hero-particle particle-one" aria-hidden="true" />
              <span className="hero-particle particle-two" aria-hidden="true" />
              <span className="hero-particle particle-three" aria-hidden="true" />
              <span className="hero-particle particle-four" aria-hidden="true" />
              <span className="hero-particle particle-five" aria-hidden="true" />
              <div className="visual-label label-one"><i></i><span>Secure systems</span></div>
              <div className="visual-label label-two"><i></i><span>Applied intelligence</span></div>
              <div className="visual-label label-three"><i></i><span>Continuous learning</span></div>
              <div className="coordinate coordinate-left">06°31′N<br/>03°23′E</div>
              <div className="coordinate coordinate-right">WAT / Nigeria</div>
            </div>
          </div>
          <div className="scroll-cue"><span>Scroll to explore</span><i></i></div>
        </section>

        <section className="about-section" id="about" {...sectionSettings('about', 1)}>
          <div className="section-heading">
            <p className="section-index">01 / About</p>
            <h2>{managedSections.find((section) => section.id === 'about')?.title || <>Curious mind.<br/><span>Engineering purpose.</span></>}</h2>
          </div>
          <div className="about-grid" data-motion-reveal>
            <div className="portrait-placeholder" aria-label="Portrait placeholder">
              {managedSections.find((section) => section.id === 'about')?.imageUrl && <img className="managed-section-image" src={managedSections.find((section) => section.id === 'about')?.imageUrl} alt="About section visual" />}
              <div className="portrait-grid"></div>
              <span>MU.</span>
              <div className="portrait-caption"><small>Currently</small><strong>Computer Science</strong><p>Obafemi Awolowo University</p></div>
            </div>
            <div className="about-copy">
              <p className="lead">{managedSections.find((section) => section.id === 'about')?.description || 'I’m developing a deep foundation in computing while turning ideas into working software.'}</p>
              <p>I study Computer Science at Obafemi Awolowo University, where I’m building my understanding of algorithms, systems, mathematics and software engineering. Outside the classroom, I explore Linux, Android development, artificial intelligence and cybersecurity.</p>
              <p>My direction is to become a Secure AI Systems Engineer: building intelligent systems that are useful, reliable and designed with security in mind.</p>
              <div className="about-facts">
                <div><small>Based in</small><strong>{String(managedSettings?.location || 'Nigeria')}</strong></div>
                <div><small>Focus</small><strong>Secure AI systems</strong></div>
              </div>
              {sectionCta('about', '/about', 'Read more about me')}
            </div>
          </div>
        </section>

        <section className="expertise-section" id="expertise" {...sectionSettings('expertise', 2)}>
          <div className="expertise-header">
            <div><p className="section-index">02 / Expertise</p><h2>{managedSections.find((section) => section.id === 'expertise')?.title || 'How I work.'}</h2></div>
            <p>{managedSections.find((section) => section.id === 'expertise')?.description || 'I combine practical software development with an interest in understanding systems beneath the surface.'}</p>
          </div>
          {sectionImage('expertise', 'Expertise section visual')}
          <div className="expertise-grid">
            {(managedCollections?.skills?.length ? managedCollections.skills.map((item) => ({
              number: String((item.position as number) + 1).padStart(2, '0'),
              title: String(item.title || item.name || 'Skill'),
              text: String(item.description || ''),
              tags: Array.isArray(item.technologies) ? item.technologies as string[] : [],
            })) : expertise).map((item) => (
              <article className="expertise-card" data-motion-reveal key={item.number}><span className="card-number">{item.number}</span><h3>{item.title}</h3><p>{item.text}</p><div className="tag-row">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>              </article>
            ))}
          </div>
        </section>

        <section className="terminal-section" id="terminal" aria-labelledby="terminal-title">
          <div className="terminal-heading"><p className="section-index">02.1 / Developer terminal</p><h2 id="terminal-title">Ask the portfolio.</h2></div>
          <div className="terminal-window">
            <div className="terminal-bar"><div><i></i><i></i><i></i></div><span>muiz@portfolio:~</span></div>
            <div className="terminal-output" aria-live="polite">{terminalHistory.map((entry, index) => <div key={`${entry.command}-${index}`}>{entry.command && <p><b>muiz@portfolio:~$</b> {entry.command}</p>}<p>{entry.output}</p></div>)}</div>
            <form className="terminal-form" onSubmit={runTerminalCommand}><label htmlFor="terminal-command">muiz@portfolio:~$</label><input id="terminal-command" value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} autoComplete="off" spellCheck="false" placeholder="type help" /></form>
          </div>
        </section>

        <section className="projects-section" id="projects" {...sectionSettings('projects', 3)}>
          <div className="projects-header">
            <div><p className="section-index">03 / Selected work</p><h2>{managedSections.find((section) => section.id === 'projects')?.title || <>Projects built<br/>with intent.</>}</h2></div>
            {sectionCta('projects', '/projects', 'View all projects')}
          </div>
          {sectionImage('projects', 'Projects section visual')}
          <div className="project-list">
            {homepageProjects.map((project) => (
              <article className={`project-item ${project.featured ? 'featured' : ''}`} data-motion-reveal key={project.title}>
                <div className="project-number">{project.index}</div>
                <div className="project-main"><p className="project-type">{project.type}</p><h3>{project.title}</h3><p className="project-description">{project.description}</p><div className="tag-row">{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
                <div className="project-status"><span></span>{project.status}</div>
                {project.caseStudy ? (
                  <button className="project-link" data-magnetic type="button" onClick={() => { setSelectedProject(project); trackEvent('Project Case Study Open', { project: project.id }) }} aria-label={`View ${project.title} case study`}><ArrowIcon /></button>
                ) : (
                  <a className="project-link" data-magnetic href={project.href} target="_blank" rel="noreferrer" aria-label={`View ${project.title}`} onClick={() => trackEvent('Project Outbound Click', { project: project.id })}><ArrowIcon /></a>
                )}
              </article>
            ))}
            {homepageProjects.length === 0 && <p className="project-description">No projects have been published yet.</p>}
          </div>
        </section>

        <section className="experience-section" id="experience" {...sectionSettings('experience', 4)}>
          <div className="experience-heading"><div><p className="section-index">03.1 / Experience</p><h2>{managedSections.find((section) => section.id === 'experience')?.title || <>Learning through<br/><span>building together.</span></>}</h2></div><p>{managedSections.find((section) => section.id === 'experience')?.description || 'My practical experience comes through coursework, independent projects, educational initiatives and collaborative technical activities.'}</p></div>
          {sectionImage('experience', 'Experience section visual')}
          <div className="experience-list" data-motion-timeline>{(managedCollections?.experience?.length ? managedCollections.experience.map((item, index) => ({
            index: String(index + 1).padStart(2, '0'), role: String(item.role || item.type || 'Experience'), title: String(item.organization || item.title || 'Organization'), description: String(item.description || ''), status: String(item.status || (item.current ? 'Current' : ''))
          })) : experience).map((item) => <article data-motion-reveal key={item.index}><span>{item.index}</span><div><p>{item.role}</p><h3>{item.title}</h3><small>{item.description}</small></div><strong>{item.status}</strong></article>)}</div>
          {sectionCta('experience')}
        </section>

        <section className="education-section" id="education" {...sectionSettings('education', 5)}>
          <p className="section-index">03.2 / Education</p>
          <div className="education-grid" data-motion-reveal><div className="education-main"><span>OAU</span><h2>{managedSections.find((section) => section.id === 'education')?.title || String(managedCollections?.education?.[0]?.institution || education.institution)}</h2><p>{String(managedCollections?.education?.[0]?.programme || education.programme)}</p><div><strong>{String(managedCollections?.education?.[0]?.period || education.period)}</strong><small>{String(managedCollections?.education?.[0]?.location || education.location)}</small></div></div><div className="education-details"><p>{managedSections.find((section) => section.id === 'education')?.description || education.note}</p><div className="course-grid">{(managedCollections?.education?.length ? managedCollections.education.flatMap((item) => Array.isArray(item.coursework) ? item.coursework as string[] : []) : education.coursework).map((course) => <span key={course}>{course}</span>)}</div><p className="honest-note">Formal graduation date and GPA are not displayed unless verified by the administrator.</p></div></div>
          {sectionImage('education', 'Education section visual')}
          {sectionCta('education')}
        </section>

        <section className="certifications-section" id="certifications">
          <p className="section-index">03.25 / Professional development</p>
          <div className="certifications-heading"><h2>Courses &<br/><span>continuous learning.</span></h2><p>Coursework is presented without overstating completion or credentials until exact certificates and verification links are confirmed.</p></div>
          <div className="certifications-grid">
            {(managedCollections?.certifications?.length ? managedCollections.certifications.map((item) => [String(item.issuer || item.organization || 'Issuer'), String(item.title || item.name || 'Certification'), String(item.status || 'Certificate')]) : coursework).map(([issuer, course, status]) => <article data-motion-reveal key={course}><small>{issuer}</small><h3>{course}</h3><span>{status} · Verification details managed in admin</span></article>)}
          </div>
        </section>

        <section className="learning-section" id="learning">
          <div className="learning-heading"><p className="section-index">03.3 / Learning interests</p><h2>Current directions.</h2></div>
          <div className="learning-grid">{learningInterests.map(([title, description], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
          <div className="leadership-note"><p className="section-index">Leadership & community</p><div><h3>Innovation, education and collaboration.</h3><p>I have supported technical leadership activities, helped teach introductory Python concepts and contributed communication and publicity materials to university community initiatives. These experiences are presented as activities rather than inflated job titles or formal employment.</p></div></div>
        </section>

        <section className="writing-section" id="writing">
          <div className="writing-heading"><div><p className="section-index">04 / Notes & writing</p><h2>Ideas worth<br/><span>documenting.</span></h2></div><p>Long-form writing is being prepared around systems, security, AI and the craft of software engineering.</p></div>
          <div className="writing-grid writing-empty"><p>No articles are published yet. New writing will appear here when it is ready.</p><Link className="text-button" to="/writing">Browse published writing <span>↗</span></Link></div>
        </section>

        <section className="contact-section" id="contact" {...sectionSettings('contact', 6)}>
          <div className="contact-heading"><p className="section-index">05 / Contact</p><h2>{managedSections.find((section) => section.id === 'contact')?.title || <>Have an interesting<br/>problem to solve?</>}</h2><p>{managedSections.find((section) => section.id === 'contact')?.description || 'Let’s build something.'}</p></div>
          <div className="contact-grid" data-motion-reveal>
            <div className="contact-details"><a href={`mailto:${String(managedSettings?.contactEmail || 'abdulmuizlawal208@gmail.com')}`}><small>Email</small><strong>{String(managedSettings?.contactEmail || 'abdulmuizlawal208@gmail.com')}</strong></a><div><small>Location</small><strong>{String(managedSettings?.location || 'Nigeria')} · WAT</strong></div><div className="contact-socials"><a href="https://github.com/Muiz-Lawal" target="_blank" rel="noreferrer"><GitHubIcon />GitHub</a><a href="https://www.linkedin.com/in/muiz-lawal-a5862b274/" target="_blank" rel="noreferrer"><LinkedInIcon />LinkedIn</a></div></div>
            <form className="contact-form" onSubmit={submitContact}><input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="honeypot" /><label>Name<input name="name" type="text" required minLength={2} maxLength={80} autoComplete="name" placeholder="Your name" /></label><label>Email<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label><label>Subject<input name="subject" type="text" required minLength={3} maxLength={120} placeholder="What would you like to discuss?" /></label><label>Message<textarea name="message" required minLength={20} maxLength={3000} rows={5} placeholder="Tell me about the problem or opportunity..."></textarea></label><button className="primary-button" type="submit">Create email <ArrowIcon /></button>{contactStatus && <p className="form-status" role="status">{contactStatus}</p>}</form>
          </div>
          {sectionImage('contact', 'Contact section visual')}
          {sectionCta('contact')}
        </section>
          </div>
          </>
          )} />
          <Route path="/about" element={<RoutePage pathname="/about" />} />
          <Route path="/projects" element={<RoutePage pathname="/projects" />} />
          <Route path="/projects/:slug" element={<RoutePage pathname={pathname} />} />
          <Route path="/writing" element={<RoutePage pathname="/writing" />} />
          <Route path="/writing/:slug" element={<RoutePage pathname={pathname} />} />
          <Route path="/certifications" element={<RoutePage pathname="/certifications" />} />
          <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
          <Route path="/:slug" element={<RoutePage pathname={pathname} />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      {selectedProject?.caseStudy && (
        <div className="case-study-backdrop" role="presentation" onMouseDown={(event: MouseEvent<HTMLDivElement>) => event.target === event.currentTarget && setSelectedProject(null)}>
          <article className="case-study" role="dialog" aria-modal="true" aria-labelledby="case-study-title">
            <div className="case-study-top"><p className="section-index">Case study / {selectedProject.index}</p><button type="button" onClick={() => setSelectedProject(null)} aria-label="Close case study">×</button></div>
            <h2 id="case-study-title">{selectedProject.title}</h2>
            <p className="case-study-overview">{selectedProject.caseStudy.overview}</p>
            <div className="case-study-grid">
              <div><small>Role</small><p>{selectedProject.caseStudy.role}</p></div>
              <div><small>Technology</small><p>{selectedProject.tags.join(' · ')}</p></div>
            </div>
            <div className="case-study-details">
              <section><h3>Architecture</h3><p>{selectedProject.caseStudy.architecture}</p></section>
              <section><h3>Engineering decisions</h3><p>{selectedProject.caseStudy.decisions}</p></section>
              <section><h3>Challenge</h3><p>{selectedProject.caseStudy.challenges}</p></section>
            </div>
            <div className="case-study-footer"><div className="tag-row">{selectedProject.caseStudy.features.map((feature) => <span key={feature}>{feature}</span>)}</div><a className="primary-button" href={selectedProject.href} target="_blank" rel="noreferrer">View repository <ArrowIcon /></a></div>
          </article>
        </div>
      )}

      <footer>
        <Link className="brand" to="/#home">{String(managedSettings?.brandName || 'MU')}<span>.</span></Link>
        <nav aria-label="Footer navigation"><Link to="/projects">Project directory</Link><Link to="/writing">Writing</Link><Link to="/certifications">Learning</Link><a href="https://github.com/Muiz-Lawal" target="_blank" rel="noreferrer">GitHub</a><a href="https://www.linkedin.com/in/muiz-lawal-a5862b274/" target="_blank" rel="noreferrer">LinkedIn</a><a href="mailto:abdulmuizlawal208@gmail.com">Email</a></nav>
        <p>© {CURRENT_YEAR} Muiz Lawal</p>
        <Link to="/#home" className="back-top">Back to top ↑</Link>
        <small className="privacy-note">Optional Plausible analytics, when configured, records aggregate page views and selected actions only. Form fields and terminal input are never tracked.</small>
      </footer>
    </>
  )
}

export default App
