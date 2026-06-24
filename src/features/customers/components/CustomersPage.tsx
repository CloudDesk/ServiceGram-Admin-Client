import {
  ArrowUpRight,
  Ban,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  MapPin,
  MessageSquarePlus,
  RefreshCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  UserCheck,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { featureFlags } from '../../../config/featureFlags'
import { routePaths } from '../../../config/routes'
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
const customerDataColumns = [
  { id: 'customer', label: 'Customer', width: 'minmax(14rem,1fr)' },
  { id: 'location', label: 'Location', width: 'minmax(10rem,0.7fr)' },
  { id: 'health', label: 'Health', width: 'minmax(9rem,0.55fr)' },
  { id: 'orders', label: 'Orders', width: 'minmax(8rem,0.5fr)' },
  ...(featureFlags.customerWallet
    ? ([{ id: 'wallet', label: 'Wallet', width: 'minmax(8rem,0.5fr)' }] as const)
    : []),
  { id: 'lastLogin', label: 'Last login', width: 'minmax(10rem,0.65fr)' },
  { id: 'updatedAt', label: 'Updated', width: 'minmax(10rem,0.65fr)' },
] as const

type CustomerTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type CustomerColumnId = (typeof customerDataColumns)[number]['id']
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

function toneClasses(tone: CustomerTone) {
  if (tone === 'success') return 'border-success/25 bg-success/10 text-success'
  if (tone === 'warning') return 'border-warning/25 bg-warning/10 text-warning'
  if (tone === 'danger') return 'border-danger/25 bg-danger/10 text-danger'
  if (tone === 'info') return 'border-primary/25 bg-primary/10 text-primary'
  return 'border-border bg-surface-muted text-muted'
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

function signalLabel(warning: string) {
  const labels: Record<string, string> = {
    CUSTOMER_BLOCKED: 'Customer blocked',
    HAS_ACTIVE_ORDERS: 'Active orders',
    HAS_WALLET_CREDIT: 'Wallet credit',
    PROFILE_INCOMPLETE: 'Profile incomplete',
    ZONE_MISSING: 'Zone missing',
  }

  return labels[warning] ?? humanizeCode(warning)
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

function getCustomerGridTemplate(visibleColumns: CustomerColumnId[]) {
  const selectedWidths = customerDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => column.width)

  return [...selectedWidths, 'minmax(8rem,0.62fr)'].join(' ')
}

function getCustomerGridMinWidth(visibleColumns: CustomerColumnId[]) {
  return `${20 + visibleColumns.length * 10}rem`
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
  onOpenAction,
  onSelect,
  onViewDetails,
  selected = false,
  visibleColumns,
}: {
  customer: AdminCustomerListItem
  onOpenAction: (customer: AdminCustomerListItem, kind: CustomerActionKind) => void
  onSelect: (customer: AdminCustomerListItem) => void
  onViewDetails: (customer: AdminCustomerListItem) => void
  selected?: boolean
  visibleColumns: CustomerColumnId[]
}) {
  const health = customerHealth(customer)
  const recommendedAction = mapRecommendedAction(customer)
  const warningCount = visibleWarnings(customer.warnings).length
  const showColumn = (columnId: CustomerColumnId) => visibleColumns.includes(columnId)

  const handlePrimaryAction = () => {
    if (recommendedAction) {
      onOpenAction(customer, recommendedAction)
      return
    }

    onViewDetails(customer)
  }

  return (
    <article
      className={cn(
        'grid min-w-0 cursor-pointer gap-3 border-b border-border px-3 py-2.5 transition last:border-b-0 xl:grid-cols-[var(--customer-grid-template)] xl:items-center',
        selected ? 'bg-primary/5' : 'bg-surface hover:bg-surface-muted/60',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(customer)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(customer)
        }
      }}
    >
      {showColumn('customer') ? (
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
              customer.status === 'BLOCKED'
                ? 'border-danger/25 bg-danger/10 text-danger'
                : customerNeedsAttention(customer)
                  ? 'border-warning/25 bg-warning/10 text-warning'
                  : 'border-success/25 bg-success/10 text-success',
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
        <div className="space-y-2">
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

      <div className="flex items-center gap-2 xl:justify-end">
        <Button
          size="sm"
          type="button"
          variant={
            recommendedAction === 'BLOCK'
              ? 'danger'
              : customerNeedsAttention(customer)
                ? 'primary'
                : 'secondary'
          }
          onClick={(event) => {
            event.stopPropagation()
            handlePrimaryAction()
          }}
        >
          <ArrowUpRight className="mr-2 size-4" />
          {primaryActionLabel(customer)}
        </Button>
        <button
          aria-label={`Open details for ${customer.fullName}`}
          className="btn-icon"
          title="Open details"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onViewDetails(customer)
          }}
        >
          <Eye className="size-4" />
        </button>
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

function CustomerInspector({
  customer,
  isSubmitting,
  onOpenAction,
  onViewDetails,
}: {
  customer: AdminCustomerListItem
  isSubmitting: boolean
  onOpenAction: (customer: AdminCustomerListItem, kind: CustomerActionKind) => void
  onViewDetails: (customer: AdminCustomerListItem) => void
}) {
  const hasAction = (action: string) => customer.availableActions.includes(action)
  const firstWarning = visibleWarnings(customer.warnings)[0]
  const nextRecommendedAction = visibleRecommendedAction(customer)
  const healthy = !firstWarning && customer.status === 'ACTIVE'

  return (
    <aside className="hidden min-h-0 space-y-3 self-stretch overflow-y-auto rounded-[0.875rem] border border-border bg-surface p-3 shadow-surface 2xl:col-start-3 2xl:row-start-1 2xl:block">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Selected customer
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold text-foreground">
            {customer.fullName}
          </h2>
          <p className="text-sm text-muted">{customer.customerId}</p>
        </div>
        <Badge tone={customerNeedsAttention(customer) ? 'warning' : 'success'}>
          {customerNeedsAttention(customer) ? 'Action needed' : 'Healthy'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[0.875rem] border border-border bg-surface-muted p-3">
          <p className="text-xs text-muted">Orders</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {customer.orderSummary.totalOrders}
          </p>
        </div>
        <div className="rounded-[0.875rem] border border-border bg-surface-muted p-3">
          <p className="text-xs text-muted">
            {featureFlags.customerWallet ? 'Wallet' : 'Notes'}
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {featureFlags.customerWallet
              ? formatPaise(customer.walletSummary.creditBalancePaise)
              : customer.noteSummary.totalNotes}
          </p>
        </div>
      </div>

      <div
        className={cn(
          'rounded-[0.875rem] border p-3',
          healthy
            ? 'border-success/25 bg-success/10 text-success'
            : 'border-warning/25 bg-warning/10 text-warning',
        )}
      >
        <div className="flex items-start gap-2">
          {healthy ? (
            <CheckCircle2 className="mt-0.5 size-4" />
          ) : (
            <ShieldAlert className="mt-0.5 size-4" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {healthy ? 'No active warning' : signalLabel(firstWarning ?? '')}
            </p>
            <p className="mt-1 text-xs leading-5 opacity-80">
              {nextRecommendedAction
                ? `Recommended: ${humanizeCode(nextRecommendedAction)}`
                : healthy
                  ? 'This customer has no warning in the current response.'
                  : 'Open the customer record before taking high-impact action.'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          className="w-full justify-start"
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onViewDetails(customer)}
        >
          <ArrowUpRight className="mr-2 size-4" />
          View details
        </Button>
        <Button
          className="w-full justify-start"
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onOpenAction(customer, 'ADD_NOTE')}
        >
          <MessageSquarePlus className="mr-2 size-4" />
          Add note
        </Button>
        {featureFlags.customerWallet && hasAction('WALLET_CREDIT') ? (
          <Button
            className="w-full justify-start"
            disabled={isSubmitting}
            size="sm"
            variant="secondary"
            onClick={() => onOpenAction(customer, 'WALLET_CREDIT')}
          >
            <CreditCard className="mr-2 size-4" />
            Wallet credit
          </Button>
        ) : null}
        {hasAction('BLOCK') ? (
          <Button
            className="w-full justify-start"
            disabled={isSubmitting}
            size="sm"
            variant="danger"
            onClick={() => onOpenAction(customer, 'BLOCK')}
          >
            <Ban className="mr-2 size-4" />
            Block customer
          </Button>
        ) : null}
        {hasAction('UNBLOCK') ? (
          <Button
            className="w-full justify-start"
            disabled={isSubmitting}
            size="sm"
            variant="secondary"
            onClick={() => onOpenAction(customer, 'UNBLOCK')}
          >
            <UserCheck className="mr-2 size-4" />
            Unblock customer
          </Button>
        ) : null}
      </div>

      <div className="border-t border-border pt-3">
        <h3 className="text-sm font-semibold text-foreground">Activity trail</h3>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex gap-2">
            <Clock3 className="mt-0.5 size-4 text-muted" />
            <p>
              <span className="font-medium">Last order</span>
              <br />
              <span className="text-xs text-muted">
                {formatDateSafe(customer.orderSummary.lastOrderAt)}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <MessageSquarePlus className="mt-0.5 size-4 text-muted" />
            <p>
              <span className="font-medium">Last note</span>
              <br />
              <span className="text-xs text-muted">
                {formatDateSafe(customer.noteSummary.lastNoteAt)}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <UserCheck className="mt-0.5 size-4 text-success" />
            <p>
              <span className="font-medium">Last login</span>
              <br />
              <span className="text-xs text-muted">
                {formatDateSafe(customer.lastLoginAt)}
              </span>
            </p>
          </div>
        </div>
      </div>
    </aside>
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
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | AdminCustomerStatus>('')
  const [city, setCity] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [hasOrders, setHasOrders] = useState('')
  const [hasWalletCredit, setHasWalletCredit] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<CustomerColumnId[]>(
    defaultCustomerColumns,
  )

  const resetToFirstPage = () => setPage(1)

  const query = useMemo<AdminCustomersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: status || undefined,
      city: city.trim() || undefined,
      zoneId: zoneId.trim() || undefined,
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
      zoneId,
    ],
  )

  const customersQuery = useQuery({
    queryKey: ['customers', query],
    queryFn: () => customerService.getCustomerList(query),
  })

  const customers = customersQuery.data?.data ?? []
  const pagination = customersQuery.data?.pagination
  const summary = customersQuery.data?.summary
  const selectedCustomer =
    customers.find((customer) => customer.customerId === selectedCustomerId) ??
    customers[0] ??
    null
  const isInitialLoading = customersQuery.isLoading && !customersQuery.data
  const isRefreshing = customersQuery.isFetching && Boolean(customersQuery.data)

  const visibleAttentionCount = customers.filter(customerNeedsAttention).length
  const visibleWarningCount = customers.reduce(
    (total, customer) => total + visibleWarnings(customer.warnings).length,
    0,
  )
  const visibleIncompleteCount = customers.filter(
    (customer) => customer.status === 'INCOMPLETE',
  ).length

  const metrics = buildMetrics({
    customers,
    summary,
    visibleAttentionCount,
    visibleWarningCount,
  })

  const queueItems = buildQueueItems({
    customers,
    pagination,
    summary,
    visibleIncompleteCount,
  })

  const customerGridStyle = useMemo<CustomerGridStyle>(
    () => ({
      '--customer-grid-template': getCustomerGridTemplate(visibleColumns),
      '--customer-grid-min-width': getCustomerGridMinWidth(visibleColumns),
    }),
    [visibleColumns],
  )
  const hasAdditionalColumns =
    visibleColumns.length > defaultCustomerColumns.length ||
    !defaultCustomerColumns.every((columnId) => visibleColumns.includes(columnId))
  const hasWalletFilter = featureFlags.customerWallet && Boolean(hasWalletCredit)

  const hasActiveFilters = Boolean(
    search ||
      status ||
      city ||
      zoneId ||
      hasOrders ||
      hasWalletFilter ||
      dateFrom ||
      dateTo,
  )

  const resetFilters = () => {
    setSearch('')
    setStatus('')
    setCity('')
    setZoneId('')
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
    <PageContainer className="flex h-full min-h-0 flex-col overflow-hidden !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6">
      <PageContextHeader
        description="Search, filter, and manage customer accounts from backend data."
        placement="topbar"
        title="Customers"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3">
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
            'grid min-h-0 flex-1 items-stretch gap-3 overflow-y-auto xl:grid-cols-[18rem_minmax(0,1fr)] xl:overflow-hidden 2xl:grid-cols-[18rem_minmax(0,1fr)_21rem]',
            filtersCollapsed &&
              'xl:grid-cols-[4.25rem_minmax(0,1fr)] 2xl:grid-cols-[4.25rem_minmax(0,1fr)_21rem]',
          )}
        >
          <aside
            className={cn(
              'min-h-0 self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface 2xl:col-start-1 2xl:row-start-1',
              filtersCollapsed
                ? 'flex items-center justify-between gap-3 p-2.5 xl:flex-col xl:justify-start'
                : 'space-y-3 overflow-y-auto p-3',
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
                <span className="text-xs font-semibold uppercase tracking-normal text-muted xl:[writing-mode:vertical-rl] xl:rotate-180">
                  Filters
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
                          {queue.count}
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
                        Search
                      </span>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                        <Input
                          className="min-h-10 pl-9"
                          placeholder="Name, mobile, email"
                          value={search}
                          onChange={(event) => {
                            setSearch(event.target.value)
                            resetToFirstPage()
                          }}
                        />
                      </div>
                    </label>
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
                    {/*
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">Zone ID</span>
                      <Input
                        className="min-h-10"
                        placeholder="UUID"
                        value={zoneId}
                        onChange={(event) => {
                          setZoneId(event.target.value)
                          resetToFirstPage()
                        }}
                      />
                    </label>
                    */}
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

          <main className="flex min-h-0 min-w-0 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface 2xl:col-start-2 2xl:row-start-1">
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
                {isRefreshing ? (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    Refreshing
                  </span>
                ) : null}
                <div className="relative">
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
                  <RefreshCcw className="mr-2 size-4" />
                  Refresh
                </Button>
              </div>
            </div>

            {customersQuery.isError ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <ErrorState
                  description="We could not load customer data. Please retry."
                  title="Customer data unavailable"
                  onRetry={() => void customersQuery.refetch()}
                />
              </div>
            ) : isInitialLoading ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <CustomerRowsSkeleton />
              </div>
            ) : customers.length === 0 ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <EmptyState
                  description="No customers matched the selected filters."
                  title="No customers"
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-auto">
                  <div
                    className={cn(
                      'min-w-0',
                      hasAdditionalColumns &&
                        'xl:min-w-[var(--customer-grid-min-width)]',
                    )}
                    style={customerGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden grid-cols-[var(--customer-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
                      {customerDataColumns
                        .filter((column) => visibleColumns.includes(column.id))
                        .map((column) => (
                          <span key={column.id}>{column.label}</span>
                        ))}
                      <span className="text-right">Actions</span>
                    </div>

                    <div>
                      {customers.map((customer) => (
                        <CustomerRow
                          customer={customer}
                          key={customer.customerId}
                          selected={
                            customer.customerId === selectedCustomer?.customerId
                          }
                          visibleColumns={visibleColumns}
                          onOpenAction={openAction}
                          onSelect={(nextCustomer) =>
                            setSelectedCustomerId(nextCustomer.customerId)
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

          {selectedCustomer ? (
            <CustomerInspector
              customer={selectedCustomer}
              isSubmitting={actionMutation.isPending}
              onOpenAction={openAction}
              onViewDetails={viewDetails}
            />
          ) : null}
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
  customers,
  pagination,
  summary,
  visibleIncompleteCount,
}: {
  customers: AdminCustomerListItem[]
  pagination?: AdminCustomersPagination
  summary?: AdminCustomersSummary
  visibleIncompleteCount: number
}) {
  return [
    {
      key: 'all' as const,
      label: 'All customers',
      count: pagination?.totalItems ?? summary?.visible ?? customers.length,
    },
    {
      key: 'active' as const,
      label: 'Active',
      count:
        summary?.active ??
        customers.filter((customer) => customer.status === 'ACTIVE').length,
    },
    {
      key: 'blocked' as const,
      label: 'Blocked',
      count:
        summary?.blocked ??
        customers.filter((customer) => customer.status === 'BLOCKED').length,
    },
    {
      key: 'incomplete' as const,
      label: 'Incomplete',
      count: visibleIncompleteCount,
    },
    {
      key: 'activeOrders' as const,
      label: 'Active orders',
      count:
        summary?.withActiveOrders ??
        customers.filter((customer) => customer.orderSummary.activeOrders > 0)
          .length,
    },
    // Wallet credit queue can be restored here if the filter is needed again.
  ]
}
