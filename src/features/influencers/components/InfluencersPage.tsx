import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  PauseCircle,
  RefreshCcw,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  UserRound,
  XCircle,
} from 'lucide-react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { LookupMultiSelect } from '../../../components/ui/LookupMultiSelect'
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import type { LookupOption } from '../../../types/lookup.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { searchCategoryLookupOptions } from '../../lookups/adminLookups'
import { settingsService } from '../../settings/services/settings.service'
import { influencerService } from '../services/influencer.service'
import {
  InfluencerActionModal,
  type InfluencerActionFormValues,
  type InfluencerActionSelection,
} from './InfluencerActionModal'
import type {
  AdminInfluencer,
  AdminInfluencersQueryParams,
  InfluencerActionKind,
  InfluencersPagination,
  InfluencersSummary,
  InfluencerStatus,
} from '../types/influencer.types'

type InfluencerTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type InfluencerQueueKey =
  | 'pending'
  | 'approved'
  | 'suspended'
  | 'rejected'
  | 'all'

const DEFAULT_PAGE_SIZE = 10
const INFLUENCER_DEFAULT_COLUMN_WIDTH = 220
const INFLUENCER_GRID_COLUMN_GAP = 12
const INFLUENCER_GRID_INLINE_PADDING = 24
const INFLUENCER_ACTION_COLUMN_ID = 'actions'
const INFLUENCER_ACTION_COLUMN_DEFAULT_WIDTH = 320
const INFLUENCER_ACTION_COLUMN_MIN_WIDTH = 240
const INFLUENCER_COLUMN_WIDTH_STORAGE_KEY =
  'servicegram.influencer.columnWidths.v1'

const influencerStatuses: InfluencerStatus[] = [
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'NOT_APPLIED',
]

