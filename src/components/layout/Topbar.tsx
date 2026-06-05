import { Bell, LogOut, Search, UserCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { routePaths } from '../../config/routes'
import { useAuthStore } from '../../store/authStore'
import { storageKeys } from '../../lib/storage'

export function Topbar() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)

  return (
    <header className="sticky top-0 z-20 flex min-h-[var(--spacing-topbar)] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 rounded-control border border-border bg-surface px-3 py-2 text-sm text-muted shadow-sm">
        <Search className="size-4" />
        <span>Global search placeholder</span>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost">
          <Bell className="mr-2 size-4" />
          Alerts
        </Button>
        <div className="hidden items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-sm shadow-sm sm:flex">
          <UserCircle2 className="size-4 text-primary" />
          <div>
            <p className="font-medium text-foreground">{user?.name ?? 'Guest'}</p>
            <p className="text-xs text-muted">{user?.role ?? 'No role'}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            window.localStorage.removeItem(storageKeys.authSession)
            logout()
            navigate(routePaths.login)
          }}
        >
          <LogOut className="mr-2 size-4" />
          Logout
        </Button>
      </div>
    </header>
  )
}
