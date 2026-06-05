import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  UserCircle2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { routePaths } from '../../config/routes'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { storageKeys } from '../../lib/storage'

export function Topbar() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!profileOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [profileOpen])

  const handleLogout = () => {
    window.localStorage.removeItem(storageKeys.authSession)
    logout()
    setProfileOpen(false)
    navigate(routePaths.login)
  }

  const handleNavigate = (path: string) => {
    setProfileOpen(false)
    navigate(path)
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-[var(--spacing-topbar)] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          className="lg:hidden"
          size="sm"
          type="button"
          variant="secondary"
          onClick={openMobileSidebar}
        >
          <Menu className="size-4" />
        </Button>
        <div className="flex min-w-0 items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-sm text-muted shadow-sm">
          <Search className="size-4 shrink-0" />
          <span className="flex min-h-5 items-center truncate leading-none">
            Global search placeholder
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button aria-label="Alerts" size="sm" type="button" variant="ghost">
          <Bell className="size-4 sm:mr-2" />
          <span className="hidden sm:inline">Alerts</span>
        </Button>

        <div className="relative" ref={profileRef}>
          <button
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-left text-sm shadow-sm transition hover:border-foreground/15 hover:bg-surface-muted/40"
            type="button"
            onClick={() => setProfileOpen((current) => !current)}
          >
            <UserCircle2 className="size-4 shrink-0 text-primary" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate font-medium text-foreground">
                {user?.name ?? 'Guest'}
              </p>
              <p className="truncate text-xs text-muted">
                {user?.role ?? 'No role'}
              </p>
            </div>
            <ChevronDown
              className={`hidden size-4 text-muted transition-transform sm:block ${profileOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {profileOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.625rem)] z-40 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[1.25rem] border border-border bg-white shadow-[0_20px_48px_rgba(15,23,42,0.16)]">
              <div className="border-b border-border bg-surface/70 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-primary">
                    <UserCircle2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {user?.name ?? 'Guest'}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {user?.role ?? 'No role'}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {user?.email ?? 'No email available'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <button
                  className="flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-surface-muted"
                  type="button"
                  onClick={() => handleNavigate(routePaths.profile)}
                >
                  <User className="size-4 text-muted" />
                  <span>View Profile</span>
                </button>
                <button
                  className="flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-surface-muted"
                  type="button"
                  onClick={() => handleNavigate(routePaths.settings)}
                >
                  <Settings className="size-4 text-muted" />
                  <span>Account Settings</span>
                </button>
              </div>

              <div className="border-t border-border p-2">
                <button
                  className="flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-2.5 text-left text-sm text-danger transition hover:bg-danger/5"
                  type="button"
                  onClick={handleLogout}
                >
                  <LogOut className="size-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
