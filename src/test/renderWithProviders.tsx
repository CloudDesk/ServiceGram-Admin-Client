import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PageChromeProvider } from '../providers/PageChromeProvider'
import { useAuthStore } from '../store/authStore'
import { PageChromeOutlet } from './PageChromeOutlet'

interface RenderOptions {
  /** Permission codes the acting admin holds. Defaults to none. */
  permissions?: string[]
  /** Route pattern, when the screen reads params. Defaults to a bare path. */
  path?: string
  initialEntry?: string
}

/**
 * Renders a screen with the providers the admin shell supplies, and seeds the
 * auth store so permission-aware states can be asserted without a login flow.
 */
export function renderWithProviders(
  element: ReactElement,
  { initialEntry = '/', path = '/', permissions = [] }: RenderOptions = {},
) {
  useAuthStore.setState({
    session: null,
    user: null,
    accessToken: 'test-token',
    permissions,
  })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PageChromeProvider>
          <PageChromeOutlet />
          <Routes>
            <Route element={element} path={path} />
          </Routes>
        </PageChromeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
