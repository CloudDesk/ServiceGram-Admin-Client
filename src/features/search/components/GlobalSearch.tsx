import { useQuery } from '@tanstack/react-query'
import {
  BadgeCheck,
  Bell,
  ClipboardList,
  CreditCard,
  FileBarChart2,
  FileText,
  Film,
  HandCoins,
  KeyRound,
  LoaderCircle,
  PackageSearch,
  RotateCcw,
  Search,
  Settings,
  Shield,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { routePaths } from '../../../config/routes'
import { cn } from '../../../utils/cn'
import { adminSearchService } from '../services/search.service'
import type {
  AdminSearchModule,
  AdminSearchModuleAccess,
  AdminSearchResult,
  AdminSearchResponse,
} from '../types/search.types'

const moduleIcons: Record<AdminSearchModule, LucideIcon> = {
  customers: Users,
  vendors: Wrench,
  vendorOnboarding: UserRound,
  orders: PackageSearch,
  payments: CreditCard,
  refunds: RotateCcw,
  payouts: HandCoins,
  reels: Film,
  influencers: BadgeCheck,
  notifications: Bell,
  content: FileText,
  reports: FileBarChart2,
  settings: Settings,
  audit: ClipboardList,
  roles: KeyRound,
  adminUsers: Shield,
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs)

    return () => window.clearTimeout(timeout)
  }, [delayMs, value])

  return debouncedValue
}

function formatModuleLabel(module: AdminSearchModule, modules: AdminSearchModuleAccess[]) {
  return modules.find((item) => item.module === module)?.label ?? module
}

function metadataString(result: AdminSearchResult, key: string) {
  const value = result.metadata[key]

  if (value === null || value === undefined || typeof value === 'boolean') {
    return null
  }

  return String(value)
}

