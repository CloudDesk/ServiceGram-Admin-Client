import {
  ArrowUpRight,
  Ban,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  MessageSquarePlus,
  RefreshCcw,
  SlidersHorizontal,
  UserCheck,
} from 'lucide-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { ListHeaderSearch } from '../../../components/ui/ListHeaderSearch'
import {
  LIST_SELECTION_COLUMN_WIDTH,
  ListSelectionCheckbox,
  ListSelectionToolbar,
} from '../../../components/ui/ListSelection'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { featureFlags } from '../../../config/featureFlags'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { customerService } from '../services/customer.service'
import {
  CustomerActionModal,
  type CustomerActionFormValues,
  type CustomerActionKind,
  type CustomerActionSelection,
} from './CustomerActionModal'
import type {
  AdminCustomerListItem,
  AdminCustomersPagination,
  AdminCustomersQueryParams,
  AdminCustomersSummary,
  AdminCustomerStatus,
} from '../types/customer.types'

const DEFAULT_PAGE_SIZE = 10
const CUSTOMER_DEFAULT_COLUMN_WIDTH = 220
const CUSTOMER_GRID_COLUMN_GAP = 12
const CUSTOMER_GRID_INLINE_PADDING = 24
const customerDataColumns = [
  {
    id: 'customer',
    label: 'Customer',
    defaultWidth: CUSTOMER_DEFAULT_COLUMN_WIDTH,
    minWidth: 180,
  },
  {
    id: 'location',
    label: 'Location',
    defaultWidth: CUSTOMER_DEFAULT_COLUMN_WIDTH,
    minWidth: 150,
  },
  {
    id: 'health',
    label: 'Health',
    defaultWidth: CUSTOMER_DEFAULT_COLUMN_WIDTH,
    minWidth: 145,
  },
  {
    id: 'orders',
    label: 'Orders',
    defaultWidth: CUSTOMER_DEFAULT_COLUMN_WIDTH,
    minWidth: 130,
  },
  ...(featureFlags.customerWallet
    ? ([
        {
          id: 'wallet',
          label: 'Wallet',
          defaultWidth: CUSTOMER_DEFAULT_COLUMN_WIDTH,
          minWidth: 130,
        },
      ] as const)
    : []),
  {
    id: 'lastLogin',
    label: 'Last login',
    defaultWidth: CUSTOMER_DEFAULT_COLUMN_WIDTH,
    minWidth: 155,
  },
  {
    id: 'updatedAt',
    label: 'Updated',
    defaultWidth: CUSTOMER_DEFAULT_COLUMN_WIDTH,
    minWidth: 155,
  },
] as const
const CUSTOMER_ACTION_COLUMN_ID = 'actions'
const CUSTOMER_ACTION_COLUMN_DEFAULT_WIDTH = 176
const CUSTOMER_ACTION_COLUMN_MIN_WIDTH = 156
const CUSTOMER_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.customer.columnWidths.v3'

type CustomerTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type CustomerColumnId = (typeof customerDataColumns)[number]['id']
type CustomerColumnWidthId = CustomerColumnId | typeof CUSTOMER_ACTION_COLUMN_ID
type CustomerColumnWidths = Partial<Record<CustomerColumnWidthId, number>>
const defaultCustomerColumns: CustomerColumnId[] = ['customer', 'location']
type QueueKey =
  | 'all'
  | 'active'
  | 'blocked'
  | 'incomplete'
  | 'activeOrders'

interface ActionTarget {
  action: CustomerActionSelection
  customer: AdminCustomerListItem
}

interface CustomerGridStyle extends CSSProperties {
  '--customer-grid-template': string
  '--customer-grid-min-width': string
}

function getDefaultCustomerColumnWidths() {
  const widths: CustomerColumnWidths = {
    [CUSTOMER_ACTION_COLUMN_ID]: CUSTOMER_ACTION_COLUMN_DEFAULT_WIDTH,
  }

  customerDataColumns.forEach((column) => {
    widths[column.id] = column.defaultWidth
  })

  return widths
}

const defaultCustomerColumnWidths = getDefaultCustomerColumnWidths()

function getCustomerColumnMinWidth(columnId: CustomerColumnWidthId) {
  if (columnId === CUSTOMER_ACTION_COLUMN_ID) {
    return CUSTOMER_ACTION_COLUMN_MIN_WIDTH
  }

  return (
    customerDataColumns.find((column) => column.id === columnId)?.minWidth ?? 120
  )
}

function getCustomerColumnDefaultWidth(columnId: CustomerColumnWidthId) {
  return (
    defaultCustomerColumnWidths[columnId] ?? getCustomerColumnMinWidth(columnId)
  )
}

function getCustomerColumnWidth(
  columnWidths: CustomerColumnWidths,
  columnId: CustomerColumnWidthId,
) {
  return Math.max(
    getCustomerColumnMinWidth(columnId),
    columnWidths[columnId] ?? getCustomerColumnDefaultWidth(columnId),
  )
}

