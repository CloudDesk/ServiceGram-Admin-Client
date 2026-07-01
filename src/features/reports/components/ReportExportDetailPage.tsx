import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileJson,
  RefreshCcw,
  TableProperties,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import {
  DetailPageHeader,
  DetailPageHeaderSkeleton,
} from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import {
  DynamicTable,
  TableSkeleton,
  type DynamicTableColumn,
} from '../../../components/ui/Table'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { reportService } from '../services/report.service'
import type {
  AdminReportType,
  ReportExport,
  ReportExportStatus,
  ReportRow,
  ReportSummary,
} from '../types/report.types'

const reportLabels: Record<AdminReportType, string> = {
  ORDER_LIFECYCLE: 'Order Lifecycle',
  VENDOR_PERFORMANCE: 'Vendor Performance',
  PAYMENTS: 'Payments',
  PAYOUTS: 'Payouts',
  REFUNDS: 'Refunds',
}

const reportSlugByType: Record<AdminReportType, string> = {
  ORDER_LIFECYCLE: 'order-lifecycle',
  VENDOR_PERFORMANCE: 'vendor-performance',
  PAYMENTS: 'payments',
  PAYOUTS: 'payouts',
  REFUNDS: 'refunds',
}

const exportSectionIds = {
  lifecycle: 'report-export-lifecycle',
  download: 'report-export-download',
  preview: 'report-export-preview',
  filters: 'report-export-filters',
} as const

type ExportSectionId = (typeof exportSectionIds)[keyof typeof exportSectionIds]

interface PreviewRowHandoff {
  key: string
  label: string
  path: string
}

function compactId(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value
}

function humanize(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
}

function fieldLabel(key: string) {
  return humanize(key)
    .split(' ')
    .map((part) => {
      const lowerPart = part.toLowerCase()

      if (['api', 'cod', 'gcs', 'id', 'iam', 'otp', 'sms', 'upi', 'url'].includes(lowerPart)) {
        return part.toUpperCase()
      }

      const firstChar = part.at(0)

      return firstChar ? firstChar.toUpperCase() + part.slice(1) : ''
    })
    .join(' ')
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

  try {
    return formatDate(value, true)
  } catch {
    return 'Not available'
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}

function isMoneyKey(key: string) {
  const normalized = key.toLowerCase()
  return normalized.endsWith('paise') || normalized.includes('amountpaise')
}

function isDateLikeValue(value: string) {
  return /\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value))
}

function statusTone(value: string): StatusTone {
  const normalized = value.toUpperCase()

  if (['SUCCESS', 'COMPLETED', 'DELIVERED', 'PAID', 'APPROVED'].includes(normalized)) {
    return 'success'
  }

  if (['FAILED', 'CANCELLED', 'REJECTED'].includes(normalized)) {
    return 'danger'
  }

  if (['PENDING', 'PROCESSING', 'QUEUED', 'REQUESTED', 'UNDER_REVIEW', 'HELD'].includes(normalized)) {
    return 'warning'
  }

  return 'info'
}

function exportStatusTone(status: ReportExportStatus): StatusTone {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PROCESSING' || status === 'QUEUED') return 'warning'
  return 'neutral'
}

function formatValue(key: string, value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted">Not available</span>
  }

  if (typeof value === 'number') {
    return isMoneyKey(key) ? formatMoney(value / 100) : formatNumber(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (typeof value === 'string') {
    if (isMoneyKey(key) && /^-?\d+(\.\d+)?$/.test(value)) {
      return formatMoney(Number(value) / 100)
    }

    if (key.toLowerCase().includes('status')) {
      return <Badge tone={statusTone(value)}>{humanizeCode(value)}</Badge>
    }

    if (isDateLikeValue(value)) {
      return formatDateSafe(value)
    }

    return value
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : <span className="text-muted">None</span>
  }

  return JSON.stringify(value)
}

function getReportColumnKeys(rows: ReportRow[]) {
  const preferredKeys = [
    'publicOrderId',
    'publicVendorId',
    'shopName',
    'publicPaymentId',
    'publicPayoutId',
    'vendorName',
    'status',
    'paymentStatus',
    'amountPaise',
    'totalAmountPaise',
    'grossOrderValuePaise',
    'netEarningsPaise',
    'city',
    'createdAt',
    'updatedAt',
  ]
  const discoveredKeys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))

  return [
    ...preferredKeys.filter((key) => discoveredKeys.includes(key)),
    ...discoveredKeys.filter((key) => !preferredKeys.includes(key)),
  ]
}

