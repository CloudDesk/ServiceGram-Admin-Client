import {
  Activity,
  ArrowUpRight,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Eye,
  Filter,
  Mail,
  MapPin,
  MessageSquarePlus,
  Phone,
  RefreshCcw,
  Search,
  ShieldAlert,
  UserCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import type { ComponentType, ReactNode, SVGProps } from 'react'
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
const statuses: AdminCustomerStatus[] = ['ACTIVE', 'BLOCKED', 'INCOMPLETE']
const directoryGridClassName = featureFlags.customerWallet
  ? 'grid-cols-[2.5rem_minmax(17rem,1.2fr)_minmax(12rem,0.8fr)_minmax(11rem,0.7fr)_minmax(11rem,0.7fr)_minmax(11rem,0.72fr)_minmax(12rem,0.8fr)]'
  : 'grid-cols-[2.5rem_minmax(17rem,1.2fr)_minmax(12rem,0.8fr)_minmax(11rem,0.7fr)_minmax(11rem,0.7fr)_minmax(12rem,0.8fr)]'
const directoryMinWidthClassName = featureFlags.customerWallet
  ? 'min-w-[72rem]'
  : 'min-w-[62rem]'

type CustomerTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type QueueKey = 'all' | 'atRisk' | 'activeOrders' | 'walletCredit' | 'blocked'
type MetricIcon = ComponentType<SVGProps<SVGSVGElement>>

interface ActionTarget {
  action: CustomerActionSelection
  customer: AdminCustomerListItem
}

interface MetricCardProps {
  Icon: MetricIcon
  label: string
  meta: string
  tone: CustomerTone
  value: string
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
    CUSTOMER_BLOCKED: 'Blocked',
    HAS_ACTIVE_ORDERS: 'Active orders',
    HAS_WALLET_CREDIT: 'Wallet credit',
    PROFILE_INCOMPLETE: 'Incomplete',
    ZONE_MISSING: 'Zone missing',
  }

  return labels[warning] ?? humanizeCode(warning)
}

function signalTone(warning: string): CustomerTone {
  if (warning === 'CUSTOMER_BLOCKED' || warning === 'ZONE_MISSING') {
    return 'danger'
  }

  if (warning === 'HAS_WALLET_CREDIT') return 'info'
  return 'warning'
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

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function lastActivity(customer: AdminCustomerListItem) {
  if (customer.lastLoginAt) {
    return {
      label: 'Last login',
      value: formatDateSafe(customer.lastLoginAt),
    }
  }

  if (customer.orderSummary.lastOrderAt) {
    return {
      label: 'Last order',
      value: formatDateSafe(customer.orderSummary.lastOrderAt),
    }
  }

  return {
    label: 'Updated',
    value: formatDateSafe(customer.updatedAt),
  }
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

function primaryActionLabel(customer: AdminCustomerListItem) {
  const nextRecommendedAction = visibleRecommendedAction(customer)

  if (nextRecommendedAction) {
    return humanizeCode(nextRecommendedAction)
  }

  if (customer.status === 'BLOCKED') return 'Review block'
  if (visibleWarnings(customer.warnings).length > 0) return 'Review customer'
  return 'View details'
}

function MetricCard({ Icon, label, meta, tone, value }: MetricCardProps) {
  return (
    <div className="min-h-[5rem] rounded-[0.75rem] border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] border',
            toneClasses(tone),
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold tracking-normal text-foreground">
            {value}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">{meta}</p>
        </div>
      </div>
    </div>
  )
}

function SignalPill({ label, tone }: { label: string; tone: CustomerTone }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-full border px-2 text-xs font-semibold',
        toneClasses(tone),
      )}
    >
      {label}
    </span>
  )
}

function QueueButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean
  count: number
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'relative min-h-11 border-b-2 px-3 text-sm font-semibold transition',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted hover:text-foreground',
      )}
      type="button"
      onClick={onClick}
    >
      <span>{label}</span>
      <span
        className={cn(
          'ml-2 rounded-full px-2 py-0.5 text-xs',
          active ? 'bg-primary/10 text-primary' : 'bg-surface-muted text-muted',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function ActionIconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className="btn-icon"
      title={label}
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

function CustomerDirectoryRow({
  checked,
  customer,
  onOpenAction,
  onSelect,
  onToggleChecked,
  onViewDetails,
  selected,
}: {
  checked: boolean
  customer: AdminCustomerListItem
  onOpenAction: (customer: AdminCustomerListItem, kind: CustomerActionKind) => void
  onSelect: (customer: AdminCustomerListItem) => void
  onToggleChecked: (customerId: string) => void
  onViewDetails: (customer: AdminCustomerListItem) => void
  selected: boolean
}) {
  const activity = lastActivity(customer)
  const health = customerHealth(customer)
  const recommendedAction = mapRecommendedAction(customer)
  const nextRecommendedAction = visibleRecommendedAction(customer)
  const visibleSignals = visibleWarnings(customer.warnings).slice(0, 2)

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
        'grid cursor-pointer items-center gap-3 border-b border-border px-3 py-3 transition last:border-b-0',
        directoryMinWidthClassName,
        directoryGridClassName,
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
      <label
        className="flex items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="sr-only">Select {customer.fullName}</span>
        <input
          checked={checked}
          className="size-4 rounded border-border accent-[color:var(--adaptive-primary)]"
          type="checkbox"
          onChange={() => onToggleChecked(customer.customerId)}
        />
      </label>

      <div className="flex min-w-0 items-center gap-3">
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
          {initials(customer.fullName)}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {customer.fullName}
            </p>
            {checked ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex min-w-0 items-center gap-1">
              <Phone className="size-3.5 shrink-0" />
              {customer.mobileNumber ?? 'No mobile'}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">{customer.email ?? 'No email'}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <MapPin className="size-4 text-muted" />
          <span>{customer.city || customer.zone?.city || 'No city'}</span>
        </div>
        <p className="pl-6 text-xs text-muted">
          {customer.zone?.zoneName ?? 'No zone'}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(customer.status)}>{customer.status}</Badge>
          {visibleSignals.map((warning) => (
            <SignalPill
              key={warning}
              label={signalLabel(warning)}
              tone={signalTone(warning)}
            />
          ))}
        </div>
        <p className="truncate text-xs text-muted">
          {nextRecommendedAction
            ? `Next: ${humanizeCode(nextRecommendedAction)}`
            : customerNeedsAttention(customer)
              ? 'Review customer'
              : 'No action queued'}
        </p>
      </div>

      <div className="space-y-1 text-sm">
        <p className="font-semibold text-foreground">
          {customer.orderSummary.totalOrders} orders
        </p>
        <p className="text-xs text-muted">
          {customer.orderSummary.activeOrders} active
        </p>
      </div>

      {featureFlags.customerWallet ? (
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-foreground">
            {formatPaise(customer.walletSummary.creditBalancePaise)}
          </p>
          <p className="truncate text-xs text-muted">
            {customer.walletSummary.providerStatus}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{activity.label}</p>
          <p className="truncate text-sm text-foreground">{activity.value}</p>
          <div className="mt-1 h-1.5 w-28 max-w-full rounded-full bg-surface-muted">
            <div
              className={cn('h-1.5 rounded-full', healthColor(health))}
              style={{ width: `${health}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            className="min-w-[7rem]"
            size="sm"
            type="button"
            variant={customerNeedsAttention(customer) ? 'primary' : 'secondary'}
            onClick={(event) => {
              event.stopPropagation()
              handlePrimaryAction()
            }}
          >
            <ArrowUpRight className="mr-2 size-4" />
            {primaryActionLabel(customer)}
          </Button>
          <ActionIconButton
            label={`Open details for ${customer.fullName}`}
            onClick={() => onViewDetails(customer)}
          >
            <Eye className="size-4" />
          </ActionIconButton>
          <ActionIconButton
            label={`Add note for ${customer.fullName}`}
            onClick={() => onOpenAction(customer, 'ADD_NOTE')}
          >
            <MessageSquarePlus className="size-4" />
          </ActionIconButton>
          {featureFlags.customerWallet &&
          customer.availableActions.includes('WALLET_CREDIT') ? (
            <ActionIconButton
              label={`Apply wallet credit for ${customer.fullName}`}
              onClick={() => onOpenAction(customer, 'WALLET_CREDIT')}
            >
              <CreditCard className="size-4" />
            </ActionIconButton>
          ) : null}
          {customer.availableActions.includes('BLOCK') ? (
            <ActionIconButton
              label={`Block ${customer.fullName}`}
              onClick={() => onOpenAction(customer, 'BLOCK')}
            >
              <Ban className="size-4" />
            </ActionIconButton>
          ) : null}
          {customer.availableActions.includes('UNBLOCK') ? (
            <ActionIconButton
              label={`Unblock ${customer.fullName}`}
              onClick={() => onOpenAction(customer, 'UNBLOCK')}
            >
              <UserCheck className="size-4" />
            </ActionIconButton>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function CustomerRowsSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="h-16 w-full rounded-[0.75rem]" key={index} />
      ))}
    </div>
  )
}

function CustomerPagination({
  localFilterLabel,
  onPageChange,
  onPageSizeChange,
  pagination,
  visibleCount,
}: {
  localFilterLabel?: string
  onPageChange: (page: number) => void
  onPageSizeChange: (limit: number) => void
  pagination?: AdminCustomersPagination
  visibleCount?: number
}) {
  if (!pagination) return null

  const start =
    pagination.totalItems === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.totalItems)
  const rangeLabel =
    localFilterLabel && typeof visibleCount === 'number'
      ? `Showing ${visibleCount} ${localFilterLabel} on this page`
      : `Showing ${start}-${end} of ${pagination.totalItems}`

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-surface-muted px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span>{rangeLabel}</span>
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

function buildMetrics({
  customers,
  pagination,
  summary,
}: {
  customers: AdminCustomerListItem[]
  pagination?: AdminCustomersPagination
  summary?: AdminCustomersSummary
}) {
  const atRiskCount = customers.filter(customerNeedsAttention).length
  const activeOrderCount =
    summary?.withActiveOrders ??
    customers.filter((customer) => customer.orderSummary.activeOrders > 0).length
  const totalCustomers = pagination?.totalItems ?? summary?.visible ?? customers.length

  return [
    {
      Icon: UsersRound,
      label: 'Total customers',
      value: String(totalCustomers),
      meta: `${summary?.active ?? 0} active accounts`,
      tone: 'success' as const,
    },
    {
      Icon: Activity,
      label: 'Active order risk',
      value: String(activeOrderCount),
      meta: 'Customers with live orders',
      tone: 'info' as const,
    },
    {
      Icon: ShieldAlert,
      label: 'At risk',
      value: String(atRiskCount),
      meta: 'Visible rows needing action',
      tone: 'warning' as const,
    },
    ...(featureFlags.customerWallet
      ? [
          {
            Icon: WalletCards,
            label: 'Wallet exposure',
            value: formatPaise(summary?.walletCreditPaise ?? 0),
            meta: 'Open customer credit',
            tone: 'danger' as const,
          },
        ]
      : []),
  ]
}

export function CustomerWorkbenchPreviewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [queue, setQueue] = useState<QueueKey>('all')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | AdminCustomerStatus>('')
  const [city, setCity] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null)

  const resetToFirstPage = () => setPage(1)

  const query = useMemo<AdminCustomersQueryParams>(() => {
    const queryStatus = queue === 'blocked' ? 'BLOCKED' : status || undefined

    return {
      page,
      limit,
      search: search.trim() || undefined,
      status: queryStatus,
      city: city.trim() || undefined,
      hasOrders: queue === 'activeOrders' ? true : undefined,
      hasWalletCredit:
        featureFlags.customerWallet && queue === 'walletCredit' ? true : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }
  }, [city, dateFrom, dateTo, limit, page, queue, search, status])

  const customersQuery = useQuery({
    queryKey: ['customer-workbench-preview', query],
    queryFn: () => customerService.getCustomerList(query),
  })

  const customers = customersQuery.data?.data ?? []
  const pagination = customersQuery.data?.pagination
  const summary = customersQuery.data?.summary
  const visibleCustomers =
    queue === 'atRisk' ? customers.filter(customerNeedsAttention) : customers
  const selectedCustomer =
    visibleCustomers.find((customer) => customer.customerId === selectedCustomerId) ??
    visibleCustomers[0] ??
    null
  const isInitialLoading = customersQuery.isLoading && !customersQuery.data
  const isRefreshing = customersQuery.isFetching && Boolean(customersQuery.data)
  const allVisibleSelected =
    visibleCustomers.length > 0 &&
    visibleCustomers.every((customer) => selectedRows.includes(customer.customerId))
  const selectedCustomerWarning = selectedCustomer
    ? visibleWarnings(selectedCustomer.warnings)[0]
    : undefined
  const selectedCustomerNextRecommendedAction = selectedCustomer
    ? visibleRecommendedAction(selectedCustomer)
    : null

  const metrics = buildMetrics({ customers, pagination, summary })
  const queueTabs = [
    {
      key: 'all' as const,
      label: 'All customers',
      count: pagination?.totalItems ?? summary?.visible ?? customers.length,
    },
    {
      key: 'atRisk' as const,
      label: 'At risk',
      count: customers.filter(customerNeedsAttention).length,
    },
    {
      key: 'activeOrders' as const,
      label: 'Active orders',
      count:
        summary?.withActiveOrders ??
        customers.filter((customer) => customer.orderSummary.activeOrders > 0)
          .length,
    },
    ...(featureFlags.customerWallet
      ? [
          {
            key: 'walletCredit' as const,
            label: 'Wallet credit',
            count: customers.filter(
              (customer) => customer.walletSummary.creditBalancePaise > 0,
            ).length,
          },
        ]
      : []),
    {
      key: 'blocked' as const,
      label: 'Blocked',
      count:
        summary?.blocked ??
        customers.filter((customer) => customer.status === 'BLOCKED').length,
    },
  ]

  const resetFilters = () => {
    setQueue('all')
    setSearch('')
    setStatus('')
    setCity('')
    setDateFrom('')
    setDateTo('')
    setSelectedRows([])
    setPage(1)
  }

  const applyQueue = (nextQueue: QueueKey) => {
    setQueue(nextQueue)
    setStatus('')
    setSelectedRows([])
    setPage(1)
  }

  const openAction = (customer: AdminCustomerListItem, kind: CustomerActionKind) => {
    setActionError(null)
    setActionTarget({ action: { kind }, customer })
  }

  const viewDetails = (customer: AdminCustomerListItem) => {
    navigate(`${routePaths.customers}/${customer.customerId}`)
  }

  const toggleSelectedRow = (customerId: string) => {
    setSelectedRows((currentRows) =>
      currentRows.includes(customerId)
        ? currentRows.filter((currentId) => currentId !== customerId)
        : [...currentRows, customerId],
    )
  }

  const toggleAllVisibleRows = () => {
    if (allVisibleSelected) {
      setSelectedRows((currentRows) =>
        currentRows.filter(
          (customerId) =>
            !visibleCustomers.some((customer) => customer.customerId === customerId),
        ),
      )
      return
    }

    setSelectedRows((currentRows) => [
      ...new Set([
        ...currentRows,
        ...visibleCustomers.map((customer) => customer.customerId),
      ]),
    ])
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
      void queryClient.invalidateQueries({ queryKey: ['customer-workbench-preview'] })
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
    <PageContainer>
      <PageContextHeader
        description="Live customer directory with compact filters, risk queues, and support actions."
        placement="topbar"
        title="Customers"
      />

      <div className="space-y-4">
        <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-muted">
              Directory / <span className="text-primary">Customers</span>
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
              Customers
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedRows.length > 0 ? (
              <span className="rounded-full bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                {selectedRows.length} selected
              </span>
            ) : null}
            <Button
              disabled={isInitialLoading}
              isLoading={isRefreshing}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void customersQuery.refetch()}
            >
              <RefreshCcw className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              Icon={metric.Icon}
              key={metric.label}
              label={metric.label}
              meta={metric.meta}
              tone={metric.tone}
              value={metric.value}
            />
          ))}
        </section>

        <section className="overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface">
          <div className="border-b border-border px-4 pt-3">
            <div className="flex min-w-0 gap-2 overflow-x-auto">
              {queueTabs.map((tab) => (
                <QueueButton
                  active={queue === tab.key}
                  count={tab.count}
                  key={tab.key}
                  label={tab.label}
                  onClick={() => applyQueue(tab.key)}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3 border-b border-border bg-surface px-4 py-3 xl:grid-cols-[minmax(20rem,1fr)_10rem_12rem_12rem_12rem_auto] xl:items-end">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-normal text-muted">
                Search
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input
                  className="min-h-10 pl-9"
                  placeholder="Filter by name, mobile, or email"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    resetToFirstPage()
                  }}
                />
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-normal text-muted">
                Status
              </span>
              <select
                className="form-input min-h-10"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as '' | AdminCustomerStatus)
                  setQueue('all')
                  resetToFirstPage()
                }}
              >
                <option value="">All status</option>
                {statuses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-normal text-muted">
                City
              </span>
              <Input
                className="min-h-10"
                placeholder="Any city"
                value={city}
                onChange={(event) => {
                  setCity(event.target.value)
                  resetToFirstPage()
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-normal text-muted">
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
              <span className="text-xs font-semibold uppercase tracking-normal text-muted">
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
            <Button
              className="min-h-10"
              size="sm"
              type="button"
              variant="secondary"
              onClick={resetFilters}
            >
              <Filter className="mr-2 size-4" />
              Reset
            </Button>
          </div>

          <div className="overflow-x-auto">
            <div className={directoryMinWidthClassName}>
              <div
                className={cn(
                  'grid items-center gap-3 border-b border-border bg-surface-muted px-3 py-3 text-xs font-semibold uppercase tracking-normal text-muted',
                  directoryGridClassName,
                )}
              >
                <label className="flex items-center justify-center">
                  <span className="sr-only">Select visible customers</span>
                  <input
                    checked={allVisibleSelected}
                    className="size-4 rounded border-border accent-[color:var(--adaptive-primary)]"
                    type="checkbox"
                    onChange={toggleAllVisibleRows}
                  />
                </label>
                <span>Customer</span>
                <span>Location</span>
                <span>Status</span>
                <span>Orders</span>
                {featureFlags.customerWallet ? <span>Wallet</span> : null}
                <span className="text-right">Activity / actions</span>
              </div>

              {customersQuery.isError ? (
                <div className="p-4">
                  <ErrorState
                    description="We could not load customer data. Please retry."
                    title="Customer data unavailable"
                    onRetry={() => void customersQuery.refetch()}
                  />
                </div>
              ) : isInitialLoading ? (
                <CustomerRowsSkeleton />
              ) : visibleCustomers.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    description="No customers matched the current filters."
                    title="No customers"
                  />
                </div>
              ) : (
                <div className="max-h-[calc(100vh-var(--spacing-topbar)-21rem)] min-h-[22rem] overflow-y-auto overflow-x-hidden">
                  {visibleCustomers.map((customer) => (
                    <CustomerDirectoryRow
                      checked={selectedRows.includes(customer.customerId)}
                      customer={customer}
                      key={customer.customerId}
                      selected={customer.customerId === selectedCustomer?.customerId}
                      onOpenAction={openAction}
                      onSelect={(nextCustomer) =>
                        setSelectedCustomerId(nextCustomer.customerId)
                      }
                      onToggleChecked={toggleSelectedRow}
                      onViewDetails={viewDetails}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <CustomerPagination
            localFilterLabel={queue === 'atRisk' ? 'at-risk rows' : undefined}
            pagination={pagination}
            visibleCount={queue === 'atRisk' ? visibleCustomers.length : undefined}
            onPageChange={(nextPage) => {
              setSelectedRows([])
              setPage(nextPage)
            }}
            onPageSizeChange={(nextLimit) => {
              setSelectedRows([])
              setLimit(nextLimit)
              setPage(1)
            }}
          />
        </section>

        {selectedCustomer ? (
          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
            <div className="rounded-[0.875rem] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                    Selected customer
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">
                    {selectedCustomer.fullName}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {selectedCustomer.customerId}
                  </p>
                </div>
                <Badge
                  tone={
                    customerNeedsAttention(selectedCustomer) ? 'warning' : 'success'
                  }
                >
                  {customerNeedsAttention(selectedCustomer)
                    ? 'Action needed'
                    : 'Healthy'}
                </Badge>
              </div>

              <div
                className={cn(
                  'mt-4 grid gap-3',
                  featureFlags.customerWallet ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
                )}
              >
                <div className="rounded-[0.75rem] border border-border bg-surface-muted p-3">
                  <p className="text-xs text-muted">Orders</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {selectedCustomer.orderSummary.totalOrders}
                  </p>
                </div>
                {featureFlags.customerWallet ? (
                  <div className="rounded-[0.75rem] border border-border bg-surface-muted p-3">
                    <p className="text-xs text-muted">Wallet</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {formatPaise(selectedCustomer.walletSummary.creditBalancePaise)}
                    </p>
                  </div>
                ) : null}
                <div className="rounded-[0.75rem] border border-border bg-surface-muted p-3">
                  <p className="text-xs text-muted">Notes</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {selectedCustomer.noteSummary.totalNotes}
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  'mt-4 rounded-[0.75rem] border p-3',
                  customerNeedsAttention(selectedCustomer)
                    ? 'border-warning/25 bg-warning/10 text-warning'
                    : 'border-success/25 bg-success/10 text-success',
                )}
              >
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 size-4" />
                  <div>
                    <p className="text-sm font-semibold">
                      {selectedCustomerWarning
                        ? signalLabel(selectedCustomerWarning)
                        : 'No active warning'}
                    </p>
                    <p className="mt-1 text-xs leading-5 opacity-80">
                      {selectedCustomerNextRecommendedAction
                        ? `Recommended: ${humanizeCode(selectedCustomerNextRecommendedAction)}`
                        : customerNeedsAttention(selectedCustomer)
                          ? 'Review the customer before high-impact action.'
                          : 'No operational action is queued for this customer.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="rounded-[0.875rem] border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Quick actions
              </h3>
              <div className="mt-3 space-y-2">
                <Button
                  className="w-full justify-start"
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => viewDetails(selectedCustomer)}
                >
                  <ArrowUpRight className="mr-2 size-4" />
                  View details
                </Button>
                <Button
                  className="w-full justify-start"
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => openAction(selectedCustomer, 'ADD_NOTE')}
                >
                  <MessageSquarePlus className="mr-2 size-4" />
                  Add note
                </Button>
                {featureFlags.customerWallet &&
                selectedCustomer.availableActions.includes('WALLET_CREDIT') ? (
                  <Button
                    className="w-full justify-start"
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => openAction(selectedCustomer, 'WALLET_CREDIT')}
                  >
                    <CreditCard className="mr-2 size-4" />
                    Wallet credit
                  </Button>
                ) : null}
                {selectedCustomer.availableActions.includes('BLOCK') ? (
                  <Button
                    className="w-full justify-start"
                    size="sm"
                    type="button"
                    variant="danger"
                    onClick={() => openAction(selectedCustomer, 'BLOCK')}
                  >
                    <Ban className="mr-2 size-4" />
                    Block customer
                  </Button>
                ) : null}
                {selectedCustomer.availableActions.includes('UNBLOCK') ? (
                  <Button
                    className="w-full justify-start"
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => openAction(selectedCustomer, 'UNBLOCK')}
                  >
                    <UserCheck className="mr-2 size-4" />
                    Unblock customer
                  </Button>
                ) : null}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Activity trail
                </h3>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex gap-2">
                    <Clock3 className="mt-0.5 size-4 text-muted" />
                    <p>
                      <span className="font-medium">Last order</span>
                      <br />
                      <span className="text-xs text-muted">
                        {formatDateSafe(selectedCustomer.orderSummary.lastOrderAt)}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <MessageSquarePlus className="mt-0.5 size-4 text-muted" />
                    <p>
                      <span className="font-medium">Last note</span>
                      <br />
                      <span className="text-xs text-muted">
                        {formatDateSafe(selectedCustomer.noteSummary.lastNoteAt)}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <UserCheck className="mt-0.5 size-4 text-success" />
                    <p>
                      <span className="font-medium">Last login</span>
                      <br />
                      <span className="text-xs text-muted">
                        {formatDateSafe(selectedCustomer.lastLoginAt)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        ) : null}
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
