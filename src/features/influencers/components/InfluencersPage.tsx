import {
  CheckCircle2,
  PauseCircle,
  RefreshCcw,
  RotateCcw,
  Settings2,
  UserRound,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type { DataListColumn, DataListQueueTab } from '../../../components/ui/DataList'
import { Input, filterInputClass } from '../../../components/ui/Input'
import { LookupMultiSelect } from '../../../components/ui/LookupMultiSelect'
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter'
import { OverflowText } from '../../../components/ui/OverflowText'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { RowActionMenu, type RowActionMenuItem } from '../../../components/ui/RowActionMenu'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { LookupOption } from '../../../types/lookup.types'
import { cn } from '../../../utils/cn'
import { downloadCsv, timestampedFilename } from '../../../utils/exportCsv'
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
  InfluencerSocialProfile,
  InfluencersSummary,
  InfluencerStatus,
} from '../types/influencer.types'

type InfluencerQueueKey =
  | 'pending'
  | 'approved'
  | 'suspended'
  | 'rejected'
  | 'all'

const DEFAULT_PAGE_SIZE = 25
const INFLUENCER_LIST_STORAGE_KEY = 'servicegram.influencers.list.v1'

const influencerStatuses: InfluencerStatus[] = [
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'NOT_APPLIED',
]

const influencerActionPriority: InfluencerActionKind[] = [
  'APPROVE',
  'REACTIVATE',
  'REJECT',
  'SUSPEND',
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
  if (selectedStatuses.length !== 1) return 'all'

  const [status] = selectedStatuses

  if (status === 'PENDING_REVIEW') return 'pending'
  if (status === 'APPROVED') return 'approved'
  if (status === 'SUSPENDED') return 'suspended'
  if (status === 'REJECTED') return 'rejected'

  return 'all'
}