function buildPreviewColumns(rows: ReportRow[]): DynamicTableColumn<ReportRow>[] {
  return getReportColumnKeys(rows)
    .slice(0, 9)
    .map((key) => ({
      key,
      label: fieldLabel(key),
      minWidth: key.toLowerCase().includes('id') ? 220 : 160,
      align: isMoneyKey(key) ? 'right' : undefined,
      renderCell: (row) => <span className="line-clamp-2">{formatValue(key, row[key])}</span>,
    }))
}

function rowId(row: ReportRow, index: number, reportType: AdminReportType) {
  const candidate =
    row.publicOrderId ??
    row.orderId ??
    row.publicVendorId ??
    row.vendorId ??
    row.publicPaymentId ??
    row.paymentId ??
    row.publicPayoutId ??
    row.payoutId ??
    row.refundId

  return typeof candidate === 'string' ? candidate : `${reportType}-${index}`
}

function asSummaryRecord(summary: unknown): ReportSummary {
  return summary && typeof summary === 'object' && !Array.isArray(summary)
    ? (summary as ReportSummary)
    : {}
}

function getStringField(row: ReportRow, key: string) {
  const value = row[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function buildPreviewRowHandoffs(
  row: ReportRow,
  access: {
    canReadCustomers: boolean
    canReadOrders: boolean
    canReadPayments: boolean
    canReadPayouts: boolean
    canReadVendors: boolean
  },
): PreviewRowHandoff[] {
  const handoffs: PreviewRowHandoff[] = []
  const orderId = getStringField(row, 'orderId')
  const vendorId = getStringField(row, 'vendorId')
  const customerId = getStringField(row, 'customerId')
  const paymentId = getStringField(row, 'paymentId')
  const refundId = getStringField(row, 'refundId')
  const payoutId = getStringField(row, 'payoutId')

  if (orderId && access.canReadOrders) {
    handoffs.push({ key: 'order', label: 'Order', path: `${routePaths.orders}/${orderId}` })
  }

  if (vendorId && access.canReadVendors) {
    handoffs.push({ key: 'vendor', label: 'Vendor', path: `${routePaths.vendors}/${vendorId}` })
  }

  if (customerId && access.canReadCustomers) {
    handoffs.push({ key: 'customer', label: 'Customer', path: `${routePaths.customers}/${customerId}` })
  }

  if (paymentId && access.canReadPayments) {
    handoffs.push({ key: 'payment', label: 'Payment', path: `${routePaths.payments}/${paymentId}` })
  }

  if (refundId && access.canReadPayments) {
    handoffs.push({ key: 'refund', label: 'Refund', path: `${routePaths.refunds}/${refundId}` })
  }

  if (payoutId && access.canReadPayouts) {
    handoffs.push({ key: 'payout', label: 'Payout', path: `${routePaths.payouts}/${payoutId}` })
  }

  return handoffs
}

function appendExportFilters(params: URLSearchParams, filters: Record<string, unknown>) {
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return

    if (Array.isArray(value)) {
      const values = value.map((item) => String(item).trim()).filter(Boolean)

      if (values.length > 0) {
        params.set(key, values.join(','))
      }

      return
    }

    params.set(key, String(value))
  })
}

function buildReportViewPath(exportData: ReportExport) {
  const params = new URLSearchParams({
    exportId: exportData.exportId,
    format: exportData.format,
  })

  appendExportFilters(params, exportData.filters)

  return `${routePaths.reports}/${reportSlugByType[exportData.reportType]}?${params.toString()}#report-rows`
}

function buildReportExportsPath(exportData: ReportExport) {
  const params = new URLSearchParams({
    exportId: exportData.exportId,
  })

  return `${routePaths.reports}?${params.toString()}#report-exports`
}

