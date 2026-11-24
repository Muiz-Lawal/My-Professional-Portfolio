import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react'

export interface PublicPage {
  id: string
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
  publishedAt: string
  scheduledAt?: string
  problem?: string
  objectives?: string
  role?: string
  implementation?: string
  challenges?: string
  outcomes?: string
  relatedSlugs?: string[]
  blocks?: Array<{type:string;content:string}>
}

export interface HomeSectionContent {
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

export interface PublicContent {
  pages: PublicPage[]
  sections: HomeSectionContent[]
  settings?: Record<string, unknown>
  navigation?: Array<{id:string;label:string;href:string;position:number;menu:string;desktop_visible:number;mobile_visible:number;external:number;parent_id?:string|null}>
  collections?: Record<string, Array<Record<string, unknown> & { id: string; status: string; position: number }>>
}

interface ContentContextValue {
  content: PublicContent
  error: string
  loading: boolean
}

declare global {
  interface Window {
    __PORTFOLIO_CONTENT__?: PublicContent
    __PRERENDERED_PATH__?: string
  }
}

export const CONTENT_API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5057'

const emptyContent: PublicContent = { pages: [], sections: [] }
const ContentContext = createContext<ContentContextValue | null>(null)

export function ContentProvider({ children, initialContent }: { children: ReactNode; initialContent?: PublicContent }) {
  const [content, setContent] = useState<PublicContent>(() => initialContent ?? (typeof window === 'undefined' ? emptyContent : window.__PORTFOLIO_CONTENT__ ?? emptyContent))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    fetch(`${CONTENT_API}/api/content`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Content service returned ${response.status}.`)
        return response.json() as Promise<PublicContent>
      })
      .then((result) => {
        if (active) setContent(result)
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        if (active) setError(cause instanceof Error ? cause.message : 'Published content could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  return createElement(ContentContext.Provider, { value: { content, error, loading } }, children)
}

export function usePublicContent() {
  const value = useContext(ContentContext)
  if (!value) throw new Error('usePublicContent must be used within ContentProvider.')
  const { content, error, loading } = value
  return { ...content, error, loading }
}
