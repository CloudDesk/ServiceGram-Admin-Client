import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { ListFilterBar } from '../../../components/layout/ListFilterBar'
import {
  DynamicTable,
  TableSkeleton,
  type DynamicTableColumn,
} from '../../../components/ui/Table'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { reelService } from '../services/reel.service'
import type {
  AdminReel,
  AdminReelsQueryParams,
  ReelContentType,
  ReelModerationStatus,
  ReelUploadStatus,
} from '../types/reel.types'

type ReelViewMode = 'pending' | 'live'
const DEFAULT_PAGE_SIZE = 10

const reelColumns: DynamicTableColumn<AdminReel>[] = [
  {
    key: 'publicReelId',
    label: 'Reel',
    minWidth: 280,
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.publicReelId}</p>
        <p className="line-clamp-1 text-xs text-muted">
          {row.caption ?? 'No caption'}
        </p>
      </div>
    ),
  },
  {
    key: 'vendor',
    label: 'Vendor',
    minWidth: 240,
    getValue: (row) => row.vendor.shopName,
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.vendor.shopName}</p>
        <p className="text-xs text-muted">
          {row.vendor.city}
          {row.vendor.zone ? ` · ${row.vendor.zone.zoneName}` : ''}
        </p>
      </div>
    ),
  },
  {
    key: 'category',
    label: 'Category',
    minWidth: 180,
    getValue: (row) => row.category?.name ?? 'Unassigned',
  },
  {
    key: 'contentType',
    label: 'Content Type',
    format: 'status',
    minWidth: 160,
  },
  {
    key: 'uploadStatus',
    label: 'Upload',
    format: 'status',
    statusTone: (value) => {
      if (value === 'READY') {
        return 'success'
      }

      if (value === 'FAILED') {
        return 'danger'
      }

      return 'warning'
    },
    minWidth: 150,
    getValue: (row) => row.media.uploadStatus,
  },
  {
    key: 'moderationStatus',
    label: 'Moderation',
    format: 'status',
    statusTone: (value) => {
      if (value === 'APPROVED') {
        return 'success'
      }

      if (value === 'REJECTED' || value === 'REMOVED') {
        return 'danger'
      }

      if (value === 'PENDING_REVIEW' || value === 'EDIT_REQUESTED') {
        return 'warning'
      }

      return 'neutral'
    },
    minWidth: 170,
    getValue: (row) => row.moderation.status,
  },
  {
    key: 'customerVisibility',
    label: 'Visibility',
    format: 'status',
    minWidth: 140,
    getValue: (row) => row.publish.customerVisibility,
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

export function ReelsPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ReelViewMode>('pending')
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [contentType, setContentType] = useState<'' | ReelContentType>('')
  const [uploadStatus, setUploadStatus] = useState<'' | ReelUploadStatus>('')
  const [moderationStatus, setModerationStatus] = useState<
    '' | ReelModerationStatus
  >('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)

  const query = useMemo<AdminReelsQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryId.trim() || undefined,
      zoneId: zoneId.trim() || undefined,
      vendorId: vendorId.trim() || undefined,
      contentType: contentType || undefined,
      uploadStatus: uploadStatus || undefined,
      moderationStatus: moderationStatus || undefined,
    }),
    [
      categoryId,
      city,
      contentType,
      limit,
      moderationStatus,
      page,
      search,
      uploadStatus,
      vendorId,
      zoneId,
    ],
  )

  const reelsQuery = useQuery({
    queryKey: ['reels', viewMode, query],
    queryFn: () =>
      viewMode === 'pending'
        ? reelService.getPendingReels(query)
        : reelService.getLiveReels(query),
  })

  const reels = reelsQuery.data?.data ?? []
  const pagination = reelsQuery.data?.pagination
  const summary = reelsQuery.data?.summary
  const isLoading = reelsQuery.isLoading || reelsQuery.isFetching
  const resetToFirstPage = () => setPage(1)

  return (
    <PageContainer>
      <PageContextHeader
        description={viewMode === 'pending' ? 'Reels waiting for moderation review.' : 'Published and active reel inventory.'}
        placement="topbar"
        title="Reels"
      />

      <div className="list-workspace">
        <ListFilterBar
          actionNode={
            <div className="inline-flex rounded-full border border-border bg-surface p-1">
              <button className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${viewMode === 'pending' ? 'bg-foreground text-primary-foreground' : 'text-muted hover:text-foreground'}`} type="button" onClick={() => { setViewMode('pending'); resetToFirstPage() }}>Pending Queue</button>
              <button className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${viewMode === 'live' ? 'bg-foreground text-primary-foreground' : 'text-muted hover:text-foreground'}`} type="button" onClick={() => { setViewMode('live'); resetToFirstPage() }}>Live Reels</button>
            </div>
          }
          primaryFilters={
            <>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input className="min-h-11 pl-9" placeholder="Search reels" value={search} onChange={(event) => { setSearch(event.target.value); resetToFirstPage() }} />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">City</span>
                <Input className="min-h-11" placeholder="Bengaluru" value={city} onChange={(event) => { setCity(event.target.value); resetToFirstPage() }} />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Content Type</span>
                <select className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none" value={contentType} onChange={(event) => { setContentType(event.target.value as '' | ReelContentType); resetToFirstPage() }}>
                  <option value="">All</option>
                  <option value="BEFORE_AFTER">BEFORE_AFTER</option>
                  <option value="SERVICE_DEMO">SERVICE_DEMO</option>
                  <option value="NEW_OFFER">NEW_OFFER</option>
                  <option value="INTRODUCTION">INTRODUCTION</option>
                </select>
              </label>
            </>
          }
          secondaryFilters={
            <>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Category ID</span>
                <Input className="min-h-11" placeholder="UUID" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); resetToFirstPage() }} />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Zone ID</span>
                <Input className="min-h-11" placeholder="UUID" value={zoneId} onChange={(event) => { setZoneId(event.target.value); resetToFirstPage() }} />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Vendor ID</span>
                <Input className="min-h-11" placeholder="UUID" value={vendorId} onChange={(event) => { setVendorId(event.target.value); resetToFirstPage() }} />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Upload Status</span>
                <select className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none" value={uploadStatus} onChange={(event) => { setUploadStatus(event.target.value as '' | ReelUploadStatus); resetToFirstPage() }}>
                  <option value="">All</option>
                  <option value="UPLOAD_REQUESTED">UPLOAD_REQUESTED</option>
                  <option value="UPLOADING">UPLOADING</option>
                  <option value="PROCESSING">PROCESSING</option>
                  <option value="READY">READY</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Moderation Status</span>
                <select className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none" value={moderationStatus} onChange={(event) => { setModerationStatus(event.target.value as '' | ReelModerationStatus); resetToFirstPage() }}>
                  <option value="">All</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="EDIT_REQUESTED">EDIT_REQUESTED</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="REMOVED">REMOVED</option>
                </select>
              </label>
            </>
          }
        />

        <section className="list-results-panel">
          <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">
            {viewMode === 'pending' ? 'Pending Queue' : 'Live Reels'}
          </h2>
          <p className="text-sm text-muted">
            {summary
              ? `${summary.total} total · ${summary.needsAttention} need attention · ${summary.live} live`
              : viewMode === 'pending'
                ? 'Reels waiting for moderation review.'
                : 'Published and active reel inventory.'}
          </p>
        </div>

        {reelsQuery.isError ? (
          <ErrorState
            description="We could not load reel data. Please retry."
            title="Reel data unavailable"
            onRetry={() => void reelsQuery.refetch()}
          />
        ) : isLoading ? (
          <TableSkeleton
            columns={reelColumns}
            hasFooter={Boolean(pagination)}
            rowCount={8}
          />
        ) : reels.length === 0 ? (
          <EmptyState
            description={
              viewMode === 'pending'
                ? 'No reels are currently waiting for review.'
                : 'No live reels were found for the selected filters.'
            }
            title={viewMode === 'pending' ? 'Queue is empty' : 'No live reels'}
          />
        ) : (
          <DynamicTable
            bodyMaxHeight={560}
            columns={reelColumns}
            data={reels}
            description="No reel records are available."
            pagination={
              pagination
                ? {
                    page: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    onPageChange: (nextPage) => {
                      setPage(nextPage)
                    },
                    onPageSizeChange: (nextLimit) => {
                      setLimit(nextLimit)
                      setPage(1)
                    },
                    rowsPerPageOptions: [10, 20, 50, 100],
                  }
                : {
                    page: 1,
                    pageSize: reels.length || 1,
                    total: reels.length,
                  }
            }
            title={viewMode === 'pending' ? 'Pending reels' : 'Live reels'}
            getRowId={(row) => row.reelId}
            onRowClick={(row) => navigate(`${routePaths.reels}/${row.reelId}`)}
          />
        )}

        </section>
      </div>
    </PageContainer>
  )
}