function pathWithUrlParams(url: URL) {
  const query = url.searchParams.toString()

  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`
}

function normalizeSearchRoute(result: AdminSearchResult) {
  let url: URL

  try {
    url = new URL(result.route, window.location.origin)
  } catch {
    return result.route
  }

  if (url.pathname === routePaths.audit) {
    const legacyModule = url.searchParams.get('module')
    const legacyAction = url.searchParams.get('action')

    if (legacyModule && !url.searchParams.has('moduleCode')) {
      url.searchParams.set('moduleCode', legacyModule)
    }

    if (legacyAction && !url.searchParams.has('actionCode')) {
      url.searchParams.set('actionCode', legacyAction)
    }

    url.searchParams.delete('module')
    url.searchParams.delete('action')

    const moduleCode = metadataString(result, 'moduleCode')
    const actionCode = metadataString(result, 'actionCode')
    const entityType = metadataString(result, 'entityType')
    const entityId = metadataString(result, 'entityId')

    if (moduleCode && !url.searchParams.has('moduleCode')) {
      url.searchParams.set('moduleCode', moduleCode)
    }

    if (actionCode && !url.searchParams.has('actionCode')) {
      url.searchParams.set('actionCode', actionCode)
    }

    if (entityType && !url.searchParams.has('entityType')) {
      url.searchParams.set('entityType', entityType)
    }

    if (entityId && !url.searchParams.has('entityId')) {
      url.searchParams.set('entityId', entityId)
    }

    url.hash = 'audit-records'

    return pathWithUrlParams(url)
  }

  if (url.pathname === routePaths.notifications) {
    const tab = url.searchParams.get('tab')
    const search = url.searchParams.get('search')

    url.searchParams.delete('tab')

    if (tab === 'templates' || result.type === 'notification_template') {
      if (search && !url.searchParams.has('templateSearch')) {
        url.searchParams.set('templateSearch', search)
      }

      url.searchParams.delete('search')
      url.hash = 'notification-templates'

      return pathWithUrlParams(url)
    }

    if (tab === 'events' || result.type === 'notification_event') {
      url.hash = 'notification-events'

      return pathWithUrlParams(url)
    }
  }

  if (result.type === 'service_type' && url.pathname.startsWith(`${routePaths.settings}/categories/`)) {
    url.hash = 'settings-service-types'

    return pathWithUrlParams(url)
  }

  return pathWithUrlParams(url)
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedModule, setSelectedModule] = useState<AdminSearchModule | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const debouncedQuery = useDebouncedValue(query.trim(), 220)

  const searchQuery = useQuery<AdminSearchResponse>({
    queryKey: ['admin-global-search', debouncedQuery, selectedModule],
    queryFn: () =>
      adminSearchService.search({
        q: debouncedQuery,
        modules: selectedModule ? [selectedModule] : undefined,
        limit: 5,
      }),
    enabled: isOpen,
    staleTime: 15_000,
  })

  const payload = searchQuery.data?.data
  const availableModules = useMemo(
    () => payload?.availableModules ?? [],
    [payload?.availableModules],
  )
  const groups = useMemo(() => payload?.groups ?? [], [payload?.groups])
  const flatResults = useMemo(
    () =>
      groups.flatMap((group) =>
        group.results.map((result) => ({
          groupLabel: group.label,
          result,
        })),
      ),
    [groups],
  )
  const minimumQueryLength = payload?.minimumQueryLength ?? 2
  const hasSearchText = query.trim().length >= minimumQueryLength
  const isLoading = searchQuery.isFetching && hasSearchText
  const effectiveActiveIndex =
    flatResults.length === 0 ? 0 : Math.min(activeIndex, flatResults.length - 1)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)

    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  const close = () => setIsOpen(false)

  const open = () => {
    setIsOpen(true)
  }

  const clear = () => {
    setQuery('')
    setSelectedModule(null)
    inputRef.current?.focus()
  }

  const navigateToResult = (result: AdminSearchResult) => {
    close()
    setQuery('')
    navigate(normalizeSearchRoute(result))
  }

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) =>
        flatResults.length === 0 ? 0 : Math.min(current + 1, flatResults.length - 1),
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter' && flatResults[effectiveActiveIndex]) {
      event.preventDefault()
      navigateToResult(flatResults[effectiveActiveIndex].result)
    }
  }

  let rowIndex = -1

  return (
    <div ref={rootRef} className="relative min-w-0 w-full max-w-[58rem]">
      <button
        className="premium-search-chip flex w-full min-w-0 items-center gap-2 text-left text-adaptive-muted"
        type="button"
        onClick={open}
      >
        <Search className="size-4 shrink-0" />
        <span className="flex min-h-5 min-w-0 flex-1 items-center truncate leading-none">
          Search orders, vendors, customers, payouts...
        </span>
      </button>

      {isOpen ? (
        <div className="premium-common-surface fixed inset-x-3 top-20 z-[70] max-h-[calc(100vh-6rem)] overflow-hidden md:absolute md:inset-x-auto md:left-1/2 md:top-[calc(100%+0.75rem)] md:w-[min(58rem,calc(100vw-8rem))] md:-translate-x-1/2 lg:w-[min(64rem,calc(100vw-24rem))]">
          <div className="border-b border-adaptive p-3">
            <div className="flex items-center gap-2 rounded-[0.75rem] border border-adaptive bg-adaptive-surface px-3">
              <Search className="size-4 shrink-0 text-adaptive-muted" />
              <input
                ref={inputRef}
                className="min-h-11 flex-1 bg-transparent text-sm text-adaptive-main outline-none placeholder:text-adaptive-muted"
                placeholder="Search by ID, name, phone, email, shop, order..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={handleInputKeyDown}
              />
              {isLoading ? (
                <LoaderCircle className="size-4 shrink-0 animate-spin text-adaptive-muted" />
              ) : null}
              {query || selectedModule ? (
                <button
                  aria-label="Clear search"
                  className="rounded-full p-1 text-adaptive-muted transition hover:bg-[color:var(--adaptive-search-bg)] hover:text-adaptive-main"
                  type="button"
                  onClick={clear}
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  selectedModule === null
                    ? 'border-[color:var(--adaptive-primary)] bg-[color:var(--adaptive-primary-soft)] text-[color:var(--adaptive-primary)]'
                    : 'border-adaptive text-adaptive-muted hover:bg-[color:var(--adaptive-search-bg)]',
                )}
                type="button"
                onClick={() => {
                  setSelectedModule(null)
                  setActiveIndex(0)
                  inputRef.current?.focus()
                }}
              >
                All
              </button>
              {availableModules.map((module) => {
                const Icon = moduleIcons[module.module]

                return (
                  <button
                    key={module.module}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      selectedModule === module.module
                        ? 'border-[color:var(--adaptive-primary)] bg-[color:var(--adaptive-primary-soft)] text-[color:var(--adaptive-primary)]'
                        : 'border-adaptive text-adaptive-muted hover:bg-[color:var(--adaptive-search-bg)]',
                    )}
                    type="button"
                    onClick={() => {
                      setSelectedModule(module.module)
                      setActiveIndex(0)
                      inputRef.current?.focus()
                    }}
                  >
                    <Icon className="size-3.5" />
                    {module.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="max-h-[min(34rem,calc(100vh-15rem))] overflow-y-auto p-2">
            {!hasSearchText ? (
              <div className="px-3 py-8 text-center text-sm text-adaptive-muted">
                Available modules are shown above.
              </div>
            ) : searchQuery.isError ? (
              <div className="px-3 py-8 text-center text-sm text-[color:var(--adaptive-danger-text)]">
                Search is unavailable right now.
              </div>
            ) : groups.length === 0 && !isLoading ? (
              <div className="px-3 py-8 text-center text-sm text-adaptive-muted">
                No matching records found.
              </div>
            ) : (
              groups.map((group) => {
                const GroupIcon = moduleIcons[group.module]

                return (
                  <div key={group.module} className="py-2">
                    <div className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase tracking-normal text-adaptive-muted">
                      <GroupIcon className="size-3.5" />
                      <span>{group.label}</span>
                    </div>
                    <div className="space-y-1">
                      {group.results.map((result) => {
                        rowIndex += 1
                        const currentRowIndex = rowIndex
                        const Icon = moduleIcons[result.module]
                        const isActive = currentRowIndex === effectiveActiveIndex

                        return (
                          <button
                            key={`${result.module}-${result.id}-${result.type}`}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-[0.75rem] px-3 py-2.5 text-left transition',
                              isActive
                                ? 'bg-[color:var(--adaptive-search-bg)]'
                                : 'hover:bg-[color:var(--adaptive-search-bg)]',
                            )}
                            type="button"
                            onClick={() => navigateToResult(result)}
                            onMouseEnter={() => setActiveIndex(currentRowIndex)}
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] border border-adaptive bg-adaptive-surface text-[color:var(--adaptive-primary)]">
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-adaptive-main">
                                {result.title}
                              </span>
                              <span className="block truncate text-xs text-adaptive-muted">
                                {result.subtitle || formatModuleLabel(result.module, availableModules)}
                              </span>
                            </span>
                            {result.status ? (
                              <Badge tone={result.statusTone}>{result.status}</Badge>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
