import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ContentProvider } from './lib/content'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

const application = (
  <StrictMode>
    <ContentProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ContentProvider>
  </StrictMode>
)

const currentPath = window.location.pathname.replace(/\/+$/, '') || '/'
if (rootElement.hasChildNodes() && window.__PRERENDERED_PATH__ === currentPath) hydrateRoot(rootElement, application)
else createRoot(rootElement).render(application)