function normalizeCustomerColumnWidths(value: unknown) {
  const widths = { ...defaultCustomerColumnWidths }

  if (!value || typeof value !== 'object') {
    return widths
  }

  const record = value as Record<string, unknown>

  customerDataColumns.forEach((column) => {
    const width = record[column.id]

    if (typeof width === 'number' && Number.isFinite(width)) {
      widths[column.id] = Math.max(column.minWidth, Math.round(width))
    }
  })

  const actionWidth = record[CUSTOMER_ACTION_COLUMN_ID]

  if (typeof actionWidth === 'number' && Number.isFinite(actionWidth)) {
    widths[CUSTOMER_ACTION_COLUMN_ID] = Math.max(
      CUSTOMER_ACTION_COLUMN_MIN_WIDTH,
      Math.round(actionWidth),
    )
  }

  return widths
}

function loadCustomerColumnWidths() {
  if (typeof window === 'undefined') {
    return defaultCustomerColumnWidths
  }

  try {
    return normalizeCustomerColumnWidths(
      JSON.parse(
        window.localStorage.getItem(CUSTOMER_COLUMN_WIDTH_STORAGE_KEY) ?? 'null',
      ),
    )
  } catch {
    return defaultCustomerColumnWidths
  }
}

function toneClasses(tone: CustomerTone) {
  if (tone === 'success') return 'border-border bg-surface text-success'
  if (tone === 'warning') return 'border-border bg-surface text-warning'
  if (tone === 'danger') return 'border-border bg-surface text-danger'
  if (tone === 'info') return 'border-border bg-surface text-primary'
  return 'border-border bg-surface text-muted'
}

function statusTone(status: AdminCustomerStatus) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'BLOCKED') return 'danger'
  return 'warning'
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Review customer'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function customerNeedsAttention(customer: AdminCustomerListItem) {
  return (
    customer.status !== 'ACTIVE' ||
    visibleWarnings(customer.warnings).length > 0 ||
    Boolean(visibleRecommendedAction(customer))
  )
}

function customerHealth(customer: AdminCustomerListItem) {
  let score = 100

  if (customer.status === 'BLOCKED') score -= 55
  if (customer.status === 'INCOMPLETE') score -= 25
  if (!customer.zone) score -= 12
  if (customer.orderSummary.activeOrders > 0) score -= 8
  if (featureFlags.customerWallet && customer.walletSummary.creditBalancePaise > 0) score -= 5
  score -= Math.min(visibleWarnings(customer.warnings).length * 10, 30)

  return Math.max(18, Math.min(98, score))
}

function healthColor(score: number) {
  if (score >= 80) return 'bg-success'
  if (score >= 55) return 'bg-warning'
  return 'bg-danger'
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'
  return formatDate(value, true)
}

function formatRefreshTime(value: number) {
  if (!value) return 'Not refreshed yet'

  return `Last refreshed ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))}`
}

function formatPaise(value: number) {
  return formatMoney(value / 100)
}

function isWalletAction(action: string | null | undefined) {
  return action?.toUpperCase() === 'WALLET_CREDIT'
}

function visibleWarnings(warnings: string[]) {
  return featureFlags.customerWallet
    ? warnings
    : warnings.filter((warning) => warning !== 'HAS_WALLET_CREDIT')
}

function visibleRecommendedAction(customer: AdminCustomerListItem) {
  if (!featureFlags.customerWallet && isWalletAction(customer.nextRecommendedAction)) {
    return null
  }

  return customer.nextRecommendedAction
}

function primaryActionLabel(customer: AdminCustomerListItem) {
  const nextRecommendedAction = visibleRecommendedAction(customer)

  if (nextRecommendedAction) {
    return humanizeCode(nextRecommendedAction)
  }

  if (customer.status === 'BLOCKED') return 'Review block'
  if (visibleWarnings(customer.warnings).length > 0) return 'Review customer'

  return 'View details'
}

function mapRecommendedAction(
  customer: AdminCustomerListItem,
): CustomerActionKind | null {
  const action = customer.nextRecommendedAction?.toUpperCase()

  if (!featureFlags.customerWallet && action === 'WALLET_CREDIT') {
    return null
  }

  if (
    action === 'BLOCK' ||
    action === 'UNBLOCK' ||
    action === 'WALLET_CREDIT' ||
    action === 'ADD_NOTE'
  ) {
    if (action === 'ADD_NOTE' || customer.availableActions.includes(action)) {
      return action as CustomerActionKind
    }
  }

  return null
}

