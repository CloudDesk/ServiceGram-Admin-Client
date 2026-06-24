import { BadgeCheck, Search, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { DynamicTable, TableSkeleton, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContainer } from '../../../components/layout/PageContainer'
import { ListFilterBar } from '../../../components/layout/ListFilterBar'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { routePaths } from '../../../config/routes'
import { settingsService } from '../../settings/services/settings.service'
import { formatMoney } from '../../../utils/formatMoney'
import { influencerService } from '../services/influencer.service'
import type {
  AdminInfluencer,
  AdminInfluencersQueryParams,
  InfluencerStatus,
} from '../types/influencer.types'

const DEFAULT_PAGE_SIZE = 10
const INFLUENCER_STATUSES: InfluencerStatus[] = [
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'NOT_APPLIED',
]

function statusTone(status: InfluencerStatus) {
  if (status === 'APPROVED') return 'success'
  if (status === 'PENDING_REVIEW') return 'warning'
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'danger'
  return 'neutral'
}

function formatPaise(amountPaise: number) {
  return formatMoney(amountPaise / 100)
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

  const basisPoints = typeof config.commissionValue === 'number'
    ? config.commissionValue
    : 0

  return `${basisPoints / 100}% per attributed booking`
}

const influencerColumns: DynamicTableColumn<AdminInfluencer>[] = [
  {
    key: 'displayName',
    label: 'Creator',
    minWidth: 280,
    renderCell: (row) => (
      <div>
        <p className="font-semibold text-foreground">{row.displayName}</p>
        <p className="text-xs text-muted">
          {row.publicInfluencerId}
          {row.socialHandle ? ` · ${row.socialHandle}` : ''}
        </p>
      </div>
    ),
  },
  {
    key: 'customer',
    label: 'Customer',
    minWidth: 240,
    getValue: (row) => row.customer.fullName ?? row.customer.mobileNumber,
    renderCell: (row) => (
      <div>
        <p className="font-medium">
          {row.customer.fullName ?? 'Unnamed customer'}
        </p>
        <p className="text-xs text-muted">
          {row.customer.mobileNumber ?? row.customer.email ?? row.customer.customerId}
        </p>
      </div>
    ),
  },
  {
    key: 'city',
    label: 'City',
    minWidth: 160,
    getValue: (row) => row.customer.zone?.zoneName ?? row.customer.city ?? 'Not set',
  },
  {
    key: 'status',
    label: 'Status',
    format: 'status',
    statusTone: (value) => statusTone(value as InfluencerStatus),
    minWidth: 160,
  },
  {
    key: 'reels',
    label: 'Reels',
    align: 'right',
    minWidth: 110,
    getValue: (row) => row.summary.reelCount,
  },
  {
    key: 'bookings',
    label: 'Bookings',
    align: 'right',
    minWidth: 120,
    getValue: (row) => row.summary.attributedBookingCount,
  },
  {
    key: 'confirmedCommission',
    label: 'Confirmed',
    align: 'right',
    minWidth: 150,
    getValue: (row) => row.summary.confirmedCommissionPaise,
    renderCell: (row) => formatPaise(row.summary.confirmedCommissionPaise),
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

function SummaryTile({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
        {value}
      </p>
    </div>
  )
}

export function InfluencersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState<'' | InfluencerStatus>('PENDING_REVIEW')

  const query = useMemo<AdminInfluencersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryId.trim() || undefined,
      status: status || undefined,
    }),
    [categoryId, city, limit, page, search, status],
  )

  const influencersQuery = useQuery({
    queryKey: ['influencers', query],
    queryFn: () => influencerService.getInfluencers(query),
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
  const summary = influencersQuery.data?.summary ?? {}
  const isLoading = influencersQuery.isLoading || influencersQuery.isFetching
  const commissionSetting = commissionSettingQuery.data?.data.find(
    (setting) => setting.settingKey === 'influencer.commission.phase1',
  )
  const resetToFirstPage = () => setPage(1)

  return (
    <PageContainer>
      <PageContextHeader
        description="Review creator applications, monitor approved creators, and keep Phase 1 commission policy visible for operations."
        placement="topbar"
        title="Influencers"
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <SummaryTile label="Pending Review" value={summary.PENDING_REVIEW ?? 0} />
        <SummaryTile label="Approved Creators" value={summary.APPROVED ?? 0} />
        <SummaryTile label="Suspended" value={summary.SUSPENDED ?? 0} />
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">
                Commission policy
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {commissionSettingQuery.isLoading
                  ? 'Loading'
                  : formatCommissionValue(commissionSetting?.value)}
              </p>
              <p className="mt-1 text-xs text-muted">
                influencer.commission.phase1
              </p>
            </div>
            <Settings2 className="size-5 text-muted" />
          </div>
          {commissionSetting ? (
            <Link
              className="mt-4 inline-flex"
              to={`${routePaths.settings}/settings/${encodeURIComponent(
                commissionSetting.settingKey,
              )}`}
            >
              <Button size="sm" variant="secondary">
                Open setting
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="list-workspace">
        <ListFilterBar
          primaryFilters={
            <>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input className="min-h-11 pl-9" placeholder="Name, handle, mobile" value={search} onChange={(event) => { setSearch(event.target.value); resetToFirstPage() }} />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Status</span>
                <select className="form-input min-h-11" value={status} onChange={(event) => { setStatus(event.target.value as '' | InfluencerStatus); resetToFirstPage() }}>
                  <option value="">All</option>
                  {INFLUENCER_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">City</span>
                <Input className="min-h-11" placeholder="Chennai" value={city} onChange={(event) => { setCity(event.target.value); resetToFirstPage() }} />
              </label>
            </>
          }
          secondaryFilters={
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">Category ID</span>
              <Input className="min-h-11" placeholder="UUID" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); resetToFirstPage() }} />
            </label>
          }
        />

        <section className="list-results-panel">
        {influencersQuery.isError ? (
          <ErrorState
            title="Influencers unavailable"
            description="We could not load creator applications."
            onRetry={() => void influencersQuery.refetch()}
          />
        ) : isLoading ? (
          <TableSkeleton
            columns={influencerColumns as DynamicTableColumn<unknown>[]}
            hasFooter={Boolean(pagination)}
            rowCount={8}
          />
        ) : influencers.length === 0 ? (
          <EmptyState
            title="No creators found"
            description="No influencer applications match the current filters."
          />
        ) : (
          <DynamicTable
            columns={influencerColumns}
            data={influencers}
            getRowId={(row) => row.influencerProfileId}
            onRowClick={(row) =>
              navigate(`${routePaths.influencers}/${row.influencerProfileId}`)
            }
            pagination={
              pagination
                ? {
                    page: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    onPageChange: setPage,
                    onPageSizeChange: (next) => {
                      setLimit(next)
                      setPage(1)
                    },
                    rowsPerPageOptions: [10, 20, 50, 100],
                  }
                : undefined
            }
            title="Creator applications"
          />
        )}
        </section>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-success/10 text-success">
            <BadgeCheck className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Approved creators keep their customer account
            </p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
              Approval unlocks Creator Hub, upload tools, and approved creator
              badges in the customer app. Reels still pass through the existing
              admin reel moderation queue before appearing in the feed.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
