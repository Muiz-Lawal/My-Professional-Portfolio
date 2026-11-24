import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Archive,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  GraduationCap,
  Image,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Plug,
  Plus,
  Search,
  Shield,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import './styles/admin.css'
import './styles/ambient-motion.css'

interface ManagedPage {
  id?: string
  slug: string
  type: 'page' | 'project' | 'article'
  title: string
  description: string
  content: string
  status: 'draft' | 'review' | 'published' | 'scheduled' | 'archived'
  visibility: 'public' | 'private'
  inNavigation: boolean
  template: 'default' | 'project' | 'article'
  seoTitle: string
  seoDescription: string
  category: string
  tags: string[]
  featured: boolean
  repositoryUrl: string
  liveUrl: string
  mediaUrls: string[]
  problem: string
  objectives: string
  role: string
  implementation: string
  challenges: string
  outcomes: string
  relatedSlugs: string[]
  blocks: Array<{type:string;content:string}>
  publishedAt: string
  scheduledAt: string
  createdAt?: string
  updatedAt?: string
}

interface HomeSection {
  id: string
  title: string
  description: string
  visible: boolean
  order: number
  inNavigation: boolean
  imageUrl: string
  ctaLabel: string
  ctaHref: string
}

interface ContentResponse {
  pages: ManagedPage[]
  sections: HomeSection[]
}

type PageBlock = { type: string; content: string }
type BlockEntry = Record<string, string>
type BlockData = Record<string, string | string[] | BlockEntry[]>
type AdminView = 'overview'|'content'|'messages'|'media'|'navigation'|'settings'|'security'|'backups'|'experience'|'education'|'certifications'|'skills'|'testimonials'|'seo'|'integrations'|'analytics'|'users'|'redirects'
type ContentKind = 'all'|'page'|'project'|'article'

const adminNavigation: Array<{ title: string; items: Array<{ view: AdminView; label: string; icon: LucideIcon; contentKind?: ContentKind }> }> = [
  { title: 'Overview', items: [{ view: 'overview', label: 'Dashboard', icon: LayoutDashboard }] },
  { title: 'Content', items: [
    { view: 'content', contentKind: 'all', label: 'Homepage', icon: Folder },
    { view: 'content', contentKind: 'project', label: 'Projects', icon: Briefcase },
    { view: 'content', contentKind: 'page', label: 'Pages', icon: FileText },
    { view: 'content', contentKind: 'article', label: 'Articles', icon: BookOpen },
    { view: 'experience', label: 'Experience', icon: Activity },
    { view: 'education', label: 'Education', icon: GraduationCap },
    { view: 'skills', label: 'Skills', icon: Plus },
    { view: 'certifications', label: 'Certifications', icon: Award },
    { view: 'testimonials', label: 'Testimonials', icon: MessageSquare },
  ] },
  { title: 'Assets', items: [{ view: 'media', label: 'Media library', icon: Image }] },
  { title: 'Website', items: [
    { view: 'navigation', label: 'Navigation', icon: Link2 },
    { view: 'settings', label: 'Appearance', icon: Palette },
    { view: 'seo', label: 'SEO', icon: Search },
    { view: 'messages', label: 'Contact messages', icon: MessageSquare },
  ] },
  { title: 'System', items: [
    { view: 'analytics', label: 'Analytics', icon: BarChart3 },
    { view: 'integrations', label: 'Integrations', icon: Plug },
    { view: 'users', label: 'Users & permissions', icon: Users },
    { view: 'redirects', label: 'Redirects', icon: ChevronRight },
    { view: 'security', label: 'Security & activity', icon: Shield },
    { view: 'backups', label: 'Backups', icon: Archive },
  ] },
]

const adminViewTitle: Record<AdminView, string> = {
  overview: 'Dashboard',
  content: 'Content',
  messages: 'Contact messages',
  media: 'Media library',
  navigation: 'Navigation',
  settings: 'Appearance & settings',
  security: 'Security & activity',
  backups: 'Backups',
  experience: 'Experience',
  education: 'Education',
  certifications: 'Certifications',
  skills: 'Skills',
  testimonials: 'Testimonials',
  seo: 'SEO',
  integrations: 'Integrations',
  analytics: 'Analytics',
  users: 'Users & permissions',
  redirects: 'Redirects',
}

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5057'
const TOKEN_KEY = 'portfolio_admin_token'

