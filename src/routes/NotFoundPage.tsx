import { ArrowLeft, Compass, Home, SearchX } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { routePaths } from '../config/routes'
import { useAuthSession } from '../features/auth/hooks/useAuthSession'
import { useAuthStore } from '../store/authStore'
import {
  getAccessibleNavigationItems,
  getPreferredRecoveryItem,
  humanizeRouteCode,
  resolveNavigationItemForPath,
} from './adminRouteRecovery'

const destinationLimit = 6

function routeFallbackLabel(pathname: string) {
  const segment = pathname.split('/').filter(Boolean).at(-1)

  return segment ? humanizeRouteCode(segment) : 'Unknown route'
}

export function NotFoundPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { accessToken } = useAuthSession()
  const can = useAuthStore((state) => state.can)
  const matchedItem = resolveNavigationItemForPath(location.pathname)
  const preferredItem = accessToken ? getPreferredRecoveryItem(can) : undefined
  const accessibleItems = accessToken
    ? getAccessibleNavigationItems(can).slice(0, destinationLimit)
    : []
  const routeLabel = matchedItem?.label ?? routeFallbackLabel(location.pathname)

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center">
        <section className="rounded-surface border border-border bg-surface p-6 shadow-[var(--shadow-surface)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-warning/10 text-warning">
                  <SearchX className="size-5" />
                </span>
                <Badge tone="warning">Route unavailable</Badge>
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
                Page not found
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                {routeLabel} is not available from this admin route. Open an
                available module or return to the previous page.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Button
                className="gap-2"
                type="button"
                variant="secondary"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>
              {accessToken && preferredItem ? (
                <Button
                  className="gap-2"
                  type="button"
                  onClick={() => navigate(preferredItem.href)}
                >
                  <Home className="size-4" />
                  Open {preferredItem.label}
                </Button>
              ) : (
                <Button type="button" onClick={() => navigate(routePaths.login)}>
                  Sign in
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-surface border border-border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted">
              Requested path
            </p>
            <p className="mt-2 break-all text-sm font-semibold text-foreground">
              {`${location.pathname}${location.search}${location.hash}`}
            </p>
          </div>

          {accessibleItems.length ? (
            <section className="mt-8">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Compass className="size-4 text-muted" />
                Available modules
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {accessibleItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      className="rounded-surface border border-border bg-background p-4 text-left transition hover:border-foreground/20 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      key={item.href}
                      type="button"
                      onClick={() => navigate(item.href)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full bg-surface text-foreground">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.label}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted">
                            {item.permission
                              ? humanizeRouteCode(item.permission)
                              : 'Always available'}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  )
}
