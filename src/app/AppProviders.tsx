import type { PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../providers/AuthProvider'
import { PermissionProvider } from '../providers/PermissionProvider'
import { PageChromeProvider } from '../providers/PageChromeProvider'
import { QueryProvider } from '../providers/QueryProvider'
import { ToastProvider } from '../providers/ToastProvider'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <BrowserRouter>
      <QueryProvider>
        <PageChromeProvider>
          <AuthProvider>
            <PermissionProvider>
              <ToastProvider>{children}</ToastProvider>
            </PermissionProvider>
          </AuthProvider>
        </PageChromeProvider>
      </QueryProvider>
    </BrowserRouter>
  )
}