function buildReportExportAuditPath(exportData: ReportExport) {
  const params = new URLSearchParams({
    moduleCode: 'reports',
    entityType: 'report_export',
    entityId: exportData.exportId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function SummaryCard({
  icon,
  label,
  meta,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  tone: StatusTone
  value: ReactNode
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <div className="flex items-center justify-between gap-3">
        <p className={cn('text-xs font-semibold uppercase tracking-normal', toneClass(tone))}>
          {label}
        </p>
        <span className={toneClass(tone)}>{icon}</span>
      </div>
      <div className={cn('mt-3 text-2xl font-semibold tracking-normal', toneClass(tone))}>
        {value}
      </div>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function toneClass(tone: StatusTone) {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/35 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-2 break-words text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </div>
    </div>
  )
}

function SectionShell({
  actionNode,
  children,
  description,
  id,
  icon,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  id?: string
  icon?: ReactNode
  title: string
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary">{icon}</span> : null}
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
          ) : null}
        </div>
        {actionNode ? <div className="shrink-0">{actionNode}</div> : null}
      </div>
      {children}
    </section>
  )
}

function DetailSkeleton() {
  return (
    <PageContainer>
      <DetailPageHeaderSkeleton />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-28 rounded-[0.875rem]" key={index} />
        ))}
      </div>
      <TableSkeleton columnCount={6} rowCount={4} />
    </PageContainer>
  )
}

function SignalBadgeGroup({
  emptyLabel,
  items,
  tone,
}: {
  emptyLabel: string
  items: string[]
  tone: StatusTone
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.length ? (
        items.map((item) => (
          <Badge key={item} tone={tone}>
            {humanizeCode(item)}
          </Badge>
        ))
      ) : (
        <Badge tone="success">{emptyLabel}</Badge>
      )}
    </div>
  )
}

function RelatedRecordRow({
  actionLabel = 'Open',
  canOpen,
  icon,
  label,
  meta,
  onOpen,
  value,
}: {
  actionLabel?: string
  canOpen: boolean
  icon: ReactNode
  label: string
  meta: string
  onOpen?: () => void
  value: string
}) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {value}
          </p>
          <p className="mt-1 truncate text-xs text-muted">{meta}</p>
        </div>
      </div>
      {canOpen && onOpen ? (
        <Button className="shrink-0" size="sm" type="button" variant="secondary" onClick={onOpen}>
          <ArrowUpRight className="mr-2 size-4" />
          {actionLabel}
        </Button>
      ) : (
        <Badge tone="neutral">View only</Badge>
      )}
    </div>
  )
}

function HeaderStatus({ exportData }: { exportData: ReportExport }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={exportStatusTone(exportData.status)}>
        {humanizeCode(exportData.status)}
      </Badge>
      <Badge tone="info">{reportLabels[exportData.reportType]}</Badge>
      <Badge tone="neutral">{exportData.format}</Badge>
    </div>
  )
}

function HeaderActions({
  exportData,
  isFetching,
  onDownload,
  onRefresh,
}: {
  exportData: ReportExport
  isFetching: boolean
  onDownload: (url: string) => void
  onRefresh: () => void
}) {
  const downloadUrl = exportData.download.downloadUrl

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        disabled={isFetching}
        size="sm"
        type="button"
        variant="secondary"
        onClick={onRefresh}
      >
        <RefreshCcw className={cn('mr-2 size-4', isFetching && 'animate-spin motion-reduce:animate-none')} />
        Refresh
      </Button>
      {downloadUrl && exportData.availableActions.includes('DOWNLOAD_FILE') ? (
        <Button size="sm" type="button" onClick={() => onDownload(downloadUrl)}>
          <ExternalLink className="mr-2 size-4" />
          Download
        </Button>
      ) : null}
    </div>
  )
}