function readSearchValues(searchParams: URLSearchParams, key: string) {
  return Array.from(
    new Set(
      searchParams
        .getAll(key)
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function readEnumSearchValues<T extends string>(
  searchParams: URLSearchParams,
  key: string,
  allowedValues: readonly T[],
) {
  const allowed = new Set<T>(allowedValues)

  return readSearchValues(searchParams, key).filter((value): value is T =>
    allowed.has(value as T),
  )
}

function readInitialLookup(searchParams: URLSearchParams, idKey: string, labelKey: string) {
  const value = searchParams.get(idKey) ?? ''
  const label = searchParams.get(labelKey) ?? value

  return value ? [{ label, value }] : []
}

function queueKeyForInfluencerStatuses(
  selectedStatuses: InfluencerStatus[],
): InfluencerQueueKey {
  if (selectedStatuses.length === 0) return 'all'
  if (selectedStatuses.length !== 1) return 'all'

  const [status] = selectedStatuses

  if (status === 'PENDING_REVIEW') return 'pending'
  if (status === 'APPROVED') return 'approved'
  if (status === 'SUSPENDED') return 'suspended'
  if (status === 'REJECTED') return 'rejected'

  return 'all'
}

const influencerDataColumns = [
  {
    id: 'creator',
    label: 'Creator',
    defaultWidth: 280,
    minWidth: 220,
  },
  {
    id: 'customer',
    label: 'Customer',
    defaultWidth: 250,
    minWidth: 210,
  },
  {
    id: 'city',
    label: 'City',
    defaultWidth: 180,
    minWidth: 145,
  },
  {
    id: 'status',
    label: 'Status',
    defaultWidth: 190,
    minWidth: 155,
  },
  {
    id: 'activity',
    label: 'Reels',
    defaultWidth: 190,
    minWidth: 155,
  },
  {
    id: 'bookings',
    label: 'Bookings',
    defaultWidth: 180,
    minWidth: 150,
  },
  {
    id: 'commission',
    label: 'Commission',
    defaultWidth: 210,
    minWidth: 170,
  },
  {
    id: 'updatedAt',
    label: 'Updated',
    defaultWidth: 175,
    minWidth: 150,
  },
] as const

type InfluencerColumnId = (typeof influencerDataColumns)[number]['id']
type InfluencerColumnWidthId =
  | InfluencerColumnId
  | typeof INFLUENCER_ACTION_COLUMN_ID
type InfluencerColumnWidths = Partial<Record<InfluencerColumnWidthId, number>>

const defaultInfluencerColumns: InfluencerColumnId[] = [
  'creator',
  'customer',
  'city',
  'status',
  'activity',
  'commission',
]

interface InfluencerGridStyle extends CSSProperties {
  '--influencer-grid-template': string
  '--influencer-grid-min-width': string
}

interface InfluencerMetric {
  label: string
  meta: string
  tone: InfluencerTone
  value: string
}

function statusTone(status: InfluencerStatus | string): InfluencerTone {
  if (status === 'APPROVED') return 'success'
  if (status === 'PENDING_REVIEW') return 'warning'
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'danger'
  return 'neutral'
}

function toneClasses(tone: InfluencerTone) {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'
  return formatDate(value, true)
}

function formatPaise(amountPaise: number, currency = 'INR') {
  return formatMoney(amountPaise / 100, currency)
}

function formatCommissionValue(value: unknown) {
  if (!value || typeof value !== 'object') {
    return 'Not configured'
  }

  const config = value as {
    enabled?: boolean
    commissionType?: string
    commissionValue?: number
  }

  if (config.enabled === false) {
    return 'Disabled'
  }

  if (config.commissionType === 'FIXED') {
    return `${formatPaise(config.commissionValue ?? 0)} fixed`
  }

  const basisPoints =
    typeof config.commissionValue === 'number' ? config.commissionValue : 0

  return `${basisPoints / 100}% per booking`
}

function getInfluencerCustomerLabel(influencer: AdminInfluencer) {
  return (
    influencer.customer.fullName ??
    influencer.customer.mobileNumber ??
    influencer.customer.email ??
    influencer.customer.customerId
  )
}

function buildInfluencerMetrics(
  influencers: AdminInfluencer[],
  pagination?: InfluencersPagination,
  summary?: InfluencersSummary,
): InfluencerMetric[] {
  const total = pagination?.totalItems ?? summary?.total ?? influencers.length
  const pending =
    summary?.PENDING_REVIEW ??
    influencers.filter((influencer) => influencer.status === 'PENDING_REVIEW')
      .length
  const approved =
    summary?.APPROVED ??
    influencers.filter((influencer) => influencer.status === 'APPROVED').length
  const suspended =
    summary?.SUSPENDED ??
    influencers.filter((influencer) => influencer.status === 'SUSPENDED').length

  return [
    {
      label: 'Pending review',
      meta: 'Creator applications waiting for action',
      tone: pending > 0 ? 'warning' : 'neutral',
      value: String(pending),
    },
    {
      label: 'Approved creators',
      meta: 'Creators with upload access',
      tone: approved > 0 ? 'success' : 'neutral',
      value: String(approved),
    },
    {
      label: 'Suspended',
      meta: 'Creator access currently paused',
      tone: suspended > 0 ? 'danger' : 'neutral',
      value: String(suspended),
    },
    {
      label: 'Matched creators',
      meta: 'Total matching current filters',
      tone: 'info',
      value: String(total),
    },
  ]
}

function buildInfluencerQueueItems(summary?: InfluencersSummary) {
  return [
    {
      key: 'pending' as const,
      label: 'Pending review',
      count: summary?.PENDING_REVIEW,
    },
    {
      key: 'approved' as const,
      label: 'Approved',
      count: summary?.APPROVED,
    },
    {
      key: 'suspended' as const,
      label: 'Suspended',
      count: summary?.SUSPENDED,
    },
    {
      key: 'rejected' as const,
      label: 'Rejected',
      count: summary?.REJECTED,
    },
    {
      key: 'all' as const,
      label: 'All creators',
      count: summary?.total,
    },
  ]
}

function getInfluencerColumnDefaultWidth(columnId: InfluencerColumnWidthId) {
  if (columnId === INFLUENCER_ACTION_COLUMN_ID) {
    return INFLUENCER_ACTION_COLUMN_DEFAULT_WIDTH
  }

  return (
    influencerDataColumns.find((column) => column.id === columnId)
      ?.defaultWidth ?? INFLUENCER_DEFAULT_COLUMN_WIDTH
  )
}

function getInfluencerColumnMinWidth(columnId: InfluencerColumnWidthId) {
  if (columnId === INFLUENCER_ACTION_COLUMN_ID) {
    return INFLUENCER_ACTION_COLUMN_MIN_WIDTH
  }

  return (
    influencerDataColumns.find((column) => column.id === columnId)?.minWidth ??
    140
  )
}

function getInfluencerColumnWidth(
  columnWidths: InfluencerColumnWidths,
  columnId: InfluencerColumnWidthId,
) {
  return columnWidths[columnId] ?? getInfluencerColumnDefaultWidth(columnId)
}

function getInfluencerGridTemplate(
  visibleColumns: InfluencerColumnId[],
  columnWidths: InfluencerColumnWidths,
) {
  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...visibleColumns.map(
      (columnId) => `${getInfluencerColumnWidth(columnWidths, columnId)}px`,
    ),
    `${getInfluencerColumnWidth(columnWidths, INFLUENCER_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getInfluencerGridMinWidth(
  visibleColumns: InfluencerColumnId[],
  columnWidths: InfluencerColumnWidths,
) {
  const visibleWidth = visibleColumns.reduce(
    (sum, columnId) => sum + getInfluencerColumnWidth(columnWidths, columnId),
    0,
  )
  const actionWidth = getInfluencerColumnWidth(
    columnWidths,
    INFLUENCER_ACTION_COLUMN_ID,
  )
  const columnCount = visibleColumns.length + 2
  const gapWidth = Math.max(0, columnCount - 1) * INFLUENCER_GRID_COLUMN_GAP

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    actionWidth +
    gapWidth +
    INFLUENCER_GRID_INLINE_PADDING
  }px`
}

function loadInfluencerColumnWidths(): InfluencerColumnWidths {
  try {
    const storedValue = window.localStorage.getItem(
      INFLUENCER_COLUMN_WIDTH_STORAGE_KEY,
    )

    if (!storedValue) return {}

    const parsedValue = JSON.parse(storedValue) as InfluencerColumnWidths

    return Object.fromEntries(
      Object.entries(parsedValue).filter(([, width]) => typeof width === 'number'),
    ) as InfluencerColumnWidths
  } catch {
    return {}
  }
}

function formatRefreshTime(updatedAt: number) {
  if (!updatedAt) return 'Not refreshed yet'

  return `Updated ${formatDate(new Date(updatedAt).toISOString(), true)}`
}

function MetricCard({ label, meta, tone, value }: InfluencerMetric) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <p className={cn('text-xs font-semibold uppercase tracking-normal', toneClasses(tone))}>
        {label}
      </p>
      <p className={cn('mt-3 text-2xl font-semibold tracking-normal', toneClasses(tone))}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function InfluencerRowsSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="grid gap-3 border-b border-border px-3 py-4 xl:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.9fr_0.9fr]"
          key={index}
        >
          {Array.from({ length: 6 }).map((__, cellIndex) => (
            <Skeleton className="h-9 w-full" key={cellIndex} />
          ))}
        </div>
      ))}
    </div>
  )
}

