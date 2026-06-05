import type { PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../providers/AuthProvider'
import { PermissionProvider } from '../providers/PermissionProvider'
import { QueryProvider } from '../providers/QueryProvider'
import { ToastProvider } from '../providers/ToastProvider'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <BrowserRouter>
      <QueryProvider>
        <AuthProvider>
          <PermissionProvider>
            <ToastProvider>{children}</ToastProvider>
          </PermissionProvider>
        </AuthProvider>
      </QueryProvider>
    </BrowserRouter>
  )
}
