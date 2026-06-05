import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppBootstrap } from './app/main'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppBootstrap />
  </StrictMode>,
)