function blankPage(): ManagedPage {
  return {
    slug: '',
    type: 'page',
    title: '',
    description: '',
    content: '',
    status: 'draft',
    visibility: 'private',
    inNavigation: false,
    template: 'default',
    seoTitle: '',
    seoDescription: '',
    category: '',
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
  }
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const blockEntryFields: Record<string, Array<{ key: string; label: string }>> = {
  statistics: [{ key: 'value', label: 'Value' }, { key: 'label', label: 'Label' }],
  timeline: [{ key: 'date', label: 'Date' }, { key: 'title', label: 'Title' }, { key: 'description', label: 'Description' }],
  testimonials: [{ key: 'quote', label: 'Quote' }, { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }],
  cards: [{ key: 'title', label: 'Title' }, { key: 'description', label: 'Description' }, { key: 'href', label: 'Link' }],
  buttons: [{ key: 'label', label: 'Label' }, { key: 'href', label: 'Link' }],
  faq: [{ key: 'question', label: 'Question' }, { key: 'answer', label: 'Answer' }],
}

const blockFields: Record<string, Array<{ key: string; label: string; multiline?: boolean }>> = {
  hero: [
    { key: 'eyebrow', label: 'Eyebrow' }, { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description', multiline: true },
    { key: 'primaryLabel', label: 'Primary button label' }, { key: 'primaryHref', label: 'Primary button link' },
    { key: 'secondaryLabel', label: 'Secondary button label' }, { key: 'secondaryHref', label: 'Secondary button link' },
  ],
  image: [{ key: 'imageUrl', label: 'Image URL' }, { key: 'altText', label: 'Alternative text' }, { key: 'caption', label: 'Caption' }],
  video: [{ key: 'videoUrl', label: 'Video URL' }, { key: 'caption', label: 'Caption' }],
  projects: [{ key: 'heading', label: 'Heading' }, { key: 'slugs', label: 'Project slugs (one per line)', multiline: true }],
  statistics: [{ key: 'heading', label: 'Heading' }],
  timeline: [{ key: 'heading', label: 'Heading' }],
  testimonials: [{ key: 'heading', label: 'Heading' }],
  cards: [{ key: 'heading', label: 'Heading' }],
  cta: [
    { key: 'heading', label: 'Heading' }, { key: 'description', label: 'Description', multiline: true },
    { key: 'label', label: 'Button label' }, { key: 'href', label: 'Button link' },
  ],
  download: [
    { key: 'label', label: 'Link label' }, { key: 'href', label: 'File URL' },
    { key: 'description', label: 'Description', multiline: true },
  ],
  buttons: [{ key: 'heading', label: 'Heading' }],
  code: [{ key: 'language', label: 'Language' }, { key: 'code', label: 'Code', multiline: true }],
  faq: [{ key: 'heading', label: 'Heading' }],
  contact: [
    { key: 'heading', label: 'Heading' }, { key: 'description', label: 'Description', multiline: true },
    { key: 'email', label: 'Email address' },
  ],
}

function parseBlockData(content: string): BlockData {
  try {
    const parsed: unknown = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as BlockData
  } catch {
    // Older blocks stored plain text; keep it available while editing the new fields.
  }
  return { description: content }
}

async function apiRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    throw new Error(result.error || `Request failed (${response.status}).`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function downloadAdminFile(path: string, token: string, fileName: string) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    throw new Error(result.error || `Download failed (${response.status}).`)
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function normalizeContent(result: ContentResponse): ContentResponse {
  return {
    ...result,
    pages: result.pages.map((page) => ({
      ...page,
      problem: page.problem || '',
      objectives: page.objectives || '',
      role: page.role || '',
      implementation: page.implementation || '',
      challenges: page.challenges || '',
      outcomes: page.outcomes || '',
      relatedSlugs: page.relatedSlugs || [],
      scheduledAt: page.scheduledAt || '',
      blocks: page.blocks || [],
    })),
  }
}

function BlockEditor({
    blocks,
    onChange,
  }: {
    blocks: PageBlock[]
    onChange: (blocks: PageBlock[]) => void
  }) {
    const types = ['hero','text','image','gallery','video','projects','statistics','timeline','testimonials','cards','cta','download','buttons','code','faq','contact'] as const

    const update = (index: number, patch: Partial<{type:string;content:string}>) => {
      onChange(blocks.map((block, blockIndex) => blockIndex === index ? { ...block, ...patch } : block))
    }

    const onDragEnd = (event: DragEndEvent) => {
      const over = event.over
      if (!over || event.active.id === over.id) return
      const from = blocks.findIndex((_, index) => `block-${index}` === event.active.id)
      const to = blocks.findIndex((_, index) => `block-${index}` === over.id)
      if (from >= 0 && to >= 0) onChange(arrayMove(blocks, from, to))
    }

    return (
      <section className="block-editor admin-wide">
        <div className="block-editor-heading"><h3>Page blocks</h3><label>Add block<select defaultValue="" onChange={(event) => {
          const type = event.target.value
          if (type) onChange([...blocks, { type, content: '' }])
          event.target.value = ''
        }}><option value="" disabled>Select block</option>{types.map((type)=><option key={type} value={type}>{type}</option>)}</select></label></div>
        {blocks.length === 0 && <p className="admin-empty">No blocks yet. Add a block to begin.</p>}
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((_, index)=>`block-${index}`)} strategy={verticalListSortingStrategy}>
            {blocks.map((block,index)=><SortableBlock key={`block-${index}`} id={`block-${index}`} index={index} block={block} update={update} remove={()=>onChange(blocks.filter((_,blockIndex)=>blockIndex!==index))}/>)}
          </SortableContext>
        </DndContext>
      </section>
    )
  }

function SortableBlock({ id, index, block, update, remove }: {
    id: string
    index: number
    block: PageBlock
    update: (index:number,patch:Partial<PageBlock>)=>void
    remove: ()=>void
  }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const data = parseBlockData(block.content)
    const updateData = (key: string, value: string | string[] | BlockEntry[]) => update(index, { content: JSON.stringify({ ...data, [key]: value }) })
    const entryFields = blockEntryFields[block.type]
    const entries = Array.isArray(data.entries) ? data.entries as BlockEntry[] : []
    return (
      <article ref={setNodeRef} className={`block-editor-item ${isDragging?'dragging':''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
        <div className="block-editor-item-bar"><button type="button" className="drag-handle" aria-label={`Drag block ${index+1}`} {...attributes} {...listeners}>⋮⋮</button><strong>{index+1}. {block.type}</strong><button type="button" onClick={remove}>Remove</button></div>
        {block.type === 'text' ? (
          <>
            <label>Markdown content<textarea rows={8} value={block.content} onChange={(event)=>update(index,{content:event.target.value})}/></label>
            <div className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize,rehypeHighlight]}>{block.content}</ReactMarkdown></div>
          </>
        ) : (
          <>
            {(blockFields[block.type] || []).map((field) => {
              const value = data[field.key]
              const fieldValue = field.key === 'code' && typeof value !== 'string' ? block.content : typeof value === 'string' ? value : ''
              return <label key={field.key}>{field.label}{field.multiline
                ? <textarea rows={4} value={field.key === 'slugs' && Array.isArray(value) ? value.join('\n') : fieldValue} onChange={(event) => updateData(field.key, field.key === 'slugs' ? event.target.value.split('\n').map((slug) => slug.trim()).filter(Boolean) : event.target.value)}/>
                : <input value={fieldValue} onChange={(event)=>updateData(field.key,event.target.value)}/>}</label>
            })}
            {block.type === 'gallery' && <label>Images (one URL per line; optionally add | alt text)<textarea rows={5} value={Array.isArray(data.images) ? data.images.join('\n') : ''} onChange={(event)=>updateData('images',event.target.value.split('\n').map((url)=>url.trim()).filter(Boolean))}/></label>}
            {entryFields && (
              <div className="block-entry-list">
                <div className="block-editor-item-bar"><strong>{block.type === 'faq' ? 'Questions' : 'Items'}</strong><button type="button" onClick={()=>updateData('entries',[...entries,Object.fromEntries(entryFields.map((field)=>[field.key,'']))])}>Add item</button></div>
                {entries.map((entry,entryIndex)=><fieldset key={entryIndex}>
                  <legend>{block.type === 'faq' ? `Question ${entryIndex+1}` : `Item ${entryIndex+1}`}</legend>
                  {entryFields.map((field)=><label key={field.key}>{field.label}{field.key === 'answer' || field.key === 'description' || field.key === 'quote'
                    ? <textarea rows={3} value={entry[field.key]||''} onChange={(event)=>updateData('entries',entries.map((item,itemIndex)=>itemIndex===entryIndex?{...item,[field.key]:event.target.value}:item))}/>
                    : <input value={entry[field.key]||''} onChange={(event)=>updateData('entries',entries.map((item,itemIndex)=>itemIndex===entryIndex?{...item,[field.key]:event.target.value}:item))}/>}</label>)}
                  <button type="button" onClick={()=>updateData('entries',entries.filter((_,itemIndex)=>itemIndex!==entryIndex))}>Remove item</button>
                </fieldset>)}
              </div>
            )}
          </>
        )}
      </article>
    )
  }

export function AdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [tokenInput, setTokenInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [mfaInput, setMfaInput] = useState('')
  const [activeView, setActiveView] = useState<AdminView>('overview')
  const [contentKind, setContentKind] = useState<ContentKind>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [messageFilter, setMessageFilter] = useState<'all'|'unread'|'read'|'archived'>('all')
  const [mediaLayout, setMediaLayout] = useState<'grid'|'list'>('grid')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== 'undefined' && localStorage.getItem('portfolio_admin_sidebar') === 'collapsed')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [theme, setTheme] = useState<'dark'|'light'|'system'>(() => {
    if (typeof window === 'undefined') return 'dark'
    const savedTheme = localStorage.getItem('portfolio_admin_theme')
    return savedTheme === 'light' || savedTheme === 'system' ? savedTheme : 'dark'
  })
  const [dashboard, setDashboard] = useState<{totals?: Record<string, number>; recentContent?: ManagedPage[]; recentActivity?: Array<{action:string;actor:string;details:string;created_at:string}>; health?: Record<string,string>} | null>(null)
  const [messages, setMessages] = useState<Array<{id:string;name:string;email:string;subject:string;message:string;status:'unread'|'read'|'archived';created_at:string}>>([])
  const [media, setMedia] = useState<Array<{id:string;name:string;original_name:string;mime_type:string;size:number;alt_text:string;folder:string;created_at:string}>>([])
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [navigationItems, setNavigationItems] = useState<Array<{id?:string;label:string;href:string;position:number;menu:'primary'|'footer';desktop_visible:boolean;mobile_visible:boolean;external:boolean;parent_id?:string|null}>>([])
  const [auditLog, setAuditLog] = useState<Array<{action:string;actor:string;details:string;created_at:string}>>([])
  const [backupHistory, setBackupHistory] = useState<Array<{name:string;createdAt:string;size:number;restorable:boolean}>>([])
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaSetup, setMfaSetup] = useState<{secret:string;otpauth:string}|null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [entities, setEntities] = useState<Record<string, Array<Record<string, unknown> & {id:string;status:string;position:number}>>>({})
  const [redirects, setRedirects] = useState<Array<{id:string;source:string;destination:string;status_code:number;active:boolean}>>([])
  const [integrations, setIntegrations] = useState<Array<{key:string;enabled:boolean;status:string;updated_at:string}>>([])
  const [analytics, setAnalytics] = useState<{total:number;popular:Array<{path:string;count:number}>;events:Array<{event_type:string;count:number}>;configured:boolean}|null>(null)
  const [users, setUsers] = useState<Array<{id:string;email:string;role:string;created_at:string}>>([])
  const [revisionPage, setRevisionPage] = useState<ManagedPage|null>(null)
  const [revisions, setRevisions] = useState<Array<{id:string;created_by:string;created_at:string;snapshot:ManagedPage}>>([])
  const [content, setContent] = useState<ContentResponse>({ pages: [], sections: [] })
  const [editingPage, setEditingPage] = useState<ManagedPage | null>(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadingView, setLoadingView] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    localStorage.setItem('portfolio_admin_theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('portfolio_admin_sidebar', sidebarCollapsed ? 'collapsed' : 'expanded')
  }, [sidebarCollapsed])

  const loadContent = async (authToken: string) => {
    setBusy(true)
    setStatus('')
    try {
      const result = await apiRequest<ContentResponse>('/api/admin/content', authToken)
      setContent(normalizeContent(result))
      setToken(authToken)
      sessionStorage.setItem(TOKEN_KEY, authToken)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load admin content.')
      if (authToken) sessionStorage.removeItem(TOKEN_KEY)
      setToken('')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let active = true
    const authentication = token
      ? apiRequest<ContentResponse>('/api/admin/content', token)
      : apiRequest<{authenticated:boolean}>('/api/admin/session', '').then(() => apiRequest<ContentResponse>('/api/admin/content', ''))
    void authentication.then((result) => {
      if (!active) return
      setContent(normalizeContent(result))
      if (token) sessionStorage.setItem(TOKEN_KEY, token)
    }).catch((error: unknown) => {
      if (!active) return
      setStatus(error instanceof Error ? error.message : 'Unable to load admin content.')
      sessionStorage.removeItem(TOKEN_KEY)
      setToken('')
    })
    return () => { active = false }
    // Load once from the session-only credential.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!token) return
    const load = async () => {
      setLoadingView(true)
      try {
        if (activeView === 'overview') {
          const [overview, activity] = await Promise.all([
            apiRequest<typeof dashboard>('/api/admin/dashboard', token),
            apiRequest<typeof analytics>('/api/admin/analytics', token),
          ])
          setDashboard(overview)
          setAnalytics(activity)
        }
        if (activeView === 'messages') setMessages(await apiRequest<typeof messages>('/api/admin/messages', token))
        if (activeView === 'media') setMedia(await apiRequest<typeof media>('/api/admin/media', token))
        if (activeView === 'settings') setSettings(await apiRequest<typeof settings>('/api/admin/settings', token))
        if (activeView === 'navigation') setNavigationItems(await apiRequest<typeof navigationItems>('/api/admin/navigation', token))
        if (activeView === 'security') {
          const [audit, mfa] = await Promise.all([
            apiRequest<typeof auditLog>('/api/admin/audit', token),
            apiRequest<{enabled:boolean}>('/api/admin/security/mfa/status', token),
          ])
          setAuditLog(audit)
          setMfaEnabled(mfa.enabled)
        }
        if (activeView === 'backups') setBackupHistory(await apiRequest<typeof backupHistory>('/api/admin/backup/history', token))
        if (['experience','education','certifications','skills','testimonials'].includes(activeView)) {
          const records = await apiRequest<Array<Record<string, unknown> & {id:string;status:string;position:number}>>(`/api/admin/entities/${activeView}`, token)
          setEntities((current) => ({ ...current, [activeView]: records }))
        }
        if (activeView === 'redirects') setRedirects(await apiRequest<typeof redirects>('/api/admin/redirects', token))
        if (activeView === 'integrations') setIntegrations(await apiRequest<typeof integrations>('/api/admin/integrations', token))
        if (activeView === 'analytics') setAnalytics(await apiRequest<typeof analytics>('/api/admin/analytics', token))
        if (activeView === 'users') setUsers(await apiRequest<typeof users>('/api/admin/users', token))
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Unable to load dashboard data.')
      } finally {
        setLoadingView(false)
      }
    }
    void load()
  }, [activeView, token])

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (emailInput && passwordInput) {
      setBusy(true)
      setStatus('')
      try {
        await apiRequest<{authenticated:boolean}>('/api/admin/session/login', '', {
          method: 'POST',
          body: JSON.stringify({ email: emailInput, password: passwordInput, mfaCode: mfaInput }),
        })
        const result = await apiRequest<ContentResponse>('/api/admin/content', '')
        setContent(normalizeContent(result))
        setToken('session')
        setStatus('Signed in securely.')
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Unable to sign in.')
      } finally {
        setBusy(false)
      }
      return
    }
    await loadContent(tokenInput.trim())
  }

  const updateSection = (id: string, patch: Partial<HomeSection>) => {
    setContent((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === id ? { ...section, ...patch } : section),
    }))
  }

  const navigateToView = (view: AdminView, kind?: ContentKind) => {
    setActiveView(view)
    if (kind) setContentKind(kind)
    setSearchQuery('')
    setMobileNavOpen(false)
  }

  const startCreateContent = (type: ManagedPage['type']) => {
    const page = blankPage()
    page.type = type
    page.template = type === 'page' ? 'default' : type
    setEditingPage(page)
    setPreview(false)
    setContentKind(type)
    setActiveView('content')
    setMobileNavOpen(false)
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const visiblePages = content.pages.filter((page) =>
    (contentKind === 'all' || page.type === contentKind) &&
    (!normalizedSearch || `${page.title} ${page.description} ${page.slug} ${page.category} ${page.tags.join(' ')}`.toLowerCase().includes(normalizedSearch)),
  )
  const visibleMessages = messages.filter((message) =>
    (messageFilter === 'all' || message.status === messageFilter) &&
    (!normalizedSearch || `${message.name} ${message.email} ${message.subject} ${message.message}`.toLowerCase().includes(normalizedSearch)),
  )
  const visibleMedia = media.filter((item) =>
    !normalizedSearch || `${item.original_name} ${item.folder} ${item.alt_text} ${item.mime_type}`.toLowerCase().includes(normalizedSearch),
  )
  const visibleNavigationItems = navigationItems.filter((item) =>
    !normalizedSearch || `${item.label} ${item.href} ${item.menu}`.toLowerCase().includes(normalizedSearch),
  )
  const visibleEntities = (entities[activeView] || []).filter((entity) =>
    !normalizedSearch || `${String(entity.title||'')} ${String(entity.description||'')} ${String(entity.organization||entity.issuer||'')}`.toLowerCase().includes(normalizedSearch),
  )
  const visibleUsers = users.filter((user) =>
    !normalizedSearch || `${user.email} ${user.role}`.toLowerCase().includes(normalizedSearch),
  )
  const visibleRedirects = redirects.filter((redirect) =>
    !normalizedSearch || `${redirect.source} ${redirect.destination} ${redirect.status_code}`.toLowerCase().includes(normalizedSearch),
  )
  const visibleIntegrations = integrations.filter((integration) =>
    !normalizedSearch || `${integration.key} ${integration.status}`.toLowerCase().includes(normalizedSearch),
  )
  const visibleAuditLog = auditLog.filter((entry) =>
    !normalizedSearch || `${entry.action} ${entry.actor} ${entry.details}`.toLowerCase().includes(normalizedSearch),
  )
  const maxPopularPathCount = Math.max(1, ...(analytics?.popular || []).map((item) => item.count))
  const activeTitle = activeView === 'content'
    ? contentKind === 'all' ? 'Homepage & content' : contentKind === 'project' ? 'Projects' : contentKind === 'article' ? 'Articles' : 'Pages'
    : adminViewTitle[activeView]
  const activeDescription: Record<AdminView, string> = {
    overview: 'A clear view of your portfolio content and administrative activity.',
    content: 'Manage published work, editorial content, page structure, and homepage sections.',
    messages: 'Review and organize messages submitted through the portfolio contact form.',
    media: 'Upload, organize, and update local media assets used across the site.',
    navigation: 'Configure public navigation menus and destinations.',
    settings: 'Manage the visual identity and site-wide settings.',
    security: 'Protect administrator access and review recent activity.',
    backups: 'Create, download, and restore complete local snapshots.',
    experience: 'Manage published experience entries.',
    education: 'Manage education records.',
    certifications: 'Manage verified certifications and learning records.',
    skills: 'Manage skills shown on the portfolio.',
    testimonials: 'Manage approved testimonials.',
    seo: 'Set site-wide search and social sharing metadata.',
    integrations: 'Review optional service connections.',
    analytics: 'Review privacy-aware site activity and configured analytics.',
    users: 'Review administrator accounts and access roles.',
    redirects: 'Manage legacy URLs and destination paths.',
  }

  const saveSections = async () => {
    setBusy(true)
    setStatus('')
    try {
      const result = await apiRequest<{ sections: HomeSection[] }>('/api/admin/content/sections', token, {
        method: 'PUT',
        body: JSON.stringify(content.sections),
      })
      setContent((current) => ({ ...current, sections: result.sections }))
      setStatus('Homepage sections saved.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save sections.')
    } finally {
      setBusy(false)
    }
  }

  const setupMfa = async () => {
    try {
      setMfaSetup(await apiRequest<{secret:string;otpauth:string}>('/api/admin/security/mfa/setup', token, { method: 'POST' }))
      setMfaCode('')
      setStatus('Add the setup key to your authenticator app, then enter its current six-digit code.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to start MFA setup.')
    }
  }

  const enableMfa = async () => {
    if (!mfaSetup) return
    try {
      await apiRequest('/api/admin/security/mfa/enable', token, { method: 'POST', body: JSON.stringify({ secret: mfaSetup.secret, code: mfaCode }) })
      setMfaEnabled(true)
      setMfaSetup(null)
      setMfaCode('')
      setStatus('Authenticator MFA enabled.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to enable MFA.')
    }
  }

  const disableMfa = async () => {
    if (!confirm('Disable authenticator MFA for administrator sign-in?')) return
    try {
      await apiRequest('/api/admin/security/mfa/disable', token, { method: 'POST' })
      setMfaEnabled(false)
      setMfaSetup(null)
      setStatus('Authenticator MFA disabled.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to disable MFA.')
    }
  }

  const createBackup = async () => {
    try {
      const backup = await apiRequest<{name:string;createdAt:string;size:number;restorable:boolean}>('/api/admin/backup/create', token, { method: 'POST' })
      setBackupHistory((items) => [backup, ...items.filter((item) => item.name !== backup.name)])
      setStatus('Full backup created, including the database, content, and uploaded media.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to create backup.')
    }
  }

  const restoreBackup = async (name: string) => {
    if (!confirm(`Restore "${name}"? Current data will first be saved to a new safety backup.`)) return
    try {
      const result = await apiRequest<{safetyBackup:string}>(
        `/api/admin/backup/${encodeURIComponent(name)}/restore`,
        token,
        { method: 'POST' },
      )
      setContent(normalizeContent(await apiRequest<ContentResponse>('/api/admin/content', token)))
      setBackupHistory(await apiRequest<typeof backupHistory>('/api/admin/backup/history', token))
      setStatus(`Backup restored. A safety copy was saved as ${result.safetyBackup}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to restore backup.')
    }
  }

  const downloadBackupFile = async (name: string, file: 'portfolio.sqlite'|'portfolio-content.json') => {
    try {
      await downloadAdminFile(`/api/admin/backup/${encodeURIComponent(name)}/download/${file}`, token, `${name}-${file}`)
      setStatus(`Downloaded ${file}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to download backup file.')
    }
  }

  const savePage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingPage) return
    const page = {
      ...editingPage,
      slug: slugify(editingPage.slug || editingPage.title),
      tags: editingPage.tags,
      mediaUrls: editingPage.mediaUrls,
    }
    setBusy(true)
    setStatus('')
    try {
      const result = await apiRequest<ManagedPage>(
        page.id ? `/api/admin/content/pages/${page.id}` : '/api/admin/content/pages',
        token,
        { method: page.id ? 'PUT' : 'POST', body: JSON.stringify(page) },
      )
      setContent((current) => ({
        ...current,
        pages: page.id ? current.pages.map((item) => item.id === result.id ? result : item) : [...current.pages, result],
      }))
      setEditingPage(null)
      setPreview(false)
      setStatus('Page saved.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save this page.')
    } finally {
      setBusy(false)
    }
  }

  const duplicatePage = async (page: ManagedPage) => {
    if (!page.id) return
    try {
      const copy = await apiRequest<ManagedPage>(`/api/admin/content/pages/${page.id}/duplicate`, token, { method: 'POST' })
      setContent((current) => ({ ...current, pages: [...current.pages, { ...copy, problem: copy.problem || '', objectives: copy.objectives || '', role: copy.role || '', implementation: copy.implementation || '', challenges: copy.challenges || '', outcomes: copy.outcomes || '', relatedSlugs: copy.relatedSlugs || [] }] }))
      setStatus('Draft copy created.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to duplicate page.')
    }
  }

  const deletePage = async (page: ManagedPage) => {
    if (!page.id || !window.confirm(`Delete “${page.title}”? This cannot be undone.`)) return
    try {
      await apiRequest<void>(`/api/admin/content/pages/${page.id}`, token, { method: 'DELETE' })
      setContent((current) => ({ ...current, pages: current.pages.filter((item) => item.id !== page.id) }))
      setStatus('Page deleted.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to delete page.')
    }
  }

  const signOut = () => {
    void apiRequest<void>('/api/admin/session/logout', token === 'session' ? '' : token, { method: 'POST' }).catch(() => {})
    sessionStorage.removeItem(TOKEN_KEY)
    setToken('')
    setTokenInput('')
    setContent({ pages: [], sections: [] })
    setStatus('')
  }

  if (!token || !content.sections.length) {
    return (
      <section className="admin-app admin-login-layout" data-theme={theme}>
        <header className="admin-login-top"><Link className="admin-brand" to="/"><span className="admin-brand-mark">MU.</span><span className="admin-brand-copy"><strong>Muiz Lawal</strong><span>Portfolio administration</span></span></Link><Link to="/">Return to portfolio</Link></header>
        <div className="admin-login">
          <p className="section-index">Secure workspace</p><h1>Administrator sign in</h1>
          <p>Use the configured administrator account, or enter a legacy temporary token if your deployment is still in migration.</p>
          <form onSubmit={login}>
            <label>Administrator email<input type="email" autoComplete="username" value={emailInput} onChange={(event) => setEmailInput(event.target.value)} /></label>
            <label>Password<input type="password" autoComplete="current-password" value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} /></label>
            <label>Authenticator code <small>Only required after MFA is enabled</small><input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={mfaInput} onChange={(event) => setMfaInput(event.target.value)} /></label>
            <label>Legacy admin token <small>Temporary migration fallback</small><input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} /></label>
            <button className="primary-button" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
          </form>
          {status && <p className="admin-status" role="status">{status}</p>}
        </div>
      </section>
    )
  }

  return (
    <section className="admin-app" data-theme={theme}>
    {mobileNavOpen && <button className="admin-sidebar-overlay" type="button" aria-label="Close navigation" onClick={()=>setMobileNavOpen(false)} />}
    <div className={`admin-layout ${sidebarCollapsed?'is-collapsed':''}`}>
      <aside className={`admin-sidebar ${mobileNavOpen?'is-mobile-open':''}`} aria-label="Administration navigation">
        <Link className="admin-brand" to="/admin" onClick={()=>navigateToView('overview')}>
          <span className="admin-brand-mark">MU.</span>
          <span className="admin-brand-copy"><strong>Muiz Lawal</strong><span>Portfolio administration</span></span>
        </Link>
        <nav className="admin-sidebar-nav">
          {adminNavigation.map((group)=><div className="admin-nav-group" key={group.title}>
            <p className="admin-nav-heading">{group.title}</p>
            {group.items.map((item)=>{
              const Icon = item.icon
              const selected = activeView===item.view && (item.view!=='content' || contentKind===item.contentKind)
              return <button
                type="button"
                key={`${item.view}-${item.contentKind||item.label}`}
                className="admin-nav-item"
                aria-label={item.label}
                aria-current={selected?'page':undefined}
                title={sidebarCollapsed?item.label:undefined}
                onClick={()=>navigateToView(item.view,item.contentKind)}
              ><Icon size={16} aria-hidden="true"/><span>{item.label}</span></button>
            })}
          </div>)}
        </nav>
        <button className="admin-sidebar-collapse" type="button" aria-label={sidebarCollapsed?'Expand sidebar':'Collapse sidebar'} onClick={()=>setSidebarCollapsed((collapsed)=>!collapsed)}>
          {sidebarCollapsed?<PanelLeftOpen size={16}/>:<PanelLeftClose size={16}/>}<span>{sidebarCollapsed?'Expand navigation':'Collapse navigation'}</span>
        </button>
        <div className="admin-sidebar-footer">
          <span className="admin-avatar" aria-hidden="true">M</span>
          <span className="admin-sidebar-user"><strong>Administrator</strong><small>Portfolio access</small></span>
          <button type="button" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={15}/></button>
        </div>
      </aside>
      <div className="admin-main-column">
        <header className="admin-topbar">
          <div className="admin-topbar-leading">
            <button className="admin-icon-button admin-mobile-nav" type="button" aria-label="Toggle navigation" aria-expanded={mobileNavOpen} onClick={()=>setMobileNavOpen((open)=>!open)}>{mobileNavOpen?<X size={18}/>:<Menu size={18}/>}</button>
            <button className="admin-icon-button admin-sidebar-toggle" type="button" aria-label={sidebarCollapsed?'Expand sidebar':'Collapse sidebar'} onClick={()=>setSidebarCollapsed((collapsed)=>!collapsed)}>{sidebarCollapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button>
            <div className="admin-breadcrumb"><span>Portfolio</span><ChevronRight size={13}/><strong>{activeTitle}</strong></div>
          </div>
          <div className="admin-topbar-actions">
            {['content','messages','media','navigation','experience','education','certifications','skills','testimonials','users','redirects','security','integrations'].includes(activeView) && (
              <label className="admin-search"><Search size={15} aria-hidden="true"/><input aria-label={`Search ${activeTitle.toLowerCase()}`} placeholder={`Search ${activeTitle.toLowerCase()}…`} value={searchQuery} onChange={(event)=>setSearchQuery(event.target.value)} onKeyDown={(event)=>{if(event.key==='Escape')setSearchQuery('')}}/></label>
            )}
            <select className="admin-theme-picker" aria-label="Admin theme" value={theme} onChange={(event)=>setTheme(event.target.value as typeof theme)}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select>
            <button className="admin-icon-button" type="button" aria-label="Open unread messages" title={`${dashboard?.totals?.unreadMessages||0} unread messages`} onClick={()=>{setMessageFilter('unread');navigateToView('messages')}}><MessageSquare size={16}/></button>
            <details className="admin-quick-create">
              <summary aria-label="Create new"><Plus size={15}/><span>New</span><ChevronDown size={12}/></summary>
              <div className="admin-quick-menu">
                <button type="button" onClick={(event)=>{startCreateContent('project');event.currentTarget.closest('details')?.removeAttribute('open')}}><Briefcase size={15}/>Create project</button>
                <button type="button" onClick={(event)=>{startCreateContent('page');event.currentTarget.closest('details')?.removeAttribute('open')}}><FileText size={15}/>Create page</button>
                <button type="button" onClick={(event)=>{startCreateContent('article');event.currentTarget.closest('details')?.removeAttribute('open')}}><BookOpen size={15}/>Write article</button>
                <button type="button" onClick={(event)=>{navigateToView('media');event.currentTarget.closest('details')?.removeAttribute('open')}}><Image size={15}/>Upload media</button>
              </div>
            </details>
            <details className="admin-profile-menu"><summary aria-label="Administrator menu">M</summary><div className="admin-quick-menu"><Link to="/">View website</Link><button type="button" onClick={signOut}><LogOut size={15}/>Sign out</button></div></details>
          </div>
        </header>
        <main className="admin-content" id="admin-main">
          <header className="admin-page-heading"><div><p className="section-index">Portfolio / Administration</p><h1>{activeTitle}</h1><p>{activeDescription[activeView]}</p></div></header>
          {status && <p className="admin-toast" role="status" aria-live="polite">{status}</p>}
          <div className="admin-loading" role="status" aria-label={`Loading ${activeTitle.toLowerCase()}`} hidden={!loadingView}/>
          <div className="admin-view" key={`${activeView}-${contentKind}`}>

      {activeView === 'overview' && (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="section-index">Overview</p><h2>Website at a glance</h2><p>Monitor your portfolio content and site activity.</p></div><div className="admin-row-actions"><button type="button" onClick={()=>startCreateContent('project')}>Create project</button><button type="button" onClick={()=>navigateToView('media')}>Upload media</button></div></div>
          <div className="admin-stat-grid">
            {[
              ['Published projects',dashboard?.totals?.publishedProjects ?? 0],
              ['Draft projects',dashboard?.totals?.draftProjects ?? 0],
              ['Published pages',dashboard?.totals?.publishedPages ?? 0],
              ['Articles',dashboard?.totals?.publishedArticles ?? 0],
              ['Unread messages',dashboard?.totals?.unreadMessages ?? 0],
              ['Media files',dashboard?.totals?.media ?? 0],
            ].map(([label,value]) => <article key={String(label)}><small>{label}</small><strong>{value}</strong></article>)}
          </div>
          <div className="admin-overview-grid">
            <section><h3>Recent content</h3>{dashboard?.recentContent?.length ? dashboard.recentContent.map((page)=><article key={page.id}><small>{page.type} · {page.status}</small><strong>{page.title}</strong></article>) : <p className="admin-empty">No content has been created yet.</p>}</section>
            <section><h3>Recent activity</h3>{dashboard?.recentActivity?.length ? dashboard.recentActivity.map((activity)=><article key={`${activity.action}-${activity.created_at}`}><small>{activity.created_at}</small><strong>{activity.action.replaceAll('_',' ')}</strong><p>{activity.actor}</p></article>) : <p className="admin-empty">No administrative activity yet.</p>}</section>
            <section className="admin-traffic-summary"><div className="admin-panel-heading"><h3>Site activity</h3><span className="admin-badge">{analytics?.total??0} tracked events</span></div>
              {analytics?.popular.length ? analytics.popular.slice(0,5).map((item)=><article key={item.path}><div className="admin-traffic-label"><strong>{item.path}</strong><small>{item.count}</small></div><progress aria-label={`${item.count} tracked events for ${item.path}`} max={maxPopularPathCount} value={item.count}/></article>) : <p className="admin-empty">No site activity has been recorded yet.</p>}
              <button type="button" onClick={()=>navigateToView('analytics')}>Open analytics</button>
            </section>
          </div>
          {dashboard?.health && <div className="admin-health">{Object.entries(dashboard.health).map(([name,status]) => <article key={name}><span>{name}</span><strong>{status}</strong></article>)}</div>}
        </section>
      )}

      {activeView === 'content' && <>
      {contentKind === 'all' && (
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="section-index">01 / Homepage</p><h2>Section content & order</h2></div><button className="primary-button" type="button" onClick={saveSections} disabled={busy}>Save sections</button></div>
        <div className="admin-sections">
          {[...content.sections].sort((a, b) => a.order - b.order).map((section) => (
            <article key={section.id}>
              <strong>#{section.id}</strong>
              <label>Order<input type="number" min={0} max={100} value={section.order} onChange={(event) => updateSection(section.id, { order: Number(event.target.value) })} /></label>
              <label>Heading<input value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} /></label>
              <label>Description<textarea rows={2} value={section.description} onChange={(event) => updateSection(section.id, { description: event.target.value })} /></label>
              <label>Image URL<input type="url" value={section.imageUrl || ''} onChange={(event) => updateSection(section.id, { imageUrl: event.target.value })} /></label>
              <label>Call-to-action label<input value={section.ctaLabel || ''} onChange={(event) => updateSection(section.id, { ctaLabel: event.target.value })} /></label>
              <label>Call-to-action URL<input value={section.ctaHref || ''} onChange={(event) => updateSection(section.id, { ctaHref: event.target.value })} /></label>
              <label className="admin-check"><input type="checkbox" checked={section.visible} onChange={(event) => updateSection(section.id, { visible: event.target.checked })} /> Visible</label>
              <label className="admin-check"><input type="checkbox" checked={section.inNavigation} onChange={(event) => updateSection(section.id, { inNavigation: event.target.checked })} /> In homepage navigation</label>
            </article>
          ))}
        </div>
      </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="section-index">02 / Portfolio content</p><h2>{contentKind==='all'?'Content library':activeTitle}</h2><p>{visiblePages.length} {visiblePages.length===1?'record':'records'}{normalizedSearch?` matching “${searchQuery}”`:''}</p></div><button className="primary-button" type="button" onClick={() => startCreateContent(contentKind==='all'?'page':contentKind)}>Create {contentKind==='all'?'content':contentKind}</button></div>
        <div className="admin-page-list">
          {visiblePages.map((page) => (
            <article key={page.id}>
              <div className="admin-page-details">{page.mediaUrls[0]&&<img className="admin-page-thumbnail" src={page.mediaUrls[0]} alt="" loading="lazy"/>}<div><small>{page.type} · {page.visibility} · {page.status}{page.featured?' · featured':''}</small><h3>{page.title}</h3><code>{page.type === 'project' ? `/projects/${page.slug}` : page.type === 'article' ? `/writing/${page.slug}` : `/${page.slug}`}</code></div></div>
              <div className="admin-row-actions"><button type="button" onClick={() => { setEditingPage({ ...page }); setPreview(false) }}>Edit</button><button type="button" onClick={async()=>{setRevisionPage(page);setRevisions(await apiRequest<Array<{id:string;created_by:string;created_at:string;snapshot:ManagedPage}>>(`/api/admin/revisions/${page.type}/${page.id}`,token))}}>History</button><button type="button" onClick={() => void duplicatePage(page)}>Duplicate</button><button type="button" onClick={() => void deletePage(page)}>Delete</button></div>
            </article>
          ))}
          {visiblePages.length===0&&<p className="admin-empty">{content.pages.length?'No content matches this search or filter.':'No content has been created yet.'}</p>}
        </div>
      </section>

      {editingPage && (
        <section className="admin-panel admin-editor">
          <div className="admin-panel-heading"><div><p className="section-index">Content editor</p><h2>{editingPage.id ? 'Edit content' : 'Create content'}</h2></div><button type="button" onClick={() => { setEditingPage(null); setPreview(false) }}>Close</button></div>
          {preview ? (
            <article className="admin-preview"><p className="section-index">Preview · {editingPage.status} · {editingPage.visibility}</p><h1>{editingPage.title || 'Untitled page'}</h1><p>{editingPage.description}</p><div>{editingPage.content}</div></article>
          ) : (
            <form className="admin-form" onSubmit={savePage}>
              <label>Type<select value={editingPage.type} onChange={(event) => {
                const type = event.target.value as ManagedPage['type']
                setEditingPage({ ...editingPage, type, template: type === 'page' ? 'default' : type })
              }}><option value="page">Page</option><option value="project">Project</option><option value="article">Article</option></select></label>
              <label>Title<input required maxLength={120} value={editingPage.title} onChange={(event) => setEditingPage({ ...editingPage, title: event.target.value, slug: editingPage.slug || slugify(event.target.value) })} /></label>
              <label>URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} value={editingPage.slug} onChange={(event) => setEditingPage({ ...editingPage, slug: slugify(event.target.value) })} /></label>
              <label>Status<select value={editingPage.status} onChange={(event) => setEditingPage({ ...editingPage, status: event.target.value as ManagedPage['status'] })}><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></select></label>
              <label>Visibility<select value={editingPage.visibility} onChange={(event) => setEditingPage({ ...editingPage, visibility: event.target.value as ManagedPage['visibility'] })}><option value="private">Private</option><option value="public">Public</option></select></label>
              <label>Template<select value={editingPage.template} onChange={(event) => setEditingPage({ ...editingPage, template: event.target.value as ManagedPage['template'] })}><option value="default">Default</option><option value="project">Project</option><option value="article">Article</option></select></label>
              <label className="admin-wide">Description<textarea required maxLength={300} rows={2} value={editingPage.description} onChange={(event) => setEditingPage({ ...editingPage, description: event.target.value })} /></label>
              <label className="admin-wide">Page content / overview<textarea rows={6} value={editingPage.content} onChange={(event) => setEditingPage({ ...editingPage, content: event.target.value })} /></label>
              <BlockEditor blocks={editingPage.blocks} onChange={(blocks)=>setEditingPage({...editingPage,blocks})}/>
              {editingPage.type === 'project' && <>
                <label className="admin-wide">Problem<textarea rows={3} value={editingPage.problem} onChange={(event) => setEditingPage({ ...editingPage, problem: event.target.value })} /></label>
                <label className="admin-wide">Objectives<textarea rows={3} value={editingPage.objectives} onChange={(event) => setEditingPage({ ...editingPage, objectives: event.target.value })} /></label>
                <label>Role & contributions<textarea rows={3} value={editingPage.role} onChange={(event) => setEditingPage({ ...editingPage, role: event.target.value })} /></label>
                <label>Implementation details<textarea rows={3} value={editingPage.implementation} onChange={(event) => setEditingPage({ ...editingPage, implementation: event.target.value })} /></label>
                <label>Challenges & solutions<textarea rows={3} value={editingPage.challenges} onChange={(event) => setEditingPage({ ...editingPage, challenges: event.target.value })} /></label>
                <label>Verified outcomes<textarea rows={3} value={editingPage.outcomes} onChange={(event) => setEditingPage({ ...editingPage, outcomes: event.target.value })} /></label>
              </>}
              {editingPage.type === 'article' && <label>Related article slugs, comma-separated<input value={editingPage.relatedSlugs.join(', ')} onChange={(event) => setEditingPage({ ...editingPage, relatedSlugs: event.target.value.split(',').map((slug) => slugify(slug)).filter(Boolean) })} /></label>}
              <label>Category<input maxLength={80} value={editingPage.category} onChange={(event) => setEditingPage({ ...editingPage, category: event.target.value })} /></label>
              <label>Publication date<input type="date" value={editingPage.publishedAt} onChange={(event) => setEditingPage({ ...editingPage, publishedAt: event.target.value })} /></label>
              <label>Scheduled publication<input type="datetime-local" value={editingPage.scheduledAt ? editingPage.scheduledAt.slice(0,16) : ''} onChange={(event) => setEditingPage({ ...editingPage, scheduledAt: event.target.value ? new Date(event.target.value).toISOString() : '' })} /></label>
              <label>Tags, comma-separated<input value={editingPage.tags.join(', ')} onChange={(event) => setEditingPage({ ...editingPage, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} /></label>
              <label>SEO title<input maxLength={160} value={editingPage.seoTitle} onChange={(event) => setEditingPage({ ...editingPage, seoTitle: event.target.value })} /></label>
              <label>SEO description<textarea maxLength={300} rows={2} value={editingPage.seoDescription} onChange={(event) => setEditingPage({ ...editingPage, seoDescription: event.target.value })} /></label>
              <label>Repository URL<input type="url" value={editingPage.repositoryUrl} onChange={(event) => setEditingPage({ ...editingPage, repositoryUrl: event.target.value })} /></label>
              <label>Live demo URL<input type="url" value={editingPage.liveUrl} onChange={(event) => setEditingPage({ ...editingPage, liveUrl: event.target.value })} /></label>
              <label className="admin-wide">Media URLs, one per line<textarea rows={3} value={editingPage.mediaUrls.join('\n')} onChange={(event) => setEditingPage({ ...editingPage, mediaUrls: event.target.value.split('\n').map((url) => url.trim()).filter(Boolean) })} /></label>
              <label className="admin-check"><input type="checkbox" checked={editingPage.inNavigation} onChange={(event) => setEditingPage({ ...editingPage, inNavigation: event.target.checked })} /> Add to additional navigation</label>
              <label className="admin-check"><input type="checkbox" checked={editingPage.featured} onChange={(event) => setEditingPage({ ...editingPage, featured: event.target.checked })} /> Featured content</label>
              <div className="admin-form-actions"><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save content'}</button><button type="button" onClick={() => setPreview(true)}>Preview</button><button type="button" onClick={() => setEditingPage({ ...editingPage, status: 'published', visibility: 'public' })}>Prepare publish</button></div>
            </form>
          )}
        </section>
      )}
      </>}

      {revisionPage && activeView === 'content' && (
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="section-index">History</p><h2>{revisionPage.title}</h2></div><button type="button" onClick={()=>setRevisionPage(null)}>Close</button></div>
          <div className="admin-revisions">{revisions.length?revisions.map((revision)=><article key={revision.id}><div><strong>{revision.created_at}</strong><small>{revision.created_by}</small></div><p>{revision.snapshot.description||revision.snapshot.title}</p><button type="button" onClick={async()=>{if(confirm('Restore this revision?')){const restored=await apiRequest<ManagedPage>(`/api/admin/revisions/${revisionPage.type}/${revisionPage.id}/restore/${revision.id}`,token,{method:'POST'});setContent((current)=>({...current,pages:current.pages.map((page)=>page.id===restored.id?restored:page)}));setRevisionPage(null);setStatus('Revision restored.')}}}>Restore</button></article>):<p className="admin-empty">No revisions exist for this record.</p>}</div>
        </section>
      )}

      {activeView === 'messages' && (
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="section-index">Contact / Inbox</p><h2>Messages</h2><p>{visibleMessages.length} message{visibleMessages.length===1?'':'s'} shown</p></div><label className="admin-inline-filter">Status<select aria-label="Filter messages by status" value={messageFilter} onChange={(event)=>setMessageFilter(event.target.value as typeof messageFilter)}><option value="all">All messages</option><option value="unread">Unread</option><option value="read">Read</option><option value="archived">Archived</option></select></label></div>
          <div className="admin-message-list">{visibleMessages.length ? visibleMessages.map((message) => <article key={message.id}>
            <div><small>{message.status} · {message.created_at}</small><h3>{message.subject}</h3><p>{message.name} · {message.email}</p></div>
            <p className="admin-message-body">{message.message}</p>
            <div className="admin-row-actions"><button type="button" onClick={async()=>{await apiRequest(`/api/admin/messages/${message.id}`,token,{method:'PATCH',body:JSON.stringify({status:'read'})});setMessages((items)=>items.map((item)=>item.id===message.id?{...item,status:'read'}:item))}}>Mark read</button><button type="button" onClick={async()=>{await apiRequest(`/api/admin/messages/${message.id}`,token,{method:'PATCH',body:JSON.stringify({status:'archived'})});setMessages((items)=>items.map((item)=>item.id===message.id?{...item,status:'archived'}:item))}}>Archive</button><button type="button" onClick={async()=>{if(confirm('Delete this message?')){await apiRequest(`/api/admin/messages/${message.id}`,token,{method:'DELETE'});setMessages((items)=>items.filter((item)=>item.id!==message.id))}}}>Delete</button></div>
          </article>) : <p className="admin-empty">{messages.length?'No messages match the current search and filter.':'No contact messages have been received.'}</p>}</div>
        </section>
      )}

      {activeView === 'media' && (
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="section-index">Assets / Library</p><h2>Media library</h2><p>{visibleMedia.length} of {media.length} file{media.length===1?'':'s'}</p></div><div className="admin-row-actions" role="group" aria-label="Media layout"><button type="button" aria-pressed={mediaLayout==='grid'} onClick={()=>setMediaLayout('grid')}>Grid</button><button type="button" aria-pressed={mediaLayout==='list'} onClick={()=>setMediaLayout('list')}>List</button></div></div>
          <form className="admin-media-upload" onSubmit={async(event)=>{event.preventDefault();const form=event.currentTarget;const formData=new FormData(form);await apiRequest(`/api/admin/media`,token,{method:'POST',body:formData,headers:{}});form.reset();setMedia(await apiRequest<typeof media>(`/api/admin/media`,token))}}>
            <label>File<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4" required /></label><label>Alternative text<input name="altText" /></label><label>Folder<input name="folder" /></label><button className="primary-button" type="submit">Upload</button>
          </form>
          <div className={`admin-media-grid ${mediaLayout==='list'?'is-list':''}`}>{visibleMedia.length?visibleMedia.map((item)=><article key={item.id}>
            <small>{item.mime_type} · {Math.ceil(item.size/1024)} KB</small>
            <label>File name<input value={item.original_name} onChange={(event)=>setMedia((items)=>items.map((entry)=>entry.id===item.id?{...entry,original_name:event.target.value}:entry))}/></label>
            <label>Folder<input value={item.folder} onChange={(event)=>setMedia((items)=>items.map((entry)=>entry.id===item.id?{...entry,folder:event.target.value}:entry))}/></label>
            <label>Alternative text<input value={item.alt_text} onChange={(event)=>setMedia((items)=>items.map((entry)=>entry.id===item.id?{...entry,alt_text:event.target.value}:entry))}/></label>
            {item.mime_type.startsWith('image/')&&item.folder!=='private'?<img src={`${API_URL}/api/media/${item.id}`} alt={item.alt_text} />:<p>{item.alt_text||'No alternative text'}</p>}
            <div className="admin-row-actions">
              <button type="button" onClick={()=>void navigator.clipboard.writeText(`${API_URL}/api/media/${item.id}`)}>Copy URL</button>
              <label>Replace<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4" onChange={async(event)=>{const file=event.target.files?.[0];if(!file)return;const form=new FormData();form.append('file',file);const replaced=await apiRequest<{id:string;name:string;original_name:string;mime_type:string;size:number;alt_text:string;folder:string;created_at:string}>(`/api/admin/media/${item.id}/replace`,token,{method:'PUT',body:form});setMedia((items)=>items.map((entry)=>entry.id===item.id?replaced:entry));setStatus('Media replaced.')}}/></label>
              <button type="button" onClick={async()=>{await apiRequest(`/api/admin/media/${item.id}`,token,{method:'PATCH',body:JSON.stringify({original_name:item.original_name,folder:item.folder,alt_text:item.alt_text})});setStatus('Media metadata saved.')}}>Save</button>
              <button type="button" onClick={async()=>{if(confirm('Delete this media file?')){await apiRequest(`/api/admin/media/${item.id}`,token,{method:'DELETE'});setMedia((items)=>items.filter((entry)=>entry.id!==item.id))}}}>Delete</button>
            </div>
          </article>):<p className="admin-empty">{media.length?'No media matches this search.':'The media library is empty.'}</p>}</div>
        </section>
      )}

      {activeView === 'navigation' && (
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="section-index">Menus</p><h2>Navigation manager</h2></div><button type="button" className="primary-button" onClick={()=>setNavigationItems((items)=>[...items,{label:'',href:'/',position:items.length,menu:'primary',desktop_visible:true,mobile_visible:true,external:false,parent_id:null}])}>Add item</button></div>
          <div className="admin-sections">{visibleNavigationItems.map((item)=>({item,index:navigationItems.indexOf(item)})).map(({item,index})=><article key={item.id||index}><label>Label<input value={item.label} onChange={(event)=>setNavigationItems((items)=>items.map((entry,i)=>i===index?{...entry,label:event.target.value}:entry))}/></label><label>Destination<input value={item.href} onChange={(event)=>setNavigationItems((items)=>items.map((entry,i)=>i===index?{...entry,href:event.target.value}:entry))}/></label><label>Menu<select value={item.menu} onChange={(event)=>setNavigationItems((items)=>items.map((entry,i)=>i===index?{...entry,menu:event.target.value as 'primary'|'footer'}:entry))}><option value="primary">Primary</option><option value="footer">Footer</option></select></label><label>Parent dropdown<select value={item.parent_id||''} onChange={(event)=>setNavigationItems((items)=>items.map((entry,i)=>i===index?{...entry,parent_id:event.target.value||null}:entry))}><option value="">Top level</option>{navigationItems.filter((entry)=>entry.id!==item.id).map((entry)=><option key={entry.id||entry.label} value={entry.id||''}>{entry.label||'Untitled'}</option>)}</select></label><label className="admin-check"><input type="checkbox" checked={item.external} onChange={(event)=>setNavigationItems((items)=>items.map((entry,i)=>i===index?{...entry,external:event.target.checked}:entry))}/>External link</label><label className="admin-check"><input type="checkbox" checked={item.desktop_visible} onChange={(event)=>setNavigationItems((items)=>items.map((entry,i)=>i===index?{...entry,desktop_visible:event.target.checked}:entry))}/>Desktop</label><label className="admin-check"><input type="checkbox" checked={item.mobile_visible} onChange={(event)=>setNavigationItems((items)=>items.map((entry,i)=>i===index?{...entry,mobile_visible:event.target.checked}:entry))}/>Mobile</label><button type="button" onClick={()=>setNavigationItems((items)=>items.filter((_,i)=>i!==index))}>Remove</button></article>)}
            {visibleNavigationItems.length===0&&<p className="admin-empty">No menu items match this search.</p>}</div>
          <button type="button" className="primary-button" onClick={async()=>{await apiRequest('/api/admin/navigation',token,{method:'PUT',body:JSON.stringify(navigationItems.map((item,index)=>({...item,position:index})))});setStatus('Navigation saved.')}}>Save navigation</button>
        </section>
      )}

      {activeView === 'settings' && (
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="section-index">Configuration</p><h2>Global settings</h2></div></div>
          <form className="admin-form" onSubmit={(event)=>event.preventDefault()}>
            <label>Full name<input value={String(settings.fullName||'')} onChange={(event)=>setSettings({...settings,fullName:event.target.value})}/></label>
            <label>Professional title<input value={String(settings.professionalTitle||'')} onChange={(event)=>setSettings({...settings,professionalTitle:event.target.value})}/></label>
            <label>Contact email<input type="email" value={String(settings.contactEmail||'')} onChange={(event)=>setSettings({...settings,contactEmail:event.target.value})}/></label>
            <label>Location<input value={String(settings.location||'')} onChange={(event)=>setSettings({...settings,location:event.target.value})}/></label>
            <label className="admin-wide">Short introduction<textarea rows={3} value={String(settings.introduction||'')} onChange={(event)=>setSettings({...settings,introduction:event.target.value})}/></label>
            <label>Primary color<input type="color" value={String(settings.primaryColor||'#8b5cf6')} onChange={(event)=>setSettings({...settings,primaryColor:event.target.value})}/></label>
            <label>Theme<select value={String(settings.theme||'dark')} onChange={(event)=>setSettings({...settings,theme:event.target.value})}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label>
            <div className="admin-form-actions"><button className="primary-button" type="button" onClick={async()=>{await apiRequest('/api/admin/settings',token,{method:'PUT',body:JSON.stringify(settings)});setStatus('Global settings saved.')}}>Save settings</button></div>
          </form>
        </section>
      )}

      {['experience','education','certifications','skills','testimonials'].includes(activeView) && (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="section-index">Portfolio records</p><h2>{activeView[0].toUpperCase()+activeView.slice(1)}</h2></div><button type="button" className="primary-button" onClick={async()=>{const record:Record<string,unknown>={title:'Untitled',description:'',status:'draft',position:(entities[activeView]?.length||0)};const created=await apiRequest<Record<string,unknown>&{id:string}>(`/api/admin/entities/${activeView}`,token,{method:'POST',body:JSON.stringify(record)});setEntities((current)=>({...current,[activeView]:[...(current[activeView]||[]),created as Record<string,unknown>&{id:string;status:string;position:number}]}));}}>Add {activeView.replace(/s$/,'')}</button></div>
          <div className="admin-entity-list">
            {visibleEntities.map((entity)=>(
              <article key={entity.id}>
                <div className="admin-form">
                  <label>Title<input value={String(entity.title||entity.name||'')} onChange={(event)=>setEntities((current)=>({...current,[activeView]:current[activeView].map((item)=>item.id===entity.id?{...item,title:event.target.value}:item)}))}/></label>
                  <label>Description<textarea rows={3} value={String(entity.description||'')} onChange={(event)=>setEntities((current)=>({...current,[activeView]:current[activeView].map((item)=>item.id===entity.id?{...item,description:event.target.value}:item)}))}/></label>
                  <label>Organization / issuer<input value={String(entity.organization||entity.issuer||entity.institution||'')} onChange={(event)=>setEntities((current)=>({...current,[activeView]:current[activeView].map((item)=>item.id===entity.id?{...item,organization:event.target.value}:item)}))}/></label>
                  <label>Role / programme<input value={String(entity.role||entity.programme||'')} onChange={(event)=>setEntities((current)=>({...current,[activeView]:current[activeView].map((item)=>item.id===entity.id?{...item,role:event.target.value}:item)}))}/></label>
                  <label>Status<select value={String(entity.status)} onChange={(event)=>setEntities((current)=>({...current,[activeView]:current[activeView].map((item)=>item.id===entity.id?{...item,status:event.target.value}:item)}))}><option value="draft">Draft</option><option value="published">Published</option></select></label>
                  <label>Position<input type="number" value={Number(entity.position)} onChange={(event)=>setEntities((current)=>({...current,[activeView]:current[activeView].map((item)=>item.id===entity.id?{...item,position:Number(event.target.value)}:item)}))}/></label>
                </div>
                <div className="admin-row-actions">
                  <button type="button" onClick={async()=>{await apiRequest(`/api/admin/entities/${activeView}/${entity.id}`,token,{method:'PUT',body:JSON.stringify(entity)});setStatus(`${activeView} record saved.`)}}>Save</button>
                  <button type="button" onClick={async()=>{if(confirm('Delete this record?')){await apiRequest(`/api/admin/entities/${activeView}/${entity.id}`,token,{method:'DELETE'});setEntities((current)=>({...current,[activeView]:current[activeView].filter((item)=>item.id!==entity.id)}))}}}>Delete</button>
                </div>
              </article>
            ))}
            {visibleEntities.length===0 && <p className="admin-empty">{(entities[activeView]||[]).length?'No records match this search.':'No records in this collection.'}</p>}
          </div>
        </section>
      )}

      {activeView === 'seo' && (
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="section-index">Search</p><h2>SEO manager</h2></div></div>
          <div className="admin-form">
            <label>Global SEO title<input value={String(settings.seoTitle||'')} onChange={(event)=>setSettings({...settings,seoTitle:event.target.value})}/></label>
            <label>Canonical URL<input value={String(settings.canonicalUrl||'')} onChange={(event)=>setSettings({...settings,canonicalUrl:event.target.value})}/></label>
            <label className="admin-wide">Global meta description<textarea rows={3} value={String(settings.seoDescription||'')} onChange={(event)=>setSettings({...settings,seoDescription:event.target.value})}/></label>
            <label>Default social image URL<input value={String(settings.ogImage||'')} onChange={(event)=>setSettings({...settings,ogImage:event.target.value})}/></label>
            <label>Robots directive<select value={String(settings.robots||'index,follow')} onChange={(event)=>setSettings({...settings,robots:event.target.value})}><option value="index,follow">Index, follow</option><option value="noindex,nofollow">No index, no follow</option></select></label>
            <div className="admin-form-actions"><button className="primary-button" type="button" onClick={async()=>{await apiRequest('/api/admin/settings',token,{method:'PUT',body:JSON.stringify(settings)});setStatus('SEO settings saved.')}}>Save SEO</button></div>
          </div>
          <div className="admin-preview"><p className="section-index">Search preview</p><h2>{String(settings.seoTitle||settings.fullName||'Website title')}</h2><p>{String(settings.canonicalUrl||'https://your-domain.example')}</p><p>{String(settings.seoDescription||'Add a unique meta description.')}</p></div>
        </section>
      )}

      {activeView === 'redirects' && (
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="section-index">Routing</p><h2>Redirect manager</h2></div></div>
          <form className="admin-form" onSubmit={async(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);await apiRequest('/api/admin/redirects',token,{method:'POST',body:JSON.stringify({source:form.get('source'),destination:form.get('destination'),status_code:form.get('status_code')})});setRedirects(await apiRequest<typeof redirects>('/api/admin/redirects',token));event.currentTarget.reset()}}>
            <label>Source path<input name="source" required pattern="\\/.*" placeholder="/old-page"/></label><label>Destination<input name="destination" required placeholder="/about"/></label><label>Status<select name="status_code"><option value="301">301 Permanent</option><option value="302">302 Temporary</option></select></label><div className="admin-form-actions"><button className="primary-button">Create redirect</button></div>
          </form>
          <div className="admin-backup-list">{visibleRedirects.map((redirect)=><article key={redirect.id}><div><strong>{redirect.source} → {redirect.destination}</strong><small>{redirect.status_code} redirect · {redirect.active?'Active':'Inactive'}</small></div><button type="button" onClick={async()=>{await apiRequest(`/api/admin/redirects/${redirect.id}`,token,{method:'DELETE'});setRedirects((items)=>items.filter((item)=>item.id!==redirect.id))}}>Delete</button></article>)}
            {visibleRedirects.length===0&&<p className="admin-empty">{redirects.length?'No redirects match this search.':'No redirects have been configured.'}</p>}</div>
        </section>
      )}

      {activeView === 'integrations' && (
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="section-index">Connections</p><h2>Integrations</h2></div></div>
          <div className="admin-entity-list">{visibleIntegrations.map((integration)=><article key={integration.key}><h3>{integration.key}</h3><p>Status: <span className={`admin-badge status-${integration.status}`}>{integration.status}</span></p><label className="admin-check"><input type="checkbox" checked={integration.enabled} onChange={async (event)=>{const updated=await apiRequest<{key:string;enabled:boolean;status:string;updated_at:string}>(`/api/admin/integrations/${integration.key}`,token,{method:'PUT',body:JSON.stringify({enabled:event.target.checked,configuration:{}})});setIntegrations((items)=>items.map((item)=>item.key===integration.key?{...item,enabled:updated.enabled,status:updated.status,updated_at:updated.updated_at}:item))}}/>Enabled</label></article>)}
            {visibleIntegrations.length===0&&<p className="admin-empty">No integrations match this search.</p>}</div>
        </section>
      )}

      {activeView === 'analytics' && (
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="section-index">Privacy</p><h2>Analytics</h2></div><button type="button" onClick={async()=>{try{const actual=await apiRequest<{results?:Record<string,unknown>}>('/api/analytics/export/plausible',token,{method:'POST',body:JSON.stringify({period:'7d'})});setStatus(`Plausible 7-day data loaded: ${JSON.stringify(actual.results||actual)}`)}catch(error){setStatus(error instanceof Error?error.message:'Plausible is unavailable.')}}}>Query Plausible</button></div>
          <div className="admin-stat-grid"><article><small>Accepted events</small><strong>{analytics?.total||0}</strong></article><article><small>Provider mode</small><strong>{analytics?.configured?'Plausible':'Internal'}</strong></article></div>
          <div className="admin-overview-grid">
            <section><h3>Popular paths</h3>{analytics?.popular.length?analytics.popular.map((item)=><article className="admin-traffic-row" key={item.path}><div className="admin-traffic-label"><strong>{item.path}</strong><small>{item.count}</small></div><progress aria-label={`${item.count} tracked events for ${item.path}`} max={maxPopularPathCount} value={item.count}/></article>):<p className="admin-empty">No page activity is available yet.</p>}</section>
            <section><h3>Popular events</h3>{analytics?.events.length?analytics.events.map((item)=><article className="admin-traffic-row" key={item.event_type}><div className="admin-traffic-label"><strong>{item.event_type}</strong><small>{item.count}</small></div><progress aria-label={`${item.count} events of type ${item.event_type}`} max={Math.max(1,...(analytics?.events||[]).map((event)=>event.count))} value={item.count}/></article>):<p className="admin-empty">No first-party events have been recorded.</p>}</section>
          </div>
        </section>
      )}

      {activeView === 'users' && (
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="section-index">Access</p><h2>Users & roles</h2></div></div>
          <form className="admin-form" onSubmit={async(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);const created=await apiRequest<{email:string;role:string}>('/api/admin/users',token,{method:'POST',body:JSON.stringify({email:form.get('email'),role:form.get('role')})});setUsers((items)=>[...items,{id:String(items.length),...created,created_at:new Date().toISOString()}]);event.currentTarget.reset()}}>
            <label>Email<input name="email" type="email" required/></label><label>Role<select name="role"><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="super_admin">Super Admin</option></select></label><div className="admin-form-actions"><button className="primary-button">Add user</button></div>
          </form>
          <div className="admin-backup-list">{visibleUsers.map((user)=><article key={user.id}><div><strong>{user.email}</strong><small>{user.role}</small></div><span className="admin-badge">{user.role.replace('_',' ')}</span></article>)}
            {visibleUsers.length===0&&<p className="admin-empty">{users.length?'No users match this search.':'No administrator users are available.'}</p>}</div>
        </section>
      )}

      {activeView === 'security' && (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="section-index">Security</p><h2>Security & audit log</h2></div><div className="admin-row-actions">
            {mfaEnabled
              ? <><strong>Authenticator MFA enabled</strong><button type="button" onClick={()=>void disableMfa()}>Disable MFA</button></>
              : <button type="button" onClick={()=>void setupMfa()}>Set up MFA</button>}
          </div></div>
          {mfaSetup && (
            <div className="admin-mfa-setup">
              <p>In your authenticator app, add an account using this setup key or authenticator link:</p>
              <label>Setup key<input readOnly value={mfaSetup.secret}/></label>
              <a href={mfaSetup.otpauth}>Open authenticator link</a>
              <label>Six-digit authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event)=>setMfaCode(event.target.value.replace(/\D/g,'').slice(0,6))}/></label>
              <div className="admin-row-actions"><button type="button" className="primary-button" disabled={mfaCode.length!==6} onClick={()=>void enableMfa()}>Verify and enable</button><button type="button" onClick={()=>setMfaSetup(null)}>Cancel setup</button></div>
            </div>
          )}
          <div className="admin-audit-list">{visibleAuditLog.length?visibleAuditLog.map((entry)=><article key={`${entry.action}-${entry.created_at}`}><small>{entry.created_at}</small><strong>{entry.action.replaceAll('_',' ')}</strong><p>{entry.actor} · {entry.details}</p></article>):<p className="admin-empty">{auditLog.length?'No activity matches this search.':'No security activity recorded.'}</p>}</div>
        </section>
      )}

      {activeView === 'backups' && (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="section-index">Recovery</p><h2>Backup & restore</h2><p>Backups include the database, page content, and uploaded files. Restores keep your current admin accounts, sessions, and MFA settings.</p></div><div className="admin-row-actions">
            <button type="button" className="primary-button" onClick={()=>void createBackup()}>Create full backup</button>
            <button type="button" onClick={()=>void downloadAdminFile('/api/admin/backup/export',token,'portfolio-content-export.json').then(()=>setStatus('Downloaded content export.')).catch((error:unknown)=>setStatus(error instanceof Error?error.message:'Unable to export content.'))}>Export JSON</button>
          </div></div>
          <div className="admin-backup-list">{backupHistory.length?backupHistory.map((backup)=><article key={backup.name}>
            <div><strong>{backup.name}</strong><small>{backup.createdAt} · {Math.ceil(backup.size/1024)} KB{backup.restorable?' · Full backup':' · Legacy database-only backup'}</small></div>
            <div className="admin-row-actions">
              {backup.restorable && <><button type="button" onClick={()=>void downloadAdminFile(`/api/admin/backup/${encodeURIComponent(backup.name)}/download`,token,`${backup.name}.tar.gz`).then(()=>setStatus('Downloaded complete backup archive.')).catch((error:unknown)=>setStatus(error instanceof Error?error.message:'Unable to download backup.'))}>Download full archive</button><button type="button" onClick={()=>void downloadBackupFile(backup.name,'portfolio.sqlite')}>Download database</button><button type="button" onClick={()=>void downloadBackupFile(backup.name,'portfolio-content.json')}>Download content</button><button type="button" onClick={()=>void restoreBackup(backup.name)}>Restore</button></>}
            </div>
          </article>):<p className="admin-empty">No backups have been created.</p>}</div>
        </section>
      )}
            </div>
          </main>
        </div>
      </div>
    </section>
  )
}
