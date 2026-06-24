import { createContext, useContext } from 'react'

export interface PageChromeState {
  title?: string
  description?: string
}

export interface PageChromeContextValue {
  pageChrome: PageChromeState
  resetPageChrome: () => void
  setPageChrome: (pageChrome: PageChromeState) => void
}

export const PageChromeContext =
  createContext<PageChromeContextValue | null>(null)

export function usePageChrome() {
  const context = useContext(PageChromeContext)

  if (!context) {
    throw new Error('usePageChrome must be used within PageChromeProvider.')
  }

  return context
}
