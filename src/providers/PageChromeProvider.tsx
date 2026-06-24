import { type PropsWithChildren, useCallback, useMemo, useState } from 'react'
import {
  PageChromeContext,
  type PageChromeContextValue,
  type PageChromeState,
} from './pageChromeContext'

export function PageChromeProvider({ children }: PropsWithChildren) {
  const [pageChrome, setPageChromeState] = useState<PageChromeState>({})
  const resetPageChrome = useCallback(() => setPageChromeState({}), [])
  const setPageChrome = useCallback(
    (nextPageChrome: PageChromeState) => setPageChromeState(nextPageChrome),
    [],
  )

  const value = useMemo<PageChromeContextValue>(
    () => ({
      pageChrome,
      resetPageChrome,
      setPageChrome,
    }),
    [pageChrome, resetPageChrome, setPageChrome],
  )

  return (
    <PageChromeContext.Provider value={value}>
      {children}
    </PageChromeContext.Provider>
  )
}