function LifecyclePanel({ exportData }: { exportData: ReportExport }) {
  return (
    <SectionShell
      description="Export job lifecycle timestamps returned by the admin API."
      id={exportSectionIds.lifecycle}
      icon={<CalendarClock className="size-4" />}
      title="Lifecycle"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Queued" value={formatDateSafe(exportData.lifecycle.queuedAt)} />
        <DetailField label="Started" value={formatDateSafe(exportData.lifecycle.startedAt)} />
        <DetailField label="Completed" value={formatDateSafe(exportData.lifecycle.completedAt)} />
        <DetailField label="Failed" value={formatDateSafe(exportData.lifecycle.failedAt)} />
        <DetailField
          label="Requested by"
          value={exportData.lifecycle.requestedByAdminId ?? 'Not available'}
        />
        <DetailField
          label="Processed by"
          value={exportData.lifecycle.processedByAdminId ?? 'Not processed'}
        />
      </div>
    </SectionShell>
  )
}

function SignalsPanel({ exportData }: { exportData: ReportExport }) {
  const backendWarnings = [
    ...exportData.download.warnings,
    ...(exportData.failureReason ? [exportData.failureReason] : []),
  ]

  return (
    <SectionShell
      description="Backend export hints and controls. Failed retry is surfaced as a hint because no admin retry endpoint exists."
      icon={<TriangleAlert className="size-4" />}
      title="Signals"
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Warnings
          </p>
          <SignalBadgeGroup
            emptyLabel="No warnings"
            items={backendWarnings}
            tone={exportData.status === 'FAILED' ? 'danger' : 'warning'}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Backend actions
          </p>
          <SignalBadgeGroup
            emptyLabel="No backend action"
            items={exportData.availableActions}
            tone="info"
          />
        </div>
        <DetailField
          label="Recommended next"
          value={humanizeCode(exportData.nextRecommendedAction)}
        />
      </div>
    </SectionShell>
  )
}

function RelatedRecordsPanel({
  canReadAudit,
  exportData,
  onNavigate,
  onOpenSection,
}: {
  canReadAudit: boolean
  exportData: ReportExport
  onNavigate: (path: string) => void
  onOpenSection: (sectionId: ExportSectionId) => void
}) {
  return (
    <SectionShell
      description="Records and tools connected to this export job."
      icon={<ArrowUpRight className="size-4" />}
      title="Related records"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          actionLabel="Report"
          canOpen
          icon={<TableProperties className="size-4" />}
          label="Report view"
          meta="Restores export filters in the source report"
          value={reportLabels[exportData.reportType]}
          onOpen={() => onNavigate(buildReportViewPath(exportData))}
        />
        <RelatedRecordRow
          actionLabel="Exports"
          canOpen
          icon={<Download className="size-4" />}
          label="Export tracker"
          meta={humanizeCode(exportData.status)}
          value={compactId(exportData.exportId)}
          onOpen={() => onNavigate(buildReportExportsPath(exportData))}
        />
        <RelatedRecordRow
          actionLabel="Download"
          canOpen
          icon={<Download className="size-4" />}
          label="Download metadata"
          meta={humanizeCode(exportData.download.providerStatus)}
          value={exportData.download.downloadUrl ? 'Signed URL available' : 'Inline fallback'}
          onOpen={() => onOpenSection(exportSectionIds.download)}
        />
        <RelatedRecordRow
          actionLabel="Preview"
          canOpen
          icon={<TableProperties className="size-4" />}
          label="Inline preview"
          meta={`${exportData.result?.rows.length ?? 0} preview rows`}
          value={humanizeCode(exportData.nextRecommendedAction)}
          onOpen={() => onOpenSection(exportSectionIds.preview)}
        />
        <RelatedRecordRow
          actionLabel="Filters"
          canOpen
          icon={<FileJson className="size-4" />}
          label="Export filters"
          meta="JSON filter payload used to generate the export"
          value={`${Object.keys(exportData.filters).length} fields`}
          onOpen={() => onOpenSection(exportSectionIds.filters)}
        />
        <RelatedRecordRow
          actionLabel="Audit"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Audit trail"
          meta="Filtered by report export id"
          value={exportData.exportId}
          onOpen={() => onNavigate(buildReportExportAuditPath(exportData))}
        />
      </div>
    </SectionShell>
  )
}