function InfluencerCell({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 min-w-0 text-sm text-foreground">{children}</div>
    </div>
  )
}

export function InfluencersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canReadCustomers = usePermission('customers:read')
  const canReviewInfluencers = usePermission('influencers:review')
  const seededStatuses = readEnumSearchValues(
    searchParams,
    'status',
    influencerStatuses,
  )
  const initialStatuses =
    seededStatuses.length > 0
      ? seededStatuses
      : (['PENDING_REVIEW'] as InfluencerStatus[])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [selectedStatuses, setSelectedStatuses] =
    useState<InfluencerStatus[]>(() => initialStatuses)
  const [selectedCategories, setSelectedCategories] = useState<LookupOption[]>(() =>
    readInitialLookup(searchParams, 'categoryId', 'categoryLabel'),
  )
  const [queue, setQueue] = useState<InfluencerQueueKey>(() =>
    queueKeyForInfluencerStatuses(initialStatuses),
  )
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [visibleColumns, setVisibleColumns] =
    useState<InfluencerColumnId[]>(defaultInfluencerColumns)
  const [columnWidths, setColumnWidths] =
    useState<InfluencerColumnWidths>(loadInfluencerColumnWidths)
  const [selectedAction, setSelectedAction] =
    useState<InfluencerActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        INFLUENCER_COLUMN_WIDTH_STORAGE_KEY,
        JSON.stringify(columnWidths),
      )
    } catch {
      // Column persistence is optional; the table still works without it.
    }
  }, [columnWidths])

  useEffect(() => {
    if (!columnsOpen) return

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

  const statusOptions = useMemo<LookupOption[]>(
    () =>
      influencerStatuses.map((status) => ({
        label: humanizeCode(status),
        value: status,
      })),
    [],
  )
  const categoryIds = useMemo(
    () => selectedCategories.map((category) => category.value),
    [selectedCategories],
  )

  const resetToFirstPage = () => setPage(1)
  const clearSeededInfluencerParams = () => {
    const seededKeys = [
      'categoryId',
      'categoryLabel',
      'city',
      'queue',
      'search',
      'status',
    ] as const

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const query = useMemo<AdminInfluencersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryIds.length > 0 ? categoryIds : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    }),
    [categoryIds, city, limit, page, search, selectedStatuses],
  )

  const influencersQuery = useQuery({
    queryKey: ['influencers', query],
    queryFn: () => influencerService.getInfluencers(query),
  })
  const queueCountBaseQuery = useMemo<AdminInfluencersQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryIds.length > 0 ? categoryIds : undefined,
    }),
    [categoryIds, city, search],
  )
  const queueCountsQuery = useQuery({
    queryKey: ['influencers', 'queue-counts', queueCountBaseQuery],
    queryFn: () => influencerService.getInfluencers(queueCountBaseQuery),
    placeholderData: (previousData) => previousData,
  })

  const commissionSettingQuery = useQuery({
    queryKey: ['settings', 'influencer-commission-phase1'],
    queryFn: () =>
      settingsService.getSettings({
        search: 'influencer.commission.phase1',
        limit: 10,
      }),
  })

  const influencers = influencersQuery.data?.data ?? []
  const pagination = influencersQuery.data?.pagination
  const summary = influencersQuery.data?.summary
  const influencerSelection = useListSelection(
    influencers,
    (influencer) => influencer.influencerProfileId,
  )
  const isInitialLoading = influencersQuery.isLoading && !influencersQuery.data
  const isRefreshing = influencersQuery.isFetching && Boolean(influencersQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing now'
    : formatRefreshTime(influencersQuery.dataUpdatedAt)
  const commissionSetting = commissionSettingQuery.data?.data.find(
    (setting) => setting.settingKey === 'influencer.commission.phase1',
  )
  const stableSummary = queueCountsQuery.data?.summary
  const metrics = buildInfluencerMetrics(influencers, pagination, stableSummary ?? summary)
  const queueItems = buildInfluencerQueueItems(stableSummary)
  const influencerGridStyle = useMemo<InfluencerGridStyle>(
    () => ({
      '--influencer-grid-template': getInfluencerGridTemplate(
        visibleColumns,
        columnWidths,
      ),
      '--influencer-grid-min-width': getInfluencerGridMinWidth(
        visibleColumns,
        columnWidths,
      ),
    }),
    [columnWidths, visibleColumns],
  )
  const isDefaultStatusFilter =
    queue === 'pending' &&
    selectedStatuses.length === 1 &&
    selectedStatuses[0] === 'PENDING_REVIEW'

  const hasActiveFilters = Boolean(
    search ||
      city ||
      categoryIds.length > 0 ||
      !isDefaultStatusFilter,
  )

  const clearInfluencerFilters = () => {
    clearSeededInfluencerParams()
    setQueue('pending')
    setSearch('')
    setCity('')
    setSelectedStatuses(['PENDING_REVIEW'])
    setSelectedCategories([])
    setPage(1)
  }

  const applyQueue = (nextQueue: InfluencerQueueKey) => {
    clearSeededInfluencerParams()
    setQueue(nextQueue)

    if (nextQueue === 'pending') {
      setSelectedStatuses(['PENDING_REVIEW'])
    }

    if (nextQueue === 'approved') {
      setSelectedStatuses(['APPROVED'])
    }

    if (nextQueue === 'suspended') {
      setSelectedStatuses(['SUSPENDED'])
    }

    if (nextQueue === 'rejected') {
      setSelectedStatuses(['REJECTED'])
    }

    if (nextQueue === 'all') {
      setSelectedStatuses([])
    }

    setPage(1)
  }

  const startColumnResize = (
    columnId: InfluencerColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getInfluencerColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          getInfluencerColumnMinWidth(columnId),
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

  const resetColumnWidth = (columnId: InfluencerColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: getInfluencerColumnDefaultWidth(columnId),
    }))
  }

  const toggleColumn = (columnId: InfluencerColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return currentColumns

        return currentColumns.filter((currentColumn) => currentColumn !== columnId)
      }

      return [...currentColumns, columnId]
    })
  }

  const showColumn = (columnId: InfluencerColumnId) =>
    visibleColumns.includes(columnId)

  const viewDetails = (influencer: AdminInfluencer) => {
    navigate(`${routePaths.influencers}/${influencer.influencerProfileId}`)
  }

  const viewCustomer = (influencer: AdminInfluencer) => {
    navigate(`${routePaths.customers}/${influencer.customer.customerId}`)
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: InfluencerActionSelection
      values: InfluencerActionFormValues
    }) => {
      if (action.kind === 'APPROVE') {
        return influencerService.approveInfluencer(
          action.influencer.influencerProfileId,
          { reason: values.reason },
        )
      }

      if (
        (action.kind === 'REJECT' || action.kind === 'SUSPEND') &&
        !values.reason
      ) {
        throw new Error('Reason is required for this action.')
      }

      if (action.kind === 'REJECT') {
        return influencerService.rejectInfluencer(
          action.influencer.influencerProfileId,
          { reason: values.reason },
        )
      }

      if (action.kind === 'SUSPEND') {
        return influencerService.suspendInfluencer(
          action.influencer.influencerProfileId,
          { reason: values.reason },
        )
      }

      return influencerService.reactivateInfluencer(
        action.influencer.influencerProfileId,
        { reason: values.reason },
      )
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: (response, variables) => {
      setSelectedAction(null)
      setActionMessage(response.message ?? 'Influencer action completed.')
      void queryClient.invalidateQueries({ queryKey: ['influencers'] })
      void queryClient.invalidateQueries({
        queryKey: [
          'influencer-detail',
          variables.action.influencer.influencerProfileId,
        ],
      })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Influencer action could not be completed.',
      )
    },
  })

  const openInfluencerAction = (
    kind: InfluencerActionKind,
    influencer: AdminInfluencer,
    event?: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation()

    if (!canReviewInfluencers || !influencer.availableActions.includes(kind)) {
      return
    }

    setActionError(null)
    setSelectedAction({ kind, influencer })
  }

  const renderInfluencerCells = (influencer: AdminInfluencer) => (
    <>
      {showColumn('creator') ? (
        <InfluencerCell label="Creator">
          <p className="truncate font-semibold">{influencer.displayName}</p>
          <p className="mt-1 truncate text-xs text-muted">
            {influencer.publicInfluencerId}
            {influencer.socialHandle ? ` · ${influencer.socialHandle}` : ''}
          </p>
        </InfluencerCell>
      ) : null}
      {showColumn('customer') ? (
        <InfluencerCell label="Customer">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-semibold">
              {getInfluencerCustomerLabel(influencer)}
            </p>
            {canReadCustomers ? (
              <button
                aria-label={`Open customer ${getInfluencerCustomerLabel(influencer)}`}
                className="btn-icon size-7 shrink-0"
                title="Open customer"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  viewCustomer(influencer)
                }}
              >
                <UserRound className="size-3.5" />
              </button>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted">
            {influencer.customer.mobileNumber ??
              influencer.customer.email ??
              influencer.customer.customerId}
          </p>
        </InfluencerCell>
      ) : null}
      {showColumn('city') ? (
        <InfluencerCell label="City">
          <p className="truncate font-semibold">
            {influencer.customer.city ?? 'Not set'}
          </p>
          <p className="mt-1 truncate text-xs text-muted">
            {influencer.customer.zone?.zoneName ?? 'No zone'}
          </p>
        </InfluencerCell>
      ) : null}
      {showColumn('status') ? (
        <InfluencerCell label="Status">
          <Badge tone={statusTone(influencer.status)}>
            {humanizeCode(influencer.status)}
          </Badge>
          {influencer.warnings.length > 0 ? (
            <p className="mt-1 text-xs text-warning">
              {influencer.warnings.length} warning
              {influencer.warnings.length === 1 ? '' : 's'}
            </p>
          ) : (
            <p className="mt-1 truncate text-xs text-muted">
              {influencer.nextRecommendedAction
                ? humanizeCode(influencer.nextRecommendedAction)
                : 'No next action'}
            </p>
          )}
        </InfluencerCell>
      ) : null}
      {showColumn('activity') ? (
        <InfluencerCell label="Reels">
          <p className="font-semibold">
            {influencer.summary.reelCount} reel
            {influencer.summary.reelCount === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {influencer.summary.liveReelCount} live ·{' '}
            {influencer.summary.pendingReelCount} pending
          </p>
        </InfluencerCell>
      ) : null}
      {showColumn('bookings') ? (
        <InfluencerCell label="Bookings">
          <p className="font-semibold">
            {influencer.summary.attributedBookingCount}
          </p>
          <p className="mt-1 text-xs text-muted">Attributed bookings</p>
        </InfluencerCell>
      ) : null}
      {showColumn('commission') ? (
        <InfluencerCell label="Commission">
          <p className="font-semibold">
            {formatPaise(influencer.summary.confirmedCommissionPaise)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Pending {formatPaise(influencer.summary.pendingCommissionPaise)}
          </p>
        </InfluencerCell>
      ) : null}
      {showColumn('updatedAt') ? (
        <InfluencerCell label="Updated">
          <p className="font-semibold">{formatDateSafe(influencer.updatedAt)}</p>
          <p className="mt-1 text-xs text-muted">
            Approved {formatDateSafe(influencer.approvedAt)}
          </p>
        </InfluencerCell>
      ) : null}
    </>
  )

  const renderRowActions = (influencer: AdminInfluencer) => {
    const hasAction = (action: InfluencerActionKind) =>
      influencer.availableActions.includes(action)

    return (
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {canReviewInfluencers && hasAction('APPROVE') ? (
          <Button
            disabled={actionMutation.isPending}
            size="sm"
            type="button"
            variant="secondary"
            onClick={(event) => openInfluencerAction('APPROVE', influencer, event)}
          >
            <CheckCircle2 className="mr-2 size-4" />
            Approve
          </Button>
        ) : null}
        {canReviewInfluencers && hasAction('REJECT') ? (
          <Button
            disabled={actionMutation.isPending}
            size="sm"
            type="button"
            variant="danger"
            onClick={(event) => openInfluencerAction('REJECT', influencer, event)}
          >
            <XCircle className="mr-2 size-4" />
            Reject
          </Button>
        ) : null}
        {canReviewInfluencers && hasAction('SUSPEND') ? (
          <Button
            disabled={actionMutation.isPending}
            size="sm"
            type="button"
            variant="danger"
            onClick={(event) =>
              openInfluencerAction('SUSPEND', influencer, event)
            }
          >
            <PauseCircle className="mr-2 size-4" />
            Suspend
          </Button>
        ) : null}
        {canReviewInfluencers && hasAction('REACTIVATE') ? (
          <Button
            disabled={actionMutation.isPending}
            size="sm"
            type="button"
            variant="secondary"
            onClick={(event) =>
              openInfluencerAction('REACTIVATE', influencer, event)
            }
          >
            <RotateCcw className="mr-2 size-4" />
            Reactivate
          </Button>
        ) : null}
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation()
            viewDetails(influencer)
          }}
        >
          <ArrowUpRight className="mr-2 size-4" />
          Open
        </Button>
      </div>
    )
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        description="Review creator applications, monitor approved creators, and track Phase 1 commission activity."
        layout="workspace"
        placement="topbar"
        title="Influencers"
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

        {actionMessage ? (
          <div className="rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
            {actionMessage}
          </div>
        ) : null}

        <section
          className={cn(
            'grid gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-stretch xl:overflow-hidden',
            filtersCollapsed && 'xl:grid-cols-[4.25rem_minmax(0,1fr)]',
          )}
        >
          <aside
            className={cn(
              'self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0',
              filtersCollapsed
                ? 'flex items-center justify-between gap-3 p-2.5 xl:flex-col xl:justify-start'
                : 'space-y-3 p-3 xl:overflow-y-auto',
            )}
          >
            {filtersCollapsed ? (
              <>
                <button
                  aria-label="Expand influencer filters"
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
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        Queue totals
                      </h2>
                      <p className="text-xs text-muted">
                        Counts match base filters.
                      </p>
                    </div>
                    <button
                      aria-label="Collapse influencer filters"
                      className="btn-icon"
                      title="Collapse filters"
                      type="button"
                      onClick={() => setFiltersCollapsed(true)}
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {queueItems.map((queueItem) => (
                      <button
                        className={cn(
                          'flex min-h-10 w-full items-center justify-between rounded-[0.75rem] border px-3 text-left text-sm transition',
                          queue === queueItem.key
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-surface-muted/50 text-foreground hover:border-primary/35',
                        )}
                        key={queueItem.key}
                        type="button"
                        onClick={() => applyQueue(queueItem.key)}
                      >
                        <span className="font-medium">{queueItem.label}</span>
                        <span className="text-xs font-semibold">
                          {queueItem.count ?? '...'}
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
                        onClick={clearInfluencerFilters}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-3">
                    <MultiSelectFilter
                      label="Creator status"
                      options={statusOptions}
                      placeholder="All statuses"
                      values={selectedStatuses}
                      onChange={(values) => {
                        clearSeededInfluencerParams()
                        setSelectedStatuses(values as InfluencerStatus[])
                        setQueue('all')
                        resetToFirstPage()
                      }}
                    />
                    <LookupMultiSelect
                      fetchOptions={searchCategoryLookupOptions}
                      label="Preferred category"
                      placeholder="Search category"
                      queryKey={['lookup', 'categories', 'influencers']}
                      selectedOptions={selectedCategories}
                      onChange={(options) => {
                        clearSeededInfluencerParams()
                        setSelectedCategories(options)
                        resetToFirstPage()
                      }}
                    />
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        City
                      </span>
                      <Input
                        className="min-h-10"
                        placeholder="Chennai"
                        value={city}
                        onChange={(event) => {
                          clearSeededInfluencerParams()
                          setCity(event.target.value)
                          resetToFirstPage()
                        }}
                      />
                    </label>
                    <div className="rounded-[0.875rem] border border-border bg-surface-muted/45 p-3">
                      <div className="flex items-start gap-2">
                        <Settings2 className="mt-0.5 size-4 shrink-0 text-muted" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                            Commission policy
                          </p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {commissionSettingQuery.isLoading
                              ? 'Loading'
                              : formatCommissionValue(commissionSetting?.value)}
                          </p>
                          {commissionSetting ? (
                            <Link
                              className="mt-2 inline-flex text-xs font-semibold text-primary"
                              to={`${routePaths.settings}/settings/${encodeURIComponent(
                                commissionSetting.settingKey,
                              )}`}
                            >
                              Open setting
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </aside>

          <main className="flex min-w-0 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Creator operations
                </h2>
                <p className="text-sm text-muted">
                  {pagination
                    ? `${pagination.totalItems} creators matching current filters`
                    : 'Search, filter, and review creator applications.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  ariaLabel="Search influencers"
                  className="w-full sm:w-72 lg:w-80"
                  placeholder="Search name, handle, mobile"
                  value={search}
                  onChange={(nextSearch) => {
                    clearSeededInfluencerParams()
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
                      {influencerDataColumns.map((column) => {
                        const isChecked = visibleColumns.includes(column.id)
                        const isRequiredLastColumn =
                          isChecked && visibleColumns.length === 1

                        return (
                          <label
                            className={cn(
                              'flex min-h-9 cursor-pointer items-center gap-2 rounded-[0.65rem] px-2 text-sm text-foreground hover:bg-surface-muted',
                              isRequiredLastColumn &&
                                'cursor-not-allowed opacity-60',
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
                  onClick={() => void influencersQuery.refetch()}
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

            {influencersQuery.isError ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ErrorState
                  title="Influencers unavailable"
                  description="We could not load creator applications."
                  onRetry={() => void influencersQuery.refetch()}
                />
              </div>
            ) : isInitialLoading ? (
              <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <InfluencerRowsSkeleton />
              </div>
            ) : influencers.length === 0 ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <EmptyState
                  title="No creators found"
                  description="No influencer applications match the current filters."
                />
              </div>
            ) : (
              <div className="flex flex-col xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--influencer-grid-min-width)]"
                    style={influencerGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden gap-3 grid-cols-[var(--influencer-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
                      <div className="flex min-w-0 items-center">
                        <ListSelectionCheckbox
                          checked={influencerSelection.allVisibleSelected}
                          indeterminate={influencerSelection.someVisibleSelected}
                          label="Select visible influencers"
                          onChange={influencerSelection.setVisibleSelected}
                        />
                      </div>
                      {influencerDataColumns
                        .filter((column) => visibleColumns.includes(column.id))
                        .map((column) => (
                          <div
                            className="relative flex min-w-0 items-center pr-3"
                            key={column.id}
                          >
                            <span className="truncate">{column.label}</span>
                            <button
                              aria-label={`Resize ${column.label} column`}
                              className="absolute right-0 top-1/2 h-5 w-2 -translate-y-1/2 cursor-col-resize rounded-full border-l border-border transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title="Drag to resize"
                              type="button"
                              onDoubleClick={() => resetColumnWidth(column.id)}
                              onPointerDown={(event) =>
                                startColumnResize(column.id, event)
                              }
                            />
                          </div>
                        ))}
                      <div className="relative flex min-w-0 items-center justify-end pr-3">
                        <span>Actions</span>
                        <button
                          aria-label="Resize actions column"
                          className="absolute right-0 top-1/2 h-5 w-2 -translate-y-1/2 cursor-col-resize rounded-full border-l border-border transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title="Drag to resize"
                          type="button"
                          onDoubleClick={() =>
                            resetColumnWidth(INFLUENCER_ACTION_COLUMN_ID)
                          }
                          onPointerDown={(event) =>
                            startColumnResize(INFLUENCER_ACTION_COLUMN_ID, event)
                          }
                        />
                      </div>
                    </div>
                    <ListSelectionToolbar
                      allVisibleSelected={influencerSelection.allVisibleSelected}
                      selectedCount={influencerSelection.selectedCount}
                      visibleCount={influencerSelection.visibleCount}
                      onClear={influencerSelection.clearSelection}
                      onSelectVisible={() => influencerSelection.setVisibleSelected(true)}
                    />

                    <div className="divide-y divide-border">
                      {influencers.map((influencer) => (
                        <div
                          aria-label={`Open influencer ${influencer.influencerProfileId}`}
                          aria-selected={influencerSelection.isSelected(
                            influencer.influencerProfileId,
                          )}
                          className={cn(
                            'grid w-full cursor-pointer gap-3 px-3 py-3 text-left transition hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--influencer-grid-template)]',
                            influencerSelection.isSelected(
                              influencer.influencerProfileId,
                            ) && 'bg-primary/5 hover:bg-primary/10',
                          )}
                          key={influencer.influencerProfileId}
                          role="button"
                          style={influencerGridStyle}
                          tabIndex={0}
                          onClick={() => viewDetails(influencer)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return

                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              viewDetails(influencer)
                            }
                          }}
                        >
                          <div className="flex min-w-0 items-start xl:items-center">
                            <ListSelectionCheckbox
                              checked={influencerSelection.isSelected(
                                influencer.influencerProfileId,
                              )}
                              label={`Select influencer ${influencer.influencerProfileId}`}
                              onChange={(selected) =>
                                influencerSelection.setItemSelected(
                                  influencer.influencerProfileId,
                                  selected,
                                )
                              }
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:contents">
                            {renderInfluencerCells(influencer)}
                          </div>
                          <div className="flex min-w-0 items-center justify-start xl:justify-end">
                            {renderRowActions(influencer)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {pagination ? (
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3 text-sm text-muted">
                    <div className="flex items-center gap-2">
                      <span>
                        Showing {(pagination.page - 1) * pagination.limit + 1}-
                        {Math.min(
                          pagination.page * pagination.limit,
                          pagination.totalItems,
                        )}{' '}
                        of {pagination.totalItems}
                      </span>
                      <label className="flex items-center gap-2">
                        <span>Rows</span>
                        <select
                          className="h-9 rounded-[0.65rem] border border-border bg-surface px-2 text-foreground outline-none"
                          value={limit}
                          onChange={(event) => {
                            setLimit(Number(event.target.value))
                            setPage(1)
                          }}
                        >
                          {[10, 20, 50, 100].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        aria-label="Previous page"
                        className="btn-icon"
                        disabled={!pagination.hasPreviousPage}
                        type="button"
                        onClick={() => setPage((currentPage) => currentPage - 1)}
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <span className="font-medium text-foreground">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <button
                        aria-label="Next page"
                        className="btn-icon"
                        disabled={!pagination.hasNextPage}
                        type="button"
                        onClick={() => setPage((currentPage) => currentPage + 1)}
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </main>
        </section>
      </div>

      <InfluencerActionModal
        action={selectedAction}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        key={
          selectedAction
            ? `${selectedAction.kind}-${selectedAction.influencer.influencerProfileId}`
            : 'influencer-action-empty'
        }
        onClose={() => {
          if (!actionMutation.isPending) {
            setSelectedAction(null)
            setActionError(null)
          }
        }}
        onSubmit={(values) => {
          if (selectedAction) {
            void actionMutation.mutateAsync({
              action: selectedAction,
              values,
            })
          }
        }}
      />
    </PageContainer>
  )
}
