import type { PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../providers/AuthProvider'
import { PermissionProvider } from '../providers/PermissionProvider'
import { PageChromeProvider } from '../providers/PageChromeProvider'
import { QueryProvider } from '../providers/QueryProvider'
import { ThemeProvider } from '../providers/ThemeProvider'
import { ToastProvider } from '../providers/ToastProvider'
import { MediaViewerProvider } from '../components/media'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <QueryProvider>
          <PageChromeProvider>
            <AuthProvider>
              <PermissionProvider>
                <ToastProvider>
                  <MediaViewerProvider>{children}</MediaViewerProvider>
                </ToastProvider>
              </PermissionProvider>
            </AuthProvider>
          </PageChromeProvider>
        </QueryProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
