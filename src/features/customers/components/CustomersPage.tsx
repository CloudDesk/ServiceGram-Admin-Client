import {
  Ban,
  Download,
  Eye,
  MessageSquarePlus,
  MoreHorizontal,
  RefreshCcw,
  UserCheck,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type { DataListColumn, DataListQueueTab } from '../../../components/ui/DataList'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { featureFlags } from '../../../config/featureFlags'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { downloadCsv, timestampedFilename } from '../../../utils/exportCsv'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { customerService } from '../services/customer.service'
import type {
  AdminCustomerListItem,
  AdminCustomerStatus,
  AdminCustomersQueryParams,
} from '../types/customer.types'
import {
  CustomerActionModal,
  type CustomerActionFormValues,
  type CustomerActionKind,
  type CustomerActionSelection,
} from './CustomerActionModal'

const CUSTOMER_LIST_STORAGE_KEY = 'servicegram.customers.list.v1'
const DEFAULT_PAGE_SIZE = 50

/**
 * A "Needs review" queue belongs here, but it has to be a server-side filter:
 * deriving it from `warnings` client-side would only ever filter the loaded
 * page, so page 2 would show a different population under the same label.
 * Blocked on a hasWarnings/needsReview query param.
 */
type QueueKey = 'all' | 'active' | 'blocked' | 'incomplete' | 'activeOrders'

interface ActionTarget {
  action: CustomerActionSelection
  customer: AdminCustomerListItem
}

const customerUpdateActions = new Set([
  'ADD_NOTE',
  'BLOCK',
  'EDIT_PROFILE',
  'MANAGE_ADDRESSES',
  'UNBLOCK',
])

function canRunCustomerAction({
  action,
  canCreditWallet,
  canUpdateCustomer,
}: {
  action: string
  canCreditWallet: boolean
  canUpdateCustomer: boolean
}) {
  const normalizedAction = action.toUpperCase()

  if (customerUpdateActions.has(normalizedAction)) return canUpdateCustomer
  if (normalizedAction === 'WALLET_CREDIT') {
    return featureFlags.customerWallet && canCreditWallet
  }

  return false
}

function statusTone(status: AdminCustomerStatus) {
  if (status === 'ACTIVE') return 'success' as const
  if (status === 'BLOCKED') return 'danger' as const
  return 'warning' as const
}

/** Null renders as an em-dash, never as a sentence. */
function orDash(value: string | null | undefined) {
  return value && value.trim() ? value : '—'
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return '—'

  try {
    return formatDate(value)
  } catch {
    return '—'
  }
}

function rupees(paise: number | null | undefined) {
  if (!paise) return '₹0'
  return formatMoney(paise / 100)
}

interface RowActionsProps {
  customer: AdminCustomerListItem
  canCreditWallet: boolean
  canUpdateCustomer: boolean
  onAction: (customer: AdminCustomerListItem, kind: CustomerActionKind) => void
  onPreview: (customer: AdminCustomerListItem) => void
}

/**
 * Note stays inline because support agents use it constantly. Everything else
 * lives behind the overflow so the row keeps a fixed width.
 */
function RowActions({
  canCreditWallet,
  canUpdateCustomer,
  customer,
  onAction,
  onPreview,
}: RowActionsProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const isBlocked = customer.status === 'BLOCKED'
  const canCredit =
    featureFlags.customerWallet &&
    canRunCustomerAction({ action: 'WALLET_CREDIT', canCreditWallet, canUpdateCustomer })

  const menuItems: { key: string; label: string; onClick: () => void; danger?: boolean }[] = []

  if (canCredit) {
    menuItems.push({
      key: 'credit',
      label: 'Wallet credit',
      onClick: () => onAction(customer, 'WALLET_CREDIT'),
    })
  }

  if (canUpdateCustomer) {
    menuItems.push(
      isBlocked
        ? {
            key: 'unblock',
            label: 'Unblock customer',
            onClick: () => onAction(customer, 'UNBLOCK'),
          }
        : {
            key: 'block',
            label: 'Block customer',
            danger: true,
            onClick: () => onAction(customer, 'BLOCK'),
          },
    )
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-0.5">
      <button
        aria-label={`Quick look at ${customer.fullName}`}
        className="inline-flex size-7 items-center justify-center rounded-[0.5rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Quick look"
        type="button"
        onClick={() => onPreview(customer)}
      >
        <Eye className="size-4" />
      </button>

      {canUpdateCustomer ? (
        <button
          aria-label={`Add note for ${customer.fullName}`}
          className="inline-flex size-7 items-center justify-center rounded-[0.5rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Add note"
          type="button"
          onClick={() => onAction(customer, 'ADD_NOTE')}
        >
          <MessageSquarePlus className="size-4" />
        </button>
      ) : null}

      {menuItems.length ? (
        <>
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`More actions for ${customer.fullName}`}
            className="inline-flex size-7 items-center justify-center rounded-[0.5rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            <MoreHorizontal className="size-4" />
          </button>

          {open ? (
            <div
              className="absolute right-0 top-8 z-40 min-w-[11rem] rounded-[0.6rem] border border-border bg-surface p-1 shadow-lg"
              role="menu"
            >
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[0.45rem] px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted',
                    item.danger && 'text-danger',
                  )}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    item.onClick()
                  }}
                >
                  {item.key === 'credit' ? <Wallet className="size-3.5" /> : null}
                  {item.key === 'block' ? <Ban className="size-3.5" /> : null}
                  {item.key === 'unblock' ? <UserCheck className="size-3.5" /> : null}
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function CustomersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canCreditWallet = usePermission('customers:wallet_credit')
  const canUpdateCustomer = usePermission('customers:update')

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [queue, setQueue] = useState<QueueKey>('all')
  const [city, setCity] = useState('')
  const [hasOrders, setHasOrders] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null)

  const status: '' | AdminCustomerStatus =
    queue === 'active'
      ? 'ACTIVE'
      : queue === 'blocked'
        ? 'BLOCKED'
        : queue === 'incomplete'
          ? 'INCOMPLETE'
          : ''

  const query = useMemo<AdminCustomersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: status || undefined,
      city: city.trim() || undefined,
      hasOrders: hasOrders === '' ? undefined : hasOrders === 'true',
      hasActiveOrders: queue === 'activeOrders' || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [city, dateFrom, dateTo, hasOrders, limit, page, queue, search, status],
  )

  const customersQuery = useQuery({
    queryKey: ['customers', query],
    queryFn: () => customerService.getCustomerList(query),
  })

  const customers = useMemo(
    () => customersQuery.data?.data ?? [],
    [customersQuery.data],
  )

  const pagination = customersQuery.data?.pagination

  /**
   * Queue counts must span the whole result set, not the current page, so they
   * come from a separate minimal request that only reads the summary block.
   */
  const queueCountBase = useMemo<AdminCustomersQueryParams>(
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
    queryKey: ['customers', 'queue-counts', queueCountBase],
    queryFn: async () => {
      const response = await customerService.getCustomerList(queueCountBase)
      const queueSummary = response.summary.queueSummary

      return {
        all: queueSummary?.allCustomers ?? response.pagination.totalItems,
        active: queueSummary?.active ?? response.summary.active,
        blocked: queueSummary?.blocked ?? response.summary.blocked,
        incomplete: queueSummary?.incomplete ?? 0,
        activeOrders: queueSummary?.activeOrders ?? response.summary.withActiveOrders,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const counts = queueCountsQuery.data

  const queueTabs: DataListQueueTab[] = [
    { key: 'all', label: 'All', count: counts?.all },
    { key: 'active', label: 'Active', count: counts?.active },
    { key: 'blocked', label: 'Blocked', count: counts?.blocked, tone: 'danger' },
    { key: 'incomplete', label: 'Incomplete', count: counts?.incomplete },
    { key: 'activeOrders', label: 'Active orders', count: counts?.activeOrders },
  ]

  const appliedFilterCount = [city.trim(), hasOrders, dateFrom, dateTo].filter(Boolean).length

  const clearSeededCustomerParams = () => {
    if (!searchParams.has('search')) return

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('search')
    setSearchParams(nextParams, { replace: true })
  }

  const resetFilters = () => {
    setCity('')
    setHasOrders('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const openAction = (customer: AdminCustomerListItem, kind: CustomerActionKind) => {
    if (!canRunCustomerAction({ action: kind, canCreditWallet, canUpdateCustomer })) return

    setActionError(null)
    setActionTarget({ action: { kind }, customer })
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
        return customerService.addCustomerNote(customer.customerId, { note: values.note })
      }

      if (action.kind === 'BLOCK') {
        if (!values.reason) throw new Error('Block reason is required.')
        return customerService.blockCustomer(customer.customerId, { reason: values.reason })
      }

      if (action.kind === 'UNBLOCK') {
        if (!values.reason) throw new Error('Unblock reason is required.')
        return customerService.unblockCustomer(customer.customerId, { reason: values.reason })
      }

      if (action.kind === 'WALLET_CREDIT') {
        if (!featureFlags.customerWallet) throw new Error('Wallet credit is currently disabled.')
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
      setActionError(error instanceof Error ? error.message : 'Customer action failed.')
    },
  })

  const columns: DataListColumn<AdminCustomerListItem>[] = useMemo(
    () => [
      {
        id: 'customer',
        label: 'Customer',
        defaultWidth: 240,
        minWidth: 200,
        priority: 1,
        grow: true,
        locked: true,
        render: (customer) => (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium text-foreground">
              {customer.fullName}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {orDash(customer.mobileNumber)}
            </span>
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        defaultWidth: 92,
        minWidth: 88,
        priority: 1,
        render: (customer) => (
          <Badge tone={statusTone(customer.status)}>{customer.status}</Badge>
        ),
      },
      {
        id: 'signals',
        label: 'Signals',
        defaultWidth: 72,
        minWidth: 64,
        priority: 1,
        render: (customer) =>
          customer.warnings.length ? (
            <span
              className="inline-flex min-w-5 items-center justify-center rounded-[0.35rem] bg-warning/12 px-1.5 text-xs font-semibold tabular-nums text-warning"
              title={customer.warnings.join(', ')}
            >
              {customer.warnings.length}
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        id: 'location',
        label: 'Location',
        defaultWidth: 150,
        minWidth: 120,
        priority: 2,
        render: (customer) => (
          <span className="truncate text-foreground">
            {customer.city ? customer.city : '—'}
            {customer.zone ? (
              <span className="text-muted"> · {customer.zone.zoneName}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'orders',
        label: 'Orders',
        defaultWidth: 72,
        minWidth: 64,
        priority: 2,
        align: 'right',
        render: (customer) => (
          <span className={customer.orderSummary.totalOrders ? '' : 'text-muted'}>
            {customer.orderSummary.totalOrders || '—'}
          </span>
        ),
      },
      {
        id: 'spend',
        label: 'Spend',
        defaultWidth: 96,
        minWidth: 84,
        priority: 2,
        align: 'right',
        render: (customer) => (
          <span
            className={customer.orderSummary.lifetimeSpendPaise ? '' : 'text-muted'}
          >
            {rupees(customer.orderSummary.lifetimeSpendPaise)}
          </span>
        ),
      },
      {
        id: 'lastOrder',
        label: 'Last order',
        defaultWidth: 110,
        minWidth: 96,
        priority: 3,
        render: (customer) => (
          <span className="text-muted">
            {formatDateSafe(customer.orderSummary.lastOrderAt)}
          </span>
        ),
      },
      ...(featureFlags.customerWallet
        ? [
            {
              id: 'wallet',
              label: 'Wallet',
              defaultWidth: 96,
              minWidth: 84,
              priority: 3 as const,
              align: 'right' as const,
              render: (customer: AdminCustomerListItem) => (
                <span
                  className={
                    customer.walletSummary.creditBalancePaise ? '' : 'text-muted'
                  }
                >
                  {rupees(customer.walletSummary.creditBalancePaise)}
                </span>
              ),
            },
          ]
        : []),
      {
        id: 'lastLogin',
        label: 'Last login',
        defaultWidth: 110,
        minWidth: 96,
        priority: 4,
        defaultHidden: true,
        render: (customer) => (
          <span className="text-muted">{formatDateSafe(customer.lastLoginAt)}</span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        defaultWidth: 110,
        minWidth: 96,
        priority: 4,
        defaultHidden: true,
        render: (customer) => (
          <span className="text-muted">{formatDateSafe(customer.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const selectedCustomers = useMemo(
    () => customers.filter((customer) => selectedIds.includes(customer.customerId)),
    [customers, selectedIds],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('customers'), selectedCustomers, [
      { header: 'Customer ID', value: (customer) => customer.customerId },
      { header: 'Name', value: (customer) => customer.fullName },
      { header: 'Mobile', value: (customer) => customer.mobileNumber },
      { header: 'Email', value: (customer) => customer.email },
      { header: 'Status', value: (customer) => customer.status },
      { header: 'City', value: (customer) => customer.city },
      { header: 'Zone', value: (customer) => customer.zone?.zoneName ?? '' },
      { header: 'Total orders', value: (customer) => customer.orderSummary.totalOrders },
      { header: 'Active orders', value: (customer) => customer.orderSummary.activeOrders },
      {
        header: 'Lifetime spend (INR)',
        value: (customer) => (customer.orderSummary.lifetimeSpendPaise ?? 0) / 100,
      },
      {
        header: 'Wallet credit (INR)',
        value: (customer) => (customer.walletSummary.creditBalancePaise ?? 0) / 100,
      },
      { header: 'Signals', value: (customer) => customer.warnings.join('; ') },
      { header: 'Created', value: (customer) => customer.createdAt },
    ])
  }

  const filterControlClass =
    'h-9 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <Button
            aria-label="Refresh customers"
            className="h-9"
            disabled={customersQuery.isLoading}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void customersQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                'size-4 sm:mr-2',
                customersQuery.isFetching && 'animate-spin motion-reduce:animate-none',
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
        layout="workspace"
        placement="topbar"
        title="Customers"
      />

      <DataList
        activeQueue={queue}
        appliedFilterCount={appliedFilterCount}
        columns={columns}
        emptyHint="Try a different search term or clear the active filters."
        emptyMessage="No customers match these filters"
        errorMessage="Could not load customers."
        filters={
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">City</span>
              <input
                className={filterControlClass}
                placeholder="Any city"
                value={city}
                onChange={(event) => {
                  setCity(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Has orders</span>
              <select
                className={filterControlClass}
                value={hasOrders}
                onChange={(event) => {
                  setHasOrders(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">Any</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Created from</span>
                <input
                  className={filterControlClass}
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Created to</span>
                <input
                  className={filterControlClass}
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
            </div>
          </>
        }
        getRowId={(customer) => customer.customerId}
        isError={customersQuery.isError}
        isLoading={customersQuery.isLoading}
        pagination={{
          page,
          pageSize: limit,
          totalItems: pagination?.totalItems ?? 0,
          totalPages: pagination?.totalPages ?? 1,
          onPageChange: setPage,
          onPageSizeChange: (nextLimit) => {
            setLimit(nextLimit)
            setPage(1)
          },
        }}
        queueTabs={queueTabs}
        rowActions={(customer) => (
          <RowActions
            canCreditWallet={canCreditWallet}
            canUpdateCustomer={canUpdateCustomer}
            customer={customer}
            onAction={openAction}
            onPreview={(target) =>
              navigate(`${routePaths.customers}/${target.customerId}`)
            }
          />
        )}
        rowActionsWidth={96}
        rows={customers}
        search={search}
        searchPlaceholder="Search name, mobile, email…"
        selection={{
          selectedIds,
          onSelectionChange: setSelectedIds,
          actions: (
            <Button size="sm" type="button" variant="ghost" onClick={exportSelected}>
              <Download className="mr-1.5 size-3.5" />
              Export CSV
            </Button>
          ),
        }}
        storageKey={CUSTOMER_LIST_STORAGE_KEY}
        onQueueChange={(key) => {
          setQueue(key as QueueKey)
          setPage(1)
        }}
        onResetFilters={resetFilters}
        onRetry={() => void customersQuery.refetch()}
        onRowClick={(customer) =>
          navigate(`${routePaths.customers}/${customer.customerId}`)
        }
        onSearchChange={(nextSearch) => {
          clearSeededCustomerParams()
          setSearch(nextSearch)
          setPage(1)
        }}
      />

      {actionTarget ? (
        <CustomerActionModal
          action={actionTarget.action}
          customer={actionTarget.customer}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          onClose={() => setActionTarget(null)}
          onSubmit={(values) =>
            void actionMutation.mutateAsync({ target: actionTarget, values })
          }
        />
      ) : null}
    </PageContainer>
  )
}
