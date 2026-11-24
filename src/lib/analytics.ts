type AnalyticsEvent =
  | 'Navigation Click'
  | 'Project Outbound Click'
  | 'Project Case Study Open'
  | 'CV Download'
  | 'Contact Form Success'

type EventOptions = { props?: Record<string, string> }
type PlausibleFunction = ((eventName: AnalyticsEvent, options?: EventOptions) => void) & {
  q?: Array<[AnalyticsEvent, EventOptions?]>
}

declare global {
  interface Window {
    plausible?: PlausibleFunction
  }
}

const domain = import.meta.env.VITE_ANALYTICS_DOMAIN?.trim()
const enabled = import.meta.env.VITE_ANALYTICS_ENABLED === 'true'
const scriptUrl = import.meta.env.VITE_ANALYTICS_SCRIPT_URL?.trim() || 'https://plausible.io/js/script.js'
const apiUrl = import.meta.env.VITE_ANALYTICS_API_URL?.trim()

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function isValidDomain(value: string): boolean {
  return /^(?=.{1,253}$)([a-zA-Z0-9]+([a-zA-Z0-9-]*[a-zA-Z0-9])?)(\.([a-zA-Z0-9]+([a-zA-Z0-9-]*[a-zA-Z0-9])?))*$/.test(value)
}

export function initializeAnalytics(): void {
  if (!enabled || !domain || !isValidDomain(domain) || !isHttpsUrl(scriptUrl)) return
  if (document.querySelector('script[data-portfolio-analytics]')) return

  window.plausible = window.plausible || Object.assign(
    ((...args: [AnalyticsEvent, EventOptions?]) => {
      window.plausible?.q?.push(args)
    }) as PlausibleFunction,
    { q: [] as Array<[AnalyticsEvent, EventOptions?]> },
  )

  const script = document.createElement('script')
  script.src = scriptUrl
  script.defer = true
  script.dataset.domain = domain
  script.dataset.portfolioAnalytics = 'true'
  if (apiUrl && isHttpsUrl(apiUrl)) script.dataset.api = apiUrl
  document.head.appendChild(script)
}

export function trackEvent(eventName: AnalyticsEvent, props?: Record<string, string>): void {
  if (!enabled || !domain || !isValidDomain(domain)) return
  window.plausible?.(eventName, props ? { props } : undefined)
}