function getCustomerGridTemplate(
  visibleColumns: CustomerColumnId[],
  columnWidths: CustomerColumnWidths,
) {
  const selectedWidths = customerDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => `${getCustomerColumnWidth(columnWidths, column.id)}px`)

  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...selectedWidths,
    `${getCustomerColumnWidth(columnWidths, CUSTOMER_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getCustomerGridMinWidth(
  visibleColumns: CustomerColumnId[],
  columnWidths: CustomerColumnWidths,
) {
  const visibleColumnCount = visibleColumns.length
  const gridColumnCount = visibleColumnCount + 2
  const gridGapWidth = Math.max(gridColumnCount - 1, 0) * CUSTOMER_GRID_COLUMN_GAP
  const visibleWidth = customerDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .reduce(
      (total, column) => total + getCustomerColumnWidth(columnWidths, column.id),
      0,
    )

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    getCustomerColumnWidth(columnWidths, CUSTOMER_ACTION_COLUMN_ID) +
    gridGapWidth +
    CUSTOMER_GRID_INLINE_PADDING
  }px`
}

function MetricCard({
  label,
  meta,
  tone,
  value,
}: {
  label: string
  meta: string
  tone: CustomerTone
  value: string
}) {
  return (
    <button
      className={cn(
        'min-h-[4.35rem] rounded-[0.75rem] border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-surface',
        toneClasses(tone),
      )}
      type="button"
    >
      <span className="text-xs font-semibold uppercase tracking-normal opacity-80">
        {label}
      </span>
      <span className="mt-1 block text-lg font-semibold tracking-normal">
        {value}
      </span>
      <span className="mt-0.5 block text-xs leading-4 opacity-80">{meta}</span>
    </button>
  )
}