function statusTone(status: InfluencerStatus | string) {
  if (status === 'APPROVED') return 'success' as const
  if (status === 'PENDING_REVIEW') return 'warning' as const
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'danger' as const
  return 'neutral' as const
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

function socialPlatformLabel(platform: InfluencerSocialProfile['platform']) {
  if (platform === 'INSTAGRAM') return 'Instagram'
  if (platform === 'YOUTUBE') return 'YouTube'
  if (platform === 'FACEBOOK') return 'Facebook'
  return 'X'
}

function socialProfilesSummary(
  profiles: InfluencerSocialProfile[] | undefined,
  fallbackHandle?: string | null,
) {
  if (profiles?.length) {
    return profiles.map((profile) => socialPlatformLabel(profile.platform)).join(' · ')
  }

  return fallbackHandle ?? ''
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

function buildInfluencerQueueTabs(summary?: InfluencersSummary): DataListQueueTab[] {
  return [
    { key: 'pending', label: 'Pending review', count: summary?.PENDING_REVIEW, tone: 'warning' },
    { key: 'approved', label: 'Approved', count: summary?.APPROVED },
    { key: 'suspended', label: 'Suspended', count: summary?.SUSPENDED, tone: 'danger' },
    { key: 'rejected', label: 'Rejected', count: summary?.REJECTED, tone: 'danger' },
    { key: 'all', label: 'All creators', count: summary?.total },
  ]
}

function isDangerInfluencerAction(kind: InfluencerActionKind) {
  return kind === 'REJECT' || kind === 'SUSPEND'
}

function influencerActionLabel(kind: InfluencerActionKind) {
  return {
    APPROVE: 'Approve',
    REACTIVATE: 'Reactivate',
    REJECT: 'Reject',
    SUSPEND: 'Suspend',
  }[kind]
}

function influencerActionIcon(kind: InfluencerActionKind) {
  if (kind === 'APPROVE') return <CheckCircle2 className="size-3.5" />
  if (kind === 'REACTIVATE') return <RotateCcw className="size-3.5" />
  if (kind === 'SUSPEND') return <PauseCircle className="size-3.5" />
  return <XCircle className="size-3.5" />
}

function getPrimaryInfluencerAction({
  canReviewInfluencers,
  influencer,
}: {
  canReviewInfluencers: boolean
  influencer: AdminInfluencer
}) {
  if (!canReviewInfluencers) return null

  const recommendedAction =
    influencer.nextRecommendedAction &&
    influencerActionPriority.includes(
      influencer.nextRecommendedAction as InfluencerActionKind,
    )
      ? (influencer.nextRecommendedAction as InfluencerActionKind)
      : null

  if (
    recommendedAction &&
    influencer.availableActions.includes(recommendedAction)
  ) {
    return recommendedAction
  }

  return (
    influencerActionPriority.find((kind) =>
      influencer.availableActions.includes(kind),
    ) ?? null
  )
}

function InfluencerRowActions({
  canReadCustomers,
  canReviewInfluencers,
  influencer,
  isSubmitting,
  onOpenAction,
  onOpenCustomer,
}: {
  canReadCustomers: boolean
  canReviewInfluencers: boolean
  influencer: AdminInfluencer
  isSubmitting: boolean
  onOpenAction: (kind: InfluencerActionKind) => void
  onOpenCustomer: () => void
}) {
  const primaryAction = getPrimaryInfluencerAction({ canReviewInfluencers, influencer })
  const secondaryActions = canReviewInfluencers
    ? influencerActionPriority.filter(
        (kind) => kind !== primaryAction && influencer.availableActions.includes(kind),
      )
    : []

  const menuItems: RowActionMenuItem[] = []

  if (canReadCustomers) {
    menuItems.push({
      key: 'open-customer',
      label: 'Open customer',
      icon: <UserRound className="size-3.5" />,
      onClick: onOpenCustomer,
    })
  }

  secondaryActions.forEach((kind) => {
    menuItems.push({
      key: kind,
      label: influencerActionLabel(kind),
      icon: influencerActionIcon(kind),
      tone: isDangerInfluencerAction(kind) ? 'danger' : 'default',
      onClick: () => onOpenAction(kind),
    })
  })

  return (
    <div className="flex items-center justify-end gap-1">
      {primaryAction ? (
        <Button
          className="h-6.5 min-h-0 whitespace-nowrap px-2 text-xs font-medium"
          disabled={isSubmitting}
          size="xs"
          type="button"
          variant={isDangerInfluencerAction(primaryAction) ? 'danger' : 'primary'}
          onClick={() => onOpenAction(primaryAction)}
        >
          {influencerActionLabel(primaryAction)}
        </Button>
      ) : null}

      <RowActionMenu
        ariaLabel={`More actions for ${influencer.displayName}`}
        items={menuItems}
      />
    </div>
  )
}

export function InfluencersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canReadCustomers = usePermission('customers:read')
  const canReviewInfluencers = usePermission('influencers:review')

  const seededStatuses = readEnumSearchValues(searchParams, 'status', influencerStatuses)
  const initialStatuses =
    seededStatuses.length > 0 ? seededStatuses : (['PENDING_REVIEW'] as InfluencerStatus[])

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
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedAction, setSelectedAction] = useState<InfluencerActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const categoryIds = useMemo(
    () => selectedCategories.map((category) => category.value),
    [selectedCategories],
  )
  const statusOptions = useMemo<LookupOption[]>(
    () =>
      influencerStatuses.map((status) => ({
        label: humanizeCode(status),
        value: status,
      })),
    [],
  )

  const clearSeededInfluencerParams = () => {
    const seededKeys = ['categoryId', 'categoryLabel', 'city', 'queue', 'search', 'status'] as const

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

  const influencers = useMemo(() => influencersQuery.data?.data ?? [], [influencersQuery.data])
  const pagination = influencersQuery.data?.pagination
  const stableSummary = queueCountsQuery.data?.summary
  const queueSummary = stableSummary ?? influencersQuery.data?.summary
  const queueTabs = buildInfluencerQueueTabs(queueSummary)
  const commissionSetting = commissionSettingQuery.data?.data.find(
    (setting) => setting.settingKey === 'influencer.commission.phase1',
  )
  const commissionPolicyLabel = commissionSettingQuery.isLoading
    ? 'Loading'
    : formatCommissionValue(commissionSetting?.value)

  const isDefaultStatusFilter =
    queue === 'pending' && selectedStatuses.length === 1 && selectedStatuses[0] === 'PENDING_REVIEW'
  const appliedFilterCount =
    (city.trim() ? 1 : 0) +
    (categoryIds.length > 0 ? 1 : 0) +
    (queue === 'all' && selectedStatuses.length > 0 ? 1 : 0)

  const applyQueue = (nextQueue: InfluencerQueueKey) => {
    clearSeededInfluencerParams()
    setQueue(nextQueue)

    if (nextQueue === 'pending') setSelectedStatuses(['PENDING_REVIEW'])
    if (nextQueue === 'approved') setSelectedStatuses(['APPROVED'])
    if (nextQueue === 'suspended') setSelectedStatuses(['SUSPENDED'])
    if (nextQueue === 'rejected') setSelectedStatuses(['REJECTED'])
    if (nextQueue === 'all') setSelectedStatuses([])

    setPage(1)
  }

  const clearInfluencerFilters = () => {
    clearSeededInfluencerParams()
    setCity('')
    setSelectedCategories([])
    applyQueue('pending')
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
        return influencerService.approveInfluencer(action.influencer.influencerProfileId, {
          reason: values.reason,
        })
      }

      if ((action.kind === 'REJECT' || action.kind === 'SUSPEND') && !values.reason) {
        throw new Error('Reason is required for this action.')
      }

      if (action.kind === 'REJECT') {
        return influencerService.rejectInfluencer(action.influencer.influencerProfileId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'SUSPEND') {
        return influencerService.suspendInfluencer(action.influencer.influencerProfileId, {
          reason: values.reason,
        })
      }

      return influencerService.reactivateInfluencer(action.influencer.influencerProfileId, {
        reason: values.reason,
      })
    },
    onMutate: () => setActionError(null),
    onSuccess: (_response, variables) => {
      setSelectedAction(null)
      void queryClient.invalidateQueries({ queryKey: ['influencers'] })
      void queryClient.invalidateQueries({
        queryKey: ['influencer-detail', variables.action.influencer.influencerProfileId],
      })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Influencer action could not be completed.',
      )
    },
  })

  const openInfluencerAction = (kind: InfluencerActionKind, influencer: AdminInfluencer) => {
    if (!canReviewInfluencers || !influencer.availableActions.includes(kind)) return

    setActionError(null)
    setSelectedAction({ kind, influencer })
  }

  const columns: DataListColumn<AdminInfluencer>[] = useMemo(
    () => [
      {
        id: 'creator',
        label: 'Creator',
        defaultWidth: 260,
        minWidth: 210,
        priority: 1,
        grow: true,
        locked: true,
        render: (influencer) => (
          <div className="min-w-0">
            <OverflowText as="p" className="font-semibold" title={influencer.displayName}>
              {influencer.displayName}
            </OverflowText>
            <OverflowText
              as="p"
              className="mt-0.5 text-xs text-muted"
              title={`${influencer.publicInfluencerId}${
                socialProfilesSummary(influencer.socialProfiles, influencer.socialHandle)
                  ? ` / ${socialProfilesSummary(influencer.socialProfiles, influencer.socialHandle)}`
                  : ''
              }`}
            >
              {influencer.publicInfluencerId}
              {socialProfilesSummary(influencer.socialProfiles, influencer.socialHandle)
                ? ` · ${socialProfilesSummary(influencer.socialProfiles, influencer.socialHandle)}`
                : ''}
            </OverflowText>
          </div>
        ),
      },
      {
        id: 'customer',
        label: 'Customer',
        defaultWidth: 220,
        minWidth: 180,
        priority: 1,
        render: (influencer) => (
          <div className="min-w-0">
            <OverflowText
              as="p"
              className="font-semibold"
              title={getInfluencerCustomerLabel(influencer)}
            >
              {getInfluencerCustomerLabel(influencer)}
            </OverflowText>
            <OverflowText
              as="p"
              className="mt-0.5 text-xs text-muted"
              title={
                influencer.customer.mobileNumber ??
                influencer.customer.email ??
                influencer.customer.customerId
              }
            >
              {influencer.customer.mobileNumber ??
                influencer.customer.email ??
                influencer.customer.customerId}
            </OverflowText>
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        defaultWidth: 160,
        minWidth: 140,
        priority: 1,
        render: (influencer) => (
          <div>
            <Badge tone={statusTone(influencer.status)}>{humanizeCode(influencer.status)}</Badge>
            {influencer.warnings.length > 0 ? (
              <p className="mt-1 text-xs text-warning">
                {influencer.warnings.length} warning{influencer.warnings.length === 1 ? '' : 's'}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'city',
        label: 'City',
        defaultWidth: 160,
        minWidth: 130,
        priority: 3,
        render: (influencer) => (
          <div className="min-w-0">
            <OverflowText as="p" title={influencer.customer.city ?? 'Not set'}>
              {influencer.customer.city ?? 'Not set'}
            </OverflowText>
            <OverflowText
              as="p"
              className="mt-0.5 text-xs text-muted"
              title={influencer.customer.zone?.zoneName ?? 'No zone'}
            >
              {influencer.customer.zone?.zoneName ?? 'No zone'}
            </OverflowText>
          </div>
        ),
      },
      {
        id: 'activity',
        label: 'Reels',
        defaultWidth: 150,
        minWidth: 130,
        priority: 3,
        render: (influencer) => (
          <div>
            <p className="font-semibold">
              {influencer.summary.reelCount} reel{influencer.summary.reelCount === 1 ? '' : 's'}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {influencer.summary.liveReelCount} live · {influencer.summary.pendingReelCount} pending
            </p>
          </div>
        ),
      },
      {
        id: 'commission',
        label: 'Commission',
        defaultWidth: 170,
        minWidth: 150,
        priority: 2,
        render: (influencer) => (
          <div>
            <p className="font-semibold">
              {formatPaise(influencer.summary.confirmedCommissionPaise)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Pending {formatPaise(influencer.summary.pendingCommissionPaise)}
            </p>
          </div>
        ),
      },
      {
        id: 'bookings',
        label: 'Bookings',
        defaultWidth: 120,
        minWidth: 100,
        priority: 4,
        align: 'right',
        defaultHidden: true,
        render: (influencer) => (
          <span className="tabular-nums">{influencer.summary.attributedBookingCount}</span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        defaultWidth: 140,
        minWidth: 120,
        priority: 4,
        defaultHidden: true,
        render: (influencer) => (
          <span className="text-muted">{formatDateSafe(influencer.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const selectedInfluencers = useMemo(
    () => influencers.filter((influencer) => selectedIds.includes(influencer.influencerProfileId)),
    [influencers, selectedIds],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('influencers'), selectedInfluencers, [
      { header: 'Influencer profile ID', value: (row) => row.influencerProfileId },
      { header: 'Public influencer ID', value: (row) => row.publicInfluencerId },
      { header: 'Display name', value: (row) => row.displayName },
      { header: 'Customer', value: (row) => getInfluencerCustomerLabel(row) },
      { header: 'City', value: (row) => row.customer.city ?? '' },
      { header: 'Status', value: (row) => row.status },
      { header: 'Reels', value: (row) => row.summary.reelCount },
      { header: 'Live reels', value: (row) => row.summary.liveReelCount },
      { header: 'Attributed bookings', value: (row) => row.summary.attributedBookingCount },
      {
        header: 'Confirmed commission (paise)',
        value: (row) => row.summary.confirmedCommissionPaise,
      },
      { header: 'Pending commission (paise)', value: (row) => row.summary.pendingCommissionPaise },
      { header: 'Updated', value: (row) => row.updatedAt },
    ])
  }

  const isRefreshing = influencersQuery.isFetching && Boolean(influencersQuery.data)

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader layout="workspace" placement="topbar" title="Influencers" />

      <DataList
        activeQueue={queue}
        appliedFilterCount={appliedFilterCount}
        columns={columns}
        emptyHint={
          isDefaultStatusFilter
            ? 'No creator applications are waiting for review.'
            : 'Try a different search term or switch queue.'
        }
        emptyMessage="No creators match these filters"
        errorMessage="We could not load creator applications."
        filters={
          <>
            <MultiSelectFilter
              label="Status"
              options={statusOptions}
              placeholder="All statuses"
              values={selectedStatuses}
              onChange={(values) => {
                clearSeededInfluencerParams()
                setSelectedStatuses(values as InfluencerStatus[])
                setQueue('all')
                setPage(1)
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
                setPage(1)
              }}
            />
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted">City</span>
              <Input
                className={filterInputClass}
                placeholder="Chennai"
                value={city}
                onChange={(event) => {
                  clearSeededInfluencerParams()
                  setCity(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <div className="rounded-[0.65rem] border border-border bg-surface-muted/45 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Settings2 className="size-4 shrink-0 text-muted" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-normal text-muted">
                    Commission policy
                  </p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {commissionPolicyLabel}
                  </p>
                </div>
                {commissionSetting ? (
                  <Link
                    className="ml-auto shrink-0 text-xs font-semibold text-primary"
                    to={`${routePaths.settings}/settings/${encodeURIComponent(commissionSetting.settingKey)}`}
                  >
                    Open
                  </Link>
                ) : null}
              </div>
            </div>
          </>
        }
        getRowId={(influencer) => influencer.influencerProfileId}
        isError={influencersQuery.isError}
        isLoading={influencersQuery.isLoading}
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
        pageSizeOptions={[10, 25, 50, 100]}
        queueTabs={queueTabs}
        rowActions={(influencer) => (
          <InfluencerRowActions
            canReadCustomers={canReadCustomers}
            canReviewInfluencers={canReviewInfluencers}
            influencer={influencer}
            isSubmitting={actionMutation.isPending}
            onOpenAction={(kind) => openInfluencerAction(kind, influencer)}
            onOpenCustomer={() => viewCustomer(influencer)}
          />
        )}
        rowActionsWidth={128}
        rows={influencers}
        search={search}
        searchPlaceholder="Search creators, handles, mobile..."
        selection={{
          selectedIds,
          onSelectionChange: setSelectedIds,
          actions: (
            <Button size="sm" type="button" variant="ghost" onClick={exportSelected}>
              Export CSV
            </Button>
          ),
        }}
        storageKey={INFLUENCER_LIST_STORAGE_KEY}
        toolbarActions={
          <Button
            aria-label={isRefreshing ? 'Refreshing influencers' : 'Refresh influencers'}
            size="sm"
            title={isRefreshing ? 'Refreshing influencers' : 'Refresh influencers'}
            type="button"
            variant="secondary"
            onClick={() => void influencersQuery.refetch()}
          >
            <RefreshCcw
              className={cn('size-4', isRefreshing && 'animate-spin motion-reduce:animate-none')}
            />
          </Button>
        }
        onQueueChange={(key) => applyQueue(key as InfluencerQueueKey)}
        onResetFilters={clearInfluencerFilters}
        onRetry={() => void influencersQuery.refetch()}
        onRowClick={(influencer) => navigate(`${routePaths.influencers}/${influencer.influencerProfileId}`)}
        onSearchChange={(nextSearch) => {
          clearSeededInfluencerParams()
          setSearch(nextSearch)
          setPage(1)
        }}
      />

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
            void actionMutation.mutateAsync({ action: selectedAction, values })
          }
        }}
      />
    </PageContainer>
  )
}