function DownloadPanel({
  exportData,
  onDownload,
}: {
  exportData: ReportExport
  onDownload: (url: string) => void
}) {
  const downloadUrl = exportData.download.downloadUrl

  return (
    <SectionShell
      actionNode={
        downloadUrl && exportData.availableActions.includes('DOWNLOAD_FILE') ? (
          <Button size="sm" type="button" onClick={() => onDownload(downloadUrl)}>
            <ExternalLink className="mr-2 size-4" />
            Open
          </Button>
        ) : null
      }
      description="Signed file metadata for completed exports. Inline preview remains available when file storage is unavailable."
      id={exportSectionIds.download}
      icon={<Download className="size-4" />}
      title="Download"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <DetailField
          label="Provider"
          value={humanizeCode(exportData.download.providerStatus)}
        />
        <DetailField label="Expires" value={formatDateSafe(exportData.download.expiresAt)} />
        <DetailField
          label="File asset"
          value={exportData.download.fileMediaAssetId ?? 'Not available'}
        />
        <DetailField
          label="URL"
          value={downloadUrl ? 'Signed URL available' : 'Not available'}
        />
      </div>
    </SectionShell>
  )
}

function FiltersPanel({ exportData }: { exportData: ReportExport }) {
  return (
    <SectionShell id={exportSectionIds.filters} icon={<FileJson className="size-4" />} title="Filters">
      <pre className="max-h-[22rem] overflow-auto rounded-[0.75rem] border border-border bg-surface-muted/35 p-3 text-xs leading-5 text-foreground">
        {JSON.stringify(exportData.filters ?? {}, null, 2)}
      </pre>
    </SectionShell>
  )
}

function InlinePreviewPanel({
  exportData,
  onNavigate,
  rowAccess,
}: {
  exportData: ReportExport
  onNavigate: (path: string) => void
  rowAccess: {
    canReadCustomers: boolean
    canReadOrders: boolean
    canReadPayments: boolean
    canReadPayouts: boolean
    canReadVendors: boolean
  }
}) {
  const rows = (exportData.result?.rows ?? []) as ReportRow[]
  const summary = asSummaryRecord(exportData.result?.summary)

  return (
    <SectionShell
      description="Preview rows are returned by the export status endpoint; full export content comes from the signed file when available."
      id={exportSectionIds.preview}
      icon={<TableProperties className="size-4" />}
      title="Inline preview"
    >
      {exportData.result ? (
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <DetailField
              label="Generated"
              value={formatDateSafe(exportData.result.generatedAt)}
            />
            <DetailField label="Preview rows" value={rows.length} />
            {Object.entries(summary)
              .slice(0, 2)
              .map(([key, value]) => (
                <DetailField key={key} label={fieldLabel(key)} value={formatValue(key, value)} />
              ))}
          </div>
          {rows.length ? (
            <DynamicTable
              bodyMaxHeight={360}
              columns={buildPreviewColumns(rows)}
              data={rows}
              description="First rows available from the export result."
              inlineActionLimit={2}
              rowActions={(row) =>
                buildPreviewRowHandoffs(row, rowAccess).map((handoff) => ({
                  icon: <ExternalLink className="size-4" />,
                  key: handoff.key,
                  label: handoff.label,
                  onClick: () => onNavigate(handoff.path),
                  placement: 'inline',
                  variant: 'secondary',
                }))
              }
              title="Preview rows"
              getRowId={(row, index) => rowId(row, index, exportData.reportType)}
            />
          ) : (
            <EmptyState
              description="The export completed but no preview rows were returned."
              title="No preview rows"
            />
          )}
        </div>
      ) : (
        <EmptyState
          description="Inline preview appears after the export is completed."
          title="Preview unavailable"
        />
      )}
    </SectionShell>
  )
}