function CustomerRow({
  customer,
  isSelected,
  isSubmitting,
  onOpenAction,
  onSelect,
  onViewDetails,
  visibleColumns,
}: {
  customer: AdminCustomerListItem
  isSelected: boolean
  isSubmitting: boolean
  onOpenAction: (customer: AdminCustomerListItem, kind: CustomerActionKind) => void
  onSelect: (customer: AdminCustomerListItem, selected: boolean) => void
  onViewDetails: (customer: AdminCustomerListItem) => void
  visibleColumns: CustomerColumnId[]
}) {
  const health = customerHealth(customer)
  const recommendedAction = mapRecommendedAction(customer)
  const warningCount = visibleWarnings(customer.warnings).length
  const canBlock = customer.availableActions.includes('BLOCK')
  const canUnblock = customer.availableActions.includes('UNBLOCK')
  const showAddNoteAction = recommendedAction !== 'ADD_NOTE'
  const showBlockAction = canBlock && recommendedAction !== 'BLOCK'
  const showUnblockAction = canUnblock && recommendedAction !== 'UNBLOCK'
  const showColumn = (columnId: CustomerColumnId) => visibleColumns.includes(columnId)

  const handlePrimaryAction = () => {
    if (!recommendedAction) return

    onOpenAction(customer, recommendedAction)
  }

  return (
    <article
      aria-selected={isSelected}
      className={cn(
        'grid min-w-0 cursor-pointer gap-3 border-b border-border bg-surface px-3 py-2.5 transition last:border-b-0 hover:bg-surface-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset xl:grid-cols-[var(--customer-grid-template)] xl:items-center',
        isSelected && 'bg-primary/5 hover:bg-primary/10',
      )}
      aria-label={`Open details for ${customer.fullName}`}
      role="button"
      tabIndex={0}
      onClick={() => onViewDetails(customer)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onViewDetails(customer)
        }
      }}
    >
      <div className="flex min-w-0 items-start xl:items-center">
        <ListSelectionCheckbox
          checked={isSelected}
          label={`Select ${customer.fullName}`}
          onChange={(selected) => onSelect(customer, selected)}
        />
      </div>
      {showColumn('customer') ? (
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full border bg-surface text-sm font-semibold',
              customer.status === 'BLOCKED'
                ? 'border-danger/25 text-danger'
                : customerNeedsAttention(customer)
                  ? 'border-warning/25 text-warning'
                  : 'border-success/25 text-success',
            )}
          >
            {customer.fullName
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {customer.fullName}
              </p>
              <Badge tone={statusTone(customer.status)}>{customer.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              {customer.mobileNumber ?? 'No mobile'}
            </p>
            <p className="truncate text-xs text-muted">
              {customer.email ?? 'No email'}
            </p>
          </div>
        </div>
      ) : null}

      {showColumn('location') ? (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <MapPin className="size-4 text-muted" />
            <span>{customer.city || customer.zone?.city || 'No city'}</span>
          </div>
          <p className="pl-6 text-xs text-muted">
            {customer.zone?.zoneName ?? 'No zone'}
          </p>
        </div>
      ) : null}

      {showColumn('health') ? (
        <div className="w-full min-w-0 space-y-2 xl:max-w-72">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted">Health</span>
            <span className="font-semibold text-foreground">{health}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-muted">
            <div
              className={cn('h-2 rounded-full', healthColor(health))}
              style={{ width: `${health}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>{customer.orderSummary.activeOrders} active</span>
            <span>{warningCount} warnings</span>
          </div>
        </div>
      ) : null}

      {showColumn('orders') ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted">Orders</p>
          <p className="font-semibold text-foreground">
            {customer.orderSummary.totalOrders}
          </p>
          <p className="text-xs text-muted">
            {customer.orderSummary.activeOrders} active
          </p>
        </div>
      ) : null}

      {featureFlags.customerWallet && showColumn('wallet') ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted">Wallet</p>
          <p className="font-semibold text-foreground">
            {formatPaise(customer.walletSummary.creditBalancePaise)}
          </p>
          <p className="text-xs text-muted">
            {customer.walletSummary.providerStatus}
          </p>
        </div>
      ) : null}

      {showColumn('lastLogin') ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted">Last login</p>
          <p className="text-foreground">{formatDateSafe(customer.lastLoginAt)}</p>
        </div>
      ) : null}

      {showColumn('updatedAt') ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted">Updated</p>
          <p className="text-foreground">{formatDateSafe(customer.updatedAt)}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        {recommendedAction ? (
          <Button
            disabled={isSubmitting}
            size="sm"
            type="button"
            variant={
              recommendedAction === 'BLOCK'
                ? 'danger'
                : recommendedAction === 'ADD_NOTE'
                  ? 'secondary'
                  : 'primary'
            }
            onClick={(event) => {
              event.stopPropagation()
              handlePrimaryAction()
            }}
          >
            {recommendedAction === 'ADD_NOTE' ? (
              <MessageSquarePlus className="mr-2 size-4" />
            ) : (
              <ArrowUpRight className="mr-2 size-4" />
            )}
            {primaryActionLabel(customer)}
          </Button>
        ) : null}
        {showAddNoteAction ? (
          <button
            aria-label={`Add note for ${customer.fullName}`}
            className="btn-icon disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Add note"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(customer, 'ADD_NOTE')
            }}
          >
            <MessageSquarePlus className="size-4" />
          </button>
        ) : null}
        {showBlockAction ? (
          <button
            aria-label={`Block ${customer.fullName}`}
            className="btn-icon text-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Block customer"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(customer, 'BLOCK')
            }}
          >
            <Ban className="size-4" />
          </button>
        ) : null}
        {showUnblockAction ? (
          <button
            aria-label={`Unblock ${customer.fullName}`}
            className="btn-icon text-success hover:text-success disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Unblock customer"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(customer, 'UNBLOCK')
            }}
          >
            <UserCheck className="size-4" />
          </button>
        ) : null}
      </div>
    </article>
  )
}

function CustomerPagination({
  onPageChange,
  onPageSizeChange,
  pagination,
}: {
  onPageChange: (page: number) => void
  onPageSizeChange: (limit: number) => void
  pagination?: AdminCustomersPagination
}) {
  if (!pagination) {
    return null
  }

  const start =
    pagination.totalItems === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.totalItems)

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface-muted px-3 py-2.5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing {start}-{end} of {pagination.totalItems}
        </span>
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select
            aria-label="Rows per page"
            className="h-9 rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
            value={pagination.limit}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[10, 20, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3 sm:justify-end">
        <button
          aria-label="Previous page"
          className="btn-icon"
          disabled={!pagination.hasPreviousPage}
          type="button"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium text-foreground">
          Page {pagination.page} of {Math.max(1, pagination.totalPages)}
        </span>
        <button
          aria-label="Next page"
          className="btn-icon"
          disabled={!pagination.hasNextPage}
          type="button"
          onClick={() =>
            onPageChange(Math.min(pagination.totalPages, pagination.page + 1))
          }
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

function CustomerRowsSkeleton() {
  return (
    <div className="space-y-2.5 p-3">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton className="h-24 w-full rounded-[1rem]" key={index} />
      ))}
    </div>
  )
}

export function CustomersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [status, setStatus] = useState<'' | AdminCustomerStatus>('')
  const [city, setCity] = useState('')
  const [hasOrders, setHasOrders] = useState('')
  const [hasWalletCredit, setHasWalletCredit] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<CustomerColumnId[]>(
    defaultCustomerColumns,
  )
  const [columnWidths, setColumnWidths] = useState<CustomerColumnWidths>(
    loadCustomerColumnWidths,
  )
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CUSTOMER_COLUMN_WIDTH_STORAGE_KEY,
        JSON.stringify(columnWidths),
      )
    } catch {
      // Width persistence is a convenience; the table still works without it.
    }
  }, [columnWidths])

  useEffect(() => {
    if (!columnsOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && columnsMenuRef.current?.contains(target)) {
        return
      }

      setColumnsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setColumnsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [columnsOpen])

  const startColumnResize = (
    columnId: CustomerColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getCustomerColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          getCustomerColumnMinWidth(columnId),
          Math.round(nextWidth),
        ),
      }))
    }

    const stopResize = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', stopResize)
      document.removeEventListener('pointercancel', stopResize)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', stopResize)
    document.addEventListener('pointercancel', stopResize)
  }

  const resetColumnWidth = (columnId: CustomerColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: getCustomerColumnDefaultWidth(columnId),
    }))
  }

  const adjustColumnWidth = (columnId: CustomerColumnWidthId, delta: number) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: Math.max(
        getCustomerColumnMinWidth(columnId),
        getCustomerColumnWidth(currentWidths, columnId) + delta,
      ),
    }))
  }

  const resetToFirstPage = () => setPage(1)

  const query = useMemo<AdminCustomersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: status || undefined,
      city: city.trim() || undefined,
      hasOrders: hasOrders === '' ? undefined : hasOrders === 'true',
      hasWalletCredit:
        featureFlags.customerWallet && hasWalletCredit !== ''
          ? hasWalletCredit === 'true'
          : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [
      city,
      dateFrom,
      dateTo,
      hasOrders,
      hasWalletCredit,
      limit,
      page,
      search,
      status,
    ],
  )

  const customersQuery = useQuery({
    queryKey: ['customers', query],
    queryFn: () => customerService.getCustomerList(query),
  })
  const queueCountBaseQuery = useMemo<AdminCustomersQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [city, dateFrom, dateTo, search],
  )
  const queueCountsQuery = useQuery({
    queryKey: ['customers', 'queue-counts', queueCountBaseQuery],
    queryFn: async (): Promise<CustomerQueueCounts> => {
      const [summaryResponse, incompleteResponse] = await Promise.all([
        customerService.getCustomerList(queueCountBaseQuery),
        customerService.getCustomerList({
          ...queueCountBaseQuery,
          status: 'INCOMPLETE',
        }),
      ])

      return {
        all: summaryResponse.pagination.totalItems,
        active: summaryResponse.summary.active,
        blocked: summaryResponse.summary.blocked,
        incomplete: incompleteResponse.pagination.totalItems,
        activeOrders: summaryResponse.summary.withActiveOrders,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const customers = customersQuery.data?.data ?? []
  const pagination = customersQuery.data?.pagination
  const summary = customersQuery.data?.summary
  const customerSelection = useListSelection(
    customers,
    (customer) => customer.customerId,
  )
  const isInitialLoading = customersQuery.isLoading && !customersQuery.data
  const isRefreshing = customersQuery.isFetching && Boolean(customersQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing now'
    : formatRefreshTime(customersQuery.dataUpdatedAt)

  const visibleAttentionCount = customers.filter(customerNeedsAttention).length
  const visibleWarningCount = customers.reduce(
    (total, customer) => total + visibleWarnings(customer.warnings).length,
    0,
  )
  const metrics = buildMetrics({
    customers,
    summary,
    visibleAttentionCount,
    visibleWarningCount,
  })

  const queueItems = buildQueueItems({
    counts: queueCountsQuery.data,
  })

  const customerGridStyle = useMemo<CustomerGridStyle>(
    () => ({
      '--customer-grid-template': getCustomerGridTemplate(
        visibleColumns,
        columnWidths,
      ),
      '--customer-grid-min-width': getCustomerGridMinWidth(
        visibleColumns,
        columnWidths,
      ),
    }),
    [columnWidths, visibleColumns],
  )
  const hasWalletFilter = featureFlags.customerWallet && Boolean(hasWalletCredit)

  const hasActiveFilters = Boolean(
    search ||
      status ||
      city ||
      hasOrders ||
      hasWalletFilter ||
      dateFrom ||
      dateTo,
  )

  const clearSeededCustomerParams = () => {
    if (!searchParams.has('search')) return

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('search')
    setSearchParams(nextParams, { replace: true })
  }

  const resetFilters = () => {
    clearSeededCustomerParams()
    setSearch('')
    setStatus('')
    setCity('')
    setHasOrders('')
    setHasWalletCredit('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const toggleColumn = (columnId: CustomerColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return currentColumns

        return currentColumns.filter((currentColumn) => currentColumn !== columnId)
      }

      return [...currentColumns, columnId]
    })
  }

  const applyQueue = (queue: QueueKey) => {
    if (queue === 'all') {
      setStatus('')
      setHasOrders('')
      setHasWalletCredit('')
    }

    if (queue === 'active') {
      setStatus('ACTIVE')
      setHasOrders('')
      setHasWalletCredit('')
    }

    if (queue === 'blocked') {
      setStatus('BLOCKED')
      setHasOrders('')
      setHasWalletCredit('')
    }

    if (queue === 'incomplete') {
      setStatus('INCOMPLETE')
      setHasOrders('')
      setHasWalletCredit('')
    }

    if (queue === 'activeOrders') {
      setStatus('')
      setHasOrders('true')
      setHasWalletCredit('')
    }

    setPage(1)
  }

  const isQueueActive = (queue: QueueKey) => {
    if (queue === 'all') return !status && !hasOrders && !hasWalletFilter
    if (queue === 'active') return status === 'ACTIVE' && !hasOrders && !hasWalletFilter
    if (queue === 'blocked') return status === 'BLOCKED' && !hasOrders && !hasWalletFilter
    if (queue === 'incomplete') return status === 'INCOMPLETE' && !hasOrders && !hasWalletFilter
    return hasOrders === 'true' && !status && !hasWalletFilter
  }

  const openAction = (customer: AdminCustomerListItem, kind: CustomerActionKind) => {
    setActionError(null)
    setActionTarget({ action: { kind }, customer })
  }

  const viewDetails = (customer: AdminCustomerListItem) => {
    navigate(`${routePaths.customers}/${customer.customerId}`)
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      target,
      values,
    }: {
      target: ActionTarget
      values: CustomerActionFormValues
    }) => {
      const { customer, action } = target

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) throw new Error('Internal note is required.')

        return customerService.addCustomerNote(customer.customerId, {
          note: values.note,
        })
      }

      if (action.kind === 'BLOCK') {
        if (!values.reason) throw new Error('Block reason is required.')

        return customerService.blockCustomer(customer.customerId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'UNBLOCK') {
        if (!values.reason) throw new Error('Unblock reason is required.')

        return customerService.unblockCustomer(customer.customerId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'WALLET_CREDIT') {
        if (!featureFlags.customerWallet) {
          throw new Error('Wallet credit is currently disabled.')
        }

        if (!values.reason) throw new Error('Wallet credit reason is required.')
        if (!values.amountPaise) throw new Error('Wallet credit amount is required.')

        return customerService.creditCustomerWallet(customer.customerId, {
          amountPaise: values.amountPaise,
          currency: values.currency,
          reason: values.reason,
          referenceId: values.referenceId,
        })
      }

      throw new Error('Unsupported customer action.')
    },
    onMutate: () => setActionError(null),
    onSuccess: (_data, variables) => {
      setActionTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      void queryClient.invalidateQueries({
        queryKey: ['customer-detail', variables.target.customer.customerId],
      })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Customer action failed.',
      )
    },
  })

  const submitAction = (values: CustomerActionFormValues) => {
    if (!actionTarget) return

    void actionMutation.mutateAsync({
      target: actionTarget,
      values,
    })
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        description="Search, filter, and manage customer accounts from backend data."
        layout="workspace"
        placement="topbar"
        title="Customers"
      />

      <div className="flex flex-col gap-3 xl:min-h-0 xl:flex-1">
        <section className="grid shrink-0 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              meta={metric.meta}
              tone={metric.tone}
              value={metric.value}
            />
          ))}
        </section>

        <section
          className={cn(
            'grid gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-stretch xl:overflow-hidden',
            filtersCollapsed &&
              'xl:grid-cols-[4.25rem_minmax(0,1fr)]',
          )}
        >
          <aside
            className={cn(
              'self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0 2xl:col-start-1 2xl:row-start-1',
              filtersCollapsed
                ? 'flex items-center justify-between gap-3 p-2.5 xl:flex-col xl:justify-start'
                : 'space-y-3 p-3 xl:overflow-y-auto',
            )}
          >
            {filtersCollapsed ? (
              <>
                <button
                  aria-label="Expand customer filters"
                  className="btn-icon"
                  title="Expand filters"
                  type="button"
                  onClick={() => setFiltersCollapsed(false)}
                >
                  <ChevronRight className="size-4" />
                </button>
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 items-center justify-center rounded-[0.65rem] bg-surface-muted/70 text-muted"
                >
                  <Filter className="size-4" />
                </span>
                {hasActiveFilters ? (
                  <span
                    aria-label="Active filters"
                    className="size-2 rounded-full bg-primary"
                    title="Active filters"
                  />
                ) : null}
              </>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Smart queues
                    </h2>
                    <button
                      aria-label="Collapse customer filters"
                      className="btn-icon"
                      title="Collapse filters"
                      type="button"
                      onClick={() => setFiltersCollapsed(true)}
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {queueItems.map((queue) => (
                      <button
                        className={cn(
                          'flex min-h-10 w-full items-center justify-between rounded-[0.75rem] border px-3 text-left text-sm transition',
                          isQueueActive(queue.key)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-surface-muted/50 text-foreground hover:border-primary/35',
                        )}
                        key={queue.key}
                        type="button"
                        onClick={() => applyQueue(queue.key)}
                      >
                        <span className="font-medium">{queue.label}</span>
                        <span className="text-xs font-semibold">
                          {queue.count ?? '...'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Filter stack
                    </h3>
                    {hasActiveFilters ? (
                      <button
                        className="text-xs font-semibold text-primary"
                        type="button"
                        onClick={resetFilters}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-3">
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        Status
                      </span>
                      <select
                        className="form-input"
                        value={status}
                        onChange={(event) => {
                          setStatus(event.target.value as '' | AdminCustomerStatus)
                          resetToFirstPage()
                        }}
                      >
                        <option value="">All</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="BLOCKED">BLOCKED</option>
                        <option value="INCOMPLETE">INCOMPLETE</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        City
                      </span>
                      <Input
                        className="min-h-10"
                        placeholder="Bengaluru"
                        value={city}
                        onChange={(event) => {
                          setCity(event.target.value)
                          resetToFirstPage()
                        }}
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">
                          Has orders
                        </span>
                        <select
                          className="form-input"
                          value={hasOrders}
                          onChange={(event) => {
                            setHasOrders(event.target.value)
                            resetToFirstPage()
                          }}
                        >
                          <option value="">All</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </label>
                      {/*
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">Wallet credit</span>
                        <select
                          className="form-input"
                          value={hasWalletCredit}
                          onChange={(event) => {
                            setHasWalletCredit(event.target.value)
                            resetToFirstPage()
                          }}
                        >
                          <option value="">All</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </label>
                      */}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">
                          Created from
                        </span>
                        <Input
                          className="min-h-10"
                          type="date"
                          value={dateFrom}
                          onChange={(event) => {
                            setDateFrom(event.target.value)
                            resetToFirstPage()
                          }}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">
                          Created to
                        </span>
                        <Input
                          className="min-h-10"
                          type="date"
                          value={dateTo}
                          onChange={(event) => {
                            setDateTo(event.target.value)
                            resetToFirstPage()
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}
          </aside>

          <main className="flex min-w-0 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0 2xl:col-start-2 2xl:row-start-1">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Customer operations
                </h2>
                <p className="text-sm text-muted">
                  {summary
                    ? `${summary.visible} visible · ${summary.active} active · ${summary.blocked} blocked · ${summary.withActiveOrders} with active orders`
                    : 'Search, filter, and manage customer accounts from backend data.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  className="w-full sm:w-72 lg:w-80"
                  placeholder="Search name, mobile, email"
                  value={search}
                  onChange={(nextSearch) => {
                    clearSeededCustomerParams()
                    setSearch(nextSearch)
                    resetToFirstPage()
                  }}
                />
                <span
                  className={cn(
                    'text-xs font-medium',
                    isRefreshing ? 'text-primary' : 'text-muted',
                  )}
                >
                  {refreshStatusLabel}
                </span>
                <div className="relative" ref={columnsMenuRef}>
                  <Button
                    aria-expanded={columnsOpen}
                    aria-haspopup="menu"
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => setColumnsOpen((current) => !current)}
                  >
                    <SlidersHorizontal className="mr-2 size-4" />
                    Columns
                    {visibleColumns.length ? (
                      <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                        {visibleColumns.length}
                      </span>
                    ) : null}
                  </Button>

                  {columnsOpen ? (
                    <div
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-60 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
                      role="menu"
                    >
                      <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-normal text-muted">
                        Visible columns
                      </p>
                      {customerDataColumns.map((column) => {
                        const isChecked = visibleColumns.includes(column.id)
                        const isRequiredLastColumn =
                          isChecked && visibleColumns.length === 1

                        return (
                          <label
                            className={cn(
                              'flex min-h-9 cursor-pointer items-center gap-2 rounded-[0.65rem] px-2 text-sm text-foreground hover:bg-surface-muted',
                              isRequiredLastColumn && 'cursor-not-allowed opacity-60',
                            )}
                            key={column.id}
                          >
                            <input
                              checked={isChecked}
                              className="size-4 accent-[color:var(--adaptive-primary)]"
                              disabled={isRequiredLastColumn}
                              type="checkbox"
                              onChange={() => toggleColumn(column.id)}
                            />
                            <span>{column.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => void customersQuery.refetch()}
                >
                  <RefreshCcw
                    className={cn(
                      'mr-2 size-4',
                      isRefreshing && 'animate-spin motion-reduce:animate-none',
                    )}
                  />
                  Refresh
                </Button>
              </div>
            </div>

            {customersQuery.isError ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ErrorState
                  description="We could not load customer data. Please retry."
                  title="Customer data unavailable"
                  onRetry={() => void customersQuery.refetch()}
                />
              </div>
            ) : isInitialLoading ? (
              <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <CustomerRowsSkeleton />
              </div>
            ) : customers.length === 0 ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <EmptyState
                  description="No customers matched the selected filters."
                  title="No customers"
                />
              </div>
            ) : (
              <div className="flex flex-col xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--customer-grid-min-width)]"
                    style={customerGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden gap-3 grid-cols-[var(--customer-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
                      <div className="flex min-w-0 items-center">
                        <ListSelectionCheckbox
                          checked={customerSelection.allVisibleSelected}
                          indeterminate={customerSelection.someVisibleSelected}
                          label="Select visible customers"
                          onChange={customerSelection.setVisibleSelected}
                        />
                      </div>
                      {customerDataColumns
                        .filter((column) => visibleColumns.includes(column.id))
                        .map((column) => (
                          <div
                            className="relative flex min-w-0 items-center pr-3"
                            key={column.id}
                          >
                            <span className="truncate">{column.label}</span>
                            <button
                              aria-label={`Resize ${column.label} column`}
                              className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title="Drag to resize"
                              type="button"
                              onDoubleClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                resetColumnWidth(column.id)
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'ArrowLeft') {
                                  event.preventDefault()
                                  adjustColumnWidth(column.id, -16)
                                }

                                if (event.key === 'ArrowRight') {
                                  event.preventDefault()
                                  adjustColumnWidth(column.id, 16)
                                }
                              }}
                              onPointerDown={(event) =>
                                startColumnResize(column.id, event)
                              }
                            >
                              <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                            </button>
                          </div>
                        ))}
                      <div className="relative flex min-w-0 items-center justify-end pr-3 text-right">
                        <span className="truncate">Actions</span>
                        <button
                          aria-label="Resize actions column"
                          className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title="Drag to resize"
                          type="button"
                          onDoubleClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            resetColumnWidth(CUSTOMER_ACTION_COLUMN_ID)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'ArrowLeft') {
                              event.preventDefault()
                              adjustColumnWidth(CUSTOMER_ACTION_COLUMN_ID, -16)
                            }

                            if (event.key === 'ArrowRight') {
                              event.preventDefault()
                              adjustColumnWidth(CUSTOMER_ACTION_COLUMN_ID, 16)
                            }
                          }}
                          onPointerDown={(event) =>
                            startColumnResize(CUSTOMER_ACTION_COLUMN_ID, event)
                          }
                        >
                          <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                        </button>
                      </div>
                    </div>
                    <ListSelectionToolbar
                      allVisibleSelected={customerSelection.allVisibleSelected}
                      selectedCount={customerSelection.selectedCount}
                      visibleCount={customerSelection.visibleCount}
                      onClear={customerSelection.clearSelection}
                      onSelectVisible={() => customerSelection.setVisibleSelected(true)}
                    />

                    <div>
                      {customers.map((customer) => (
                        <CustomerRow
                          customer={customer}
                          isSelected={customerSelection.isSelected(customer.customerId)}
                          isSubmitting={actionMutation.isPending}
                          key={customer.customerId}
                          visibleColumns={visibleColumns}
                          onOpenAction={openAction}
                          onSelect={(selectedCustomer, selected) =>
                            customerSelection.setItemSelected(
                              selectedCustomer.customerId,
                              selected,
                            )
                          }
                          onViewDetails={viewDetails}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <CustomerPagination
                  pagination={pagination}
                  onPageChange={setPage}
                  onPageSizeChange={(nextLimit) => {
                    setLimit(nextLimit)
                    setPage(1)
                  }}
                />
              </div>
            )}
          </main>

        </section>
      </div>

      {actionTarget ? (
        <CustomerActionModal
          action={actionTarget.action}
          customer={actionTarget.customer}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          onClose={() => {
            if (!actionMutation.isPending) {
              setActionTarget(null)
              setActionError(null)
            }
          }}
          onSubmit={submitAction}
        />
      ) : null}
    </PageContainer>
  )
}

function buildMetrics({
  customers,
  summary,
  visibleAttentionCount,
  visibleWarningCount,
}: {
  customers: AdminCustomerListItem[]
  summary?: AdminCustomersSummary
  visibleAttentionCount: number
  visibleWarningCount: number
}) {
  const activeOrderCount =
    summary?.withActiveOrders ??
    customers.filter((customer) => customer.orderSummary.activeOrders > 0).length
  const blockedCount =
    summary?.blocked ??
    customers.filter((customer) => customer.status === 'BLOCKED').length

  return [
    {
      label: 'Needs action',
      value: String(visibleAttentionCount),
      meta: `${visibleWarningCount} warning signals on this page`,
      tone: 'warning' as const,
    },
    {
      label: 'Active order risk',
      value: String(activeOrderCount),
      meta: 'Customers with live orders',
      tone: 'success' as const,
    },
    {
      label: 'Blocked',
      value: String(blockedCount),
      meta: 'Review before reactivation',
      tone: 'danger' as const,
    },
  ]
}

function buildQueueItems({
  counts,
}: {
  counts?: CustomerQueueCounts
}) {
  return [
    {
      key: 'all' as const,
      label: 'All customers',
      count: counts?.all,
    },
    {
      key: 'active' as const,
      label: 'Active',
      count: counts?.active,
    },
    {
      key: 'blocked' as const,
      label: 'Blocked',
      count: counts?.blocked,
    },
    {
      key: 'incomplete' as const,
      label: 'Incomplete',
      count: counts?.incomplete,
    },
    {
      key: 'activeOrders' as const,
      label: 'Active orders',
      count: counts?.activeOrders,
    },
    // Wallet credit queue can be restored here if the filter is needed again.
  ]
}

interface CustomerQueueCounts {
  all: number
  active: number
  blocked: number
  incomplete: number
  activeOrders: number
}
