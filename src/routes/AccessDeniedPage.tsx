import { ArrowLeft, KeyRound, Route, ShieldAlert, UserRound } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { useAuthStore } from '../store/authStore'
import {
  getAccessibleNavigationItems,
  getPreferredRecoveryItem,
  humanizeRouteCode,
  resolveNavigationItemForPath,
  resolveNavigationItemForPermission,
} from './adminRouteRecovery'

const recoveryDestinationLimit = 6

interface DetailTileProps {
  label: string
  value: string
}

function fallbackRouteLabel(path: string | null) {
  if (!path) {
    return 'Protected admin module'
  }

  const pathname = path.split('?')[0]?.split('#')[0] ?? path
  const segment = pathname.split('/').filter(Boolean).at(-1)

  return segment ? humanizeRouteCode(segment) : 'Admin route'
}

function DetailTile({ label, value }: DetailTileProps) {
  return (
    <div className="rounded-surface border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  )
}

export function AccessDeniedPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const can = useAuthStore((state) => state.can)
  const session = useAuthStore((state) => state.session)
  const blockedPath = searchParams.get('from')
  const requiredPermission = searchParams.get('permission')
  const requestedItem =
    resolveNavigationItemForPath(blockedPath) ??
    resolveNavigationItemForPermission(requiredPermission)
  const requestedLabel = requestedItem?.label ?? fallbackRouteLabel(blockedPath)
  const preferredItem = getPreferredRecoveryItem(can)
  const accessibleItems = getAccessibleNavigationItems(can)
    .filter((item) => item.href !== requestedItem?.href)
    .slice(0, recoveryDestinationLimit)
  const roleSummary =
    session?.admin.roleCodes.map(humanizeRouteCode).join(', ') ?? 'No role claim'

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center">
        <section className="rounded-surface border border-border bg-surface p-6 shadow-[var(--shadow-surface)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-danger/10 text-danger">
                  <ShieldAlert className="size-5" />
                </span>
                <Badge tone="danger">Permission required</Badge>
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
                Access denied
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                Your current admin role cannot open {requestedLabel}. Use an allowed
                module below or ask a super admin to update the role assignment.
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
              {preferredItem ? (
                <Button
                  type="button"
                  onClick={() => navigate(preferredItem.href)}
                >
                  Open {preferredItem.label}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <DetailTile label="Blocked module" value={requestedLabel} />
            <DetailTile
              label="Required permission"
              value={
                requiredPermission
                  ? humanizeRouteCode(requiredPermission)
                  : requestedItem?.permission
                    ? humanizeRouteCode(requestedItem.permission)
                    : 'Not provided'
              }
            />
            <DetailTile
              label="Current account"
              value={`${session?.admin.fullName ?? 'Admin'} · ${roleSummary}`}
            />
          </div>

          {accessibleItems.length ? (
            <section className="mt-8">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Route className="size-4 text-muted" />
                Allowed destinations
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

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <div className="rounded-surface border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="size-4 text-muted" />
                Role update path
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">
                Super admins can update admin roles from Users or Roles. This page
                does not grant access on its own.
              </p>
            </div>
            <div className="rounded-surface border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <UserRound className="size-4 text-muted" />
                Session state
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">
                If permissions changed recently, sign out and sign in again to load
                the latest role claims.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