export function ReportExportDetailPage() {
  const { exportId } = useParams()
  const navigate = useNavigate()
  const canReadAudit = usePermission('audit:read')
  const canReadCustomers = usePermission('customers:read')
  const canReadOrders = usePermission('orders:read')
  const canReadPayments = usePermission('payments:read')
  const canReadPayouts = usePermission('payouts:read')
  const canReadVendors = usePermission('vendors:read')
  const canExport = usePermission('reports:export')

  const exportQuery = useQuery({
    enabled: Boolean(exportId) && canExport,
    queryKey: ['reports', 'exports', exportId],
    queryFn: () => reportService.getExport(exportId ?? ''),
    refetchInterval: (queryResult) => {
      const exportStatus = queryResult.state.data?.data.status
      return exportStatus === 'QUEUED' || exportStatus === 'PROCESSING' ? 3000 : false
    },
  })

  if (!exportId) {
    return (
      <PageContainer>
        <ErrorState
          description="The export route is missing an export id."
          title="Export unavailable"
        />
      </PageContainer>
    )
  }

  if (!canExport) {
    return (
      <PageContainer>
        <ErrorState
          description="Your role can read reports but cannot track export jobs."
          title="Export permission required"
        />
      </PageContainer>
    )
  }

  if (exportQuery.isLoading) {
    return <DetailSkeleton />
  }

  if (exportQuery.isError || !exportQuery.data?.data) {
    return (
      <PageContainer>
        <ErrorState
          description={
            exportQuery.error instanceof Error
              ? exportQuery.error.message
              : 'We could not load this export.'
          }
          title="Export unavailable"
          onRetry={() => void exportQuery.refetch()}
        />
      </PageContainer>
    )
  }

  const exportData = exportQuery.data.data
  const openDownload = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')
  const openSection = (sectionId: ExportSectionId) => {
    const section = document.getElementById(sectionId)

    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (section) {
      window.history.replaceState(null, '', `#${sectionId}`)
    }
  }
  const rowAccess = {
    canReadCustomers,
    canReadOrders,
    canReadPayments,
    canReadPayouts,
    canReadVendors,
  }

  return (
    <PageContainer className="!px-3 !py-4 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <HeaderActions
            exportData={exportData}
            isFetching={exportQuery.isFetching}
            onDownload={openDownload}
            onRefresh={() => void exportQuery.refetch()}
          />
        }
        description={`${reportLabels[exportData.reportType]} export`}
        listHref={routePaths.reports}
        listLabel="Reports"
        recordName={`Export ${compactId(exportData.exportId)}`}
        titleMetaNode={<HeaderStatus exportData={exportData} />}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={
            exportData.status === 'FAILED' ? (
              <XCircle className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )
          }
          label="Status"
          meta={humanizeCode(exportData.nextRecommendedAction)}
          tone={exportStatusTone(exportData.status)}
          value={humanizeCode(exportData.status)}
        />
        <SummaryCard
          icon={<TableProperties className="size-4" />}
          label="Rows"
          meta="Export result"
          tone="info"
          value={exportData.rowCount === null ? 'Pending' : formatNumber(exportData.rowCount)}
        />
        <SummaryCard
          icon={<Download className="size-4" />}
          label="Download"
          meta={humanizeCode(exportData.download.providerStatus)}
          tone={exportData.download.downloadUrl ? 'success' : 'neutral'}
          value={exportData.download.downloadUrl ? 'Ready' : 'Not ready'}
        />
        <SummaryCard
          icon={<TriangleAlert className="size-4" />}
          label="Warnings"
          meta="Provider and failure state"
          tone={
            exportData.failureReason
              ? 'danger'
              : exportData.download.warnings.length
                ? 'warning'
                : 'success'
          }
          value={String(exportData.download.warnings.length + (exportData.failureReason ? 1 : 0))}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <LifecyclePanel exportData={exportData} />
        <SignalsPanel exportData={exportData} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <div className="space-y-3">
          <DownloadPanel exportData={exportData} onDownload={openDownload} />
          <InlinePreviewPanel
            exportData={exportData}
            rowAccess={rowAccess}
            onNavigate={navigate}
          />
          <FiltersPanel exportData={exportData} />
        </div>
        <RelatedRecordsPanel
          canReadAudit={canReadAudit}
          exportData={exportData}
          onNavigate={navigate}
          onOpenSection={openSection}
        />
      </section>
    </PageContainer>
  )
}
