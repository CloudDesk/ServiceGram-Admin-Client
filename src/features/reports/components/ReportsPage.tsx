import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  RefreshCcw,
  Search,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import {
  DynamicTable,
  TableSkeleton,
  type DynamicTableColumn,
} from '../../../components/ui/Table'
import { usePermission } from '../../../hooks/usePermission'
import { mapApiError } from '../../../services/apiErrorMapper'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { reportService } from '../services/report.service'
import type {
  AdminReportType,
  ReportData,
  ReportExport,
  ReportExportFormat,
  ReportExportStatus,
  ReportQueryParams,
  ReportRow,
  ReportSummary,
} from '../types/report.types'

const reportCatalog: Record<
  AdminReportType,
  {
    label: string
    description: string
    statusOptions: string[]
  }
> = {
  ORDER_LIFECYCLE: {
    label: 'Order Lifecycle',
    description: 'Orders, fulfillment states, value, and delivery timing.',
    statusOptions: [
      'ORDER_PLACED',
      'VENDOR_ACCEPTANCE_PENDING',
      'VENDOR_ACCEPTED',
      'VENDOR_DECLINED',
      'PICKUP_SCHEDULED',
      'PICKED_UP_FROM_CUSTOMER',
      'HANDED_OVER_TO_VENDOR',
      'ITEM_RECEIVED_BY_VENDOR',
      'SERVICE_IN_PROGRESS',
      'SERVICE_COMPLETED',
      'COLLECTED_FROM_VENDOR',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'DELIVERY_FAILED',
      'CUSTOMER_UNAVAILABLE',
      'ITEM_DAMAGED',
      'ITEM_LOST',
      'WRONG_ITEM',
    ],
  },
  VENDOR_PERFORMANCE: {
    label: 'Vendor Performance',
    description: 'Vendor order volume, fulfillment, earnings, and geography.',
    statusOptions: [],
  },
  PAYMENTS: {
    label: 'Payments',
    description: 'Payment volume, gateway state, and success value.',
    statusOptions: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
  },
  PAYOUTS: {
    label: 'Payouts',
    description: 'Payout queue, holds, settlements, and failed transfers.',
    statusOptions: [
      'PENDING',
      'UNDER_REVIEW',
      'HELD',
      'APPROVED',
      'PAID',
      'FAILED',
      'ADJUSTED',
      'CANCELLED',
    ],
  },
  REFUNDS: {
    label: 'Refunds',
    description: 'Refund requests, approvals, failures, and processed value.',
    statusOptions: [
      'REQUESTED',
      'APPROVED',
      'PROCESSING',
      'SUCCESS',
      'FAILED',
      'REJECTED',
    ],
  },
}

const reportTypes = Object.keys(reportCatalog) as AdminReportType[]
const exportFormats: ReportExportFormat[] = ['CSV', 'JSON']
const emptyReportRows: ReportRow[] = []

function humanize(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\bId\b/g, 'ID')
    .replace(/\bUrl\b/g, 'URL')
    .replace(/\bAt\b/g, 'At')
    .trim()
}

function fieldLabel(key: string) {
  return humanize(key)
    .split(' ')
    .map((part) => {
      const lowerPart = part.toLowerCase()

      if (['api', 'cod', 'gcs', 'id', 'iam', 'otp', 'sms', 'url'].includes(lowerPart)) {
        return part.toUpperCase()
      }

      const firstChar = part.at(0)

      return firstChar ? firstChar.toUpperCase() + part.slice(1) : ''
    })
    .join(' ')
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

  if (
    ['SUCCESS', 'COMPLETED', 'DELIVERED', 'PAID', 'APPROVED', 'VENDOR_ACCEPTED'].includes(
      normalized,
    )
  ) {
    return 'success'
  }

  if (
    [
      'FAILED',
      'CANCELLED',
      'REJECTED',
      'VENDOR_DECLINED',
      'DELIVERY_FAILED',
      'ITEM_DAMAGED',
      'ITEM_LOST',
      'WRONG_ITEM',
    ].includes(normalized)
  ) {
    return 'danger'
  }

  if (
    [
      'PENDING',
      'PROCESSING',
      'QUEUED',
      'REQUESTED',
      'UNDER_REVIEW',
      'HELD',
      'VENDOR_ACCEPTANCE_PENDING',
      'CUSTOMER_UNAVAILABLE',
    ].includes(normalized)
  ) {
    return 'warning'
  }

  return 'info'
}

function formatValue(key: string, value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted">Not available</span>
  }

  if (typeof value === 'number') {
    return isMoneyKey(key) ? formatMoney(value / 100) : formatNumber(value)
  }

  if (typeof value === 'bigint') {
    const numericValue = Number(value)
    return isMoneyKey(key) ? formatMoney(numericValue / 100) : formatNumber(numericValue)
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (typeof value === 'string') {
    if (isMoneyKey(key) && /^-?\d+(\.\d+)?$/.test(value)) {
      return formatMoney(Number(value) / 100)
    }

    if (key.toLowerCase().includes('status')) {
      return <Badge tone={statusTone(value)}>{humanize(value)}</Badge>
    }

    if (isDateLikeValue(value)) {
      return formatDate(value, true)
    }

    return value
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : <span className="text-muted">None</span>
  }

  return JSON.stringify(value)
}

function compactId(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value
}

function asSummaryRecord(summary: unknown): ReportSummary {
  return summary && typeof summary === 'object' && !Array.isArray(summary)
    ? (summary as ReportSummary)
    : {}
}

function getDateRangeError(dateFrom: string, dateTo: string) {
  if (!dateFrom || !dateTo) {
    return null
  }

  return new Date(dateFrom).getTime() <= new Date(dateTo).getTime()
    ? null
    : 'Date From must be before Date To.'
}

function getLimitError(limit: string) {
  if (!limit.trim()) {
    return null
  }

  const value = Number(limit)

  if (!Number.isInteger(value) || value < 1 || value > 100) {
    return 'Limit must be a whole number from 1 to 100.'
  }

  return null
}

function toFilterRecord(query: ReportQueryParams): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function buildColumns(rows: ReportRow[]): DynamicTableColumn<ReportRow>[] {
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
    'createdAt',
    'deliveredAt',
    'paidAt',
  ]
  const discoveredKeys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const orderedKeys = [
    ...preferredKeys.filter((key) => discoveredKeys.includes(key)),
    ...discoveredKeys.filter((key) => !preferredKeys.includes(key)),
  ].slice(0, 9)

  return orderedKeys.map((key) => ({
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

function MetricStrip({
  generatedAt,
  rowCount,
  summary,
}: {
  generatedAt?: string
  rowCount?: number
  summary: ReportSummary
}) {
  const entries = Object.entries(summary).slice(0, 7)

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rows</p>
        <p className="mt-1 text-xl font-semibold text-foreground">
          {typeof rowCount === 'number' ? formatNumber(rowCount) : '0'}
        </p>
        {generatedAt ? (
          <p className="mt-1 text-xs text-muted">{formatDate(generatedAt, true)}</p>
        ) : null}
      </div>
      {entries.map(([key, value]) => (
        <div className="rounded-lg border border-border bg-surface p-3" key={key}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {fieldLabel(key)}
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {formatValue(key, value)}
          </p>
        </div>
      ))}
    </div>
  )
}

function StatusBreakdown({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Status Breakdown</h2>
        <Badge tone="neutral">{rows.length} states</Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row, index) => {
          const status = typeof row.status === 'string' ? row.status : `STATE_${index + 1}`
          const countEntry = Object.entries(row).find(
            ([key, value]) =>
              key.toLowerCase().includes('count') &&
              (typeof value === 'number' || typeof value === 'string'),
          )
          const amountEntry = Object.entries(row).find(([key]) => isMoneyKey(key))

          return (
            <div className="rounded-lg border border-border bg-background/50 p-3" key={status}>
              <Badge tone={statusTone(status)}>{humanize(status)}</Badge>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {countEntry ? formatValue(countEntry[0], countEntry[1]) : '0'}
              </p>
              {amountEntry ? (
                <p className="text-xs text-muted">
                  {fieldLabel(amountEntry[0])}: {formatValue(amountEntry[0], amountEntry[1])}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function statusIcon(status: ReportExportStatus) {
  if (status === 'COMPLETED') {
    return <CheckCircle2 className="size-4 text-success" />
  }

  if (status === 'FAILED') {
    return <XCircle className="size-4 text-danger" />
  }

  if (status === 'PROCESSING') {
    return <RefreshCcw className="size-4 animate-spin text-info" />
  }

  return <Clock3 className="size-4 text-warning" />
}

function ExportStatusPanel({
  exportData,
  isLoading,
  isError,
  errorMessage,
  onRefresh,
  onOpenDownload,
}: {
  exportData?: ReportExport
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  onRefresh: () => void
  onOpenDownload: (url: string) => void
}) {
  if (isLoading && !exportData) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <TableSkeleton columnCount={4} rowCount={2} />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        description={errorMessage ?? 'We could not load this export.'}
        title="Export unavailable"
        onRetry={onRefresh}
      />
    )
  }

  if (!exportData) {
    return null
  }

  const downloadUrl = exportData.download.downloadUrl
  const hasInlineRows = Boolean(exportData.result?.rows.length)

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {statusIcon(exportData.status)}
            <h2 className="text-base font-semibold text-foreground">
              Export {compactId(exportData.exportId)}
            </h2>
            <Badge tone={statusTone(exportData.status)}>{humanize(exportData.status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {reportCatalog[exportData.reportType].label} / {exportData.format}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={isLoading}
            size="sm"
            title="Refresh export status"
            variant="secondary"
            onClick={onRefresh}
          >
            <RefreshCcw className="mr-2 size-4" />
            Refresh
          </Button>
          <Button
            disabled={!downloadUrl}
            size="sm"
            title="Open signed download"
            onClick={() => downloadUrl && onOpenDownload(downloadUrl)}
          >
            <ExternalLink className="mr-2 size-4" />
            Download
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Queued</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {formatDate(exportData.lifecycle.queuedAt, true)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rows</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {exportData.rowCount === null ? 'Pending' : formatNumber(exportData.rowCount)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Provider</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {humanize(exportData.download.providerStatus)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Expires</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {exportData.download.expiresAt
              ? formatDate(exportData.download.expiresAt, true)
              : 'Not available'}
          </p>
        </div>
      </div>

      {exportData.failureReason ? <InlineAlert message={exportData.failureReason} /> : null}
      {exportData.download.warnings.length ? (
        <div className="space-y-2">
          {exportData.download.warnings.map((warning) => (
            <div
              className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-3 text-sm text-warning"
              key={warning}
            >
              <TriangleAlert className="mt-0.5 size-4" />
              <span>{humanize(warning)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {exportData.result ? (
        <div className="space-y-3">
          <MetricStrip
            generatedAt={exportData.result.generatedAt ?? undefined}
            rowCount={exportData.result.rows.length}
            summary={asSummaryRecord(exportData.result.summary)}
          />
          {hasInlineRows ? (
            <DynamicTable
              bodyMaxHeight={360}
              columns={buildColumns(exportData.result.rows as ReportRow[])}
              data={exportData.result.rows as ReportRow[]}
              description="First rows available from the export result."
              title="Inline Preview"
              getRowId={(row, index) => rowId(row, index, exportData.reportType)}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function OptionalSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: T[]
  value: '' | T
  onChange: (value: '' | T) => void
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value as '' | T)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {humanize(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ReportsPage({
  initialReportType = 'ORDER_LIFECYCLE',
}: {
  initialReportType?: AdminReportType
}) {
  const canExport = usePermission('reports:export')
  const [reportType, setReportType] = useState<AdminReportType>(initialReportType)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [city, setCity] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState('')
  const [limit, setLimit] = useState('20')
  const [format, setFormat] = useState<ReportExportFormat>('CSV')
  const [reason, setReason] = useState('')
  const [selectedExportId, setSelectedExportId] = useState('')
  const [trackedExportIds, setTrackedExportIds] = useState<string[]>([])
  const [trackingExportId, setTrackingExportId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const activeReport = reportCatalog[reportType]
  const dateError = getDateRangeError(dateFrom, dateTo)
  const limitError = getLimitError(limit)
  const parsedLimit = limit.trim() ? Number(limit) : 20
  const filterError = dateError ?? limitError

  const query = useMemo<ReportQueryParams>(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      city: city.trim() || undefined,
      vendorId: vendorId.trim() || undefined,
      zoneId: zoneId.trim() || undefined,
      categoryId: categoryId.trim() || undefined,
      status: status || undefined,
      limit: Number.isInteger(parsedLimit) ? parsedLimit : 20,
    }),
    [categoryId, city, dateFrom, dateTo, parsedLimit, status, vendorId, zoneId],
  )

  const reportQuery = useQuery({
    enabled: !filterError,
    queryKey: ['reports', reportType, query],
    queryFn: () => reportService.getReport(reportType, query),
  })
  const exportFilters = useMemo(() => toFilterRecord(query), [query])

  const exportQuery = useQuery({
    enabled: Boolean(selectedExportId) && canExport,
    queryKey: ['reports', 'exports', selectedExportId],
    queryFn: () => reportService.getExport(selectedExportId),
    refetchInterval: (queryResult) => {
      const exportStatus = queryResult.state.data?.data.status
      return exportStatus === 'QUEUED' || exportStatus === 'PROCESSING' ? 3000 : false
    },
  })

  const rememberExport = (exportId: string) => {
    const trimmedId = exportId.trim()

    if (!trimmedId) {
      return
    }

    setSelectedExportId(trimmedId)
    setTrackedExportIds((current) => [
      trimmedId,
      ...current.filter((item) => item !== trimmedId),
    ].slice(0, 5))
  }

  const exportMutation = useMutation({
    mutationFn: () =>
      reportService.createExport({
        reportType,
        format,
        filters: exportFilters,
        reason: reason.trim(),
      }),
    onSuccess: (response) => {
      setReason('')
      setFormError(null)
      rememberExport(response.data.exportId)
    },
  })

  const reportData: ReportData | undefined = reportQuery.data?.data
  const rows = reportData?.rows ?? emptyReportRows
  const columns = useMemo(() => buildColumns(rows), [rows])
  const exportData =
    exportQuery.data?.data ??
    (exportMutation.data?.data.exportId === selectedExportId ? exportMutation.data.data : undefined)
  const exportErrorMessage = exportQuery.error ? mapApiError(exportQuery.error) : undefined
  const reportErrorMessage = reportQuery.error ? mapApiError(reportQuery.error) : undefined
  const exportMutationError = exportMutation.error ? mapApiError(exportMutation.error) : null
  const reasonError =
    reason.trim() && reason.trim().length < 5
      ? 'Export reason must be at least 5 characters.'
      : null
  const canQueueExport = canExport && !filterError && !reasonError && reason.trim().length >= 5

  const queueExport = () => {
    const validationError =
      filterError ??
      reasonError ??
      (!reason.trim() ? 'Add an export reason before queueing.' : null)

    if (!canExport) {
      setFormError('Your role can read reports but cannot queue exports.')
      return
    }

    if (validationError) {
      setFormError(validationError)
      return
    }

    setFormError(null)
    void exportMutation.mutateAsync().catch(() => undefined)
  }

  const trackExport = () => {
    const exportId = trackingExportId.trim()

    if (!exportId) {
      setFormError('Enter an export ID to track.')
      return
    }

    setFormError(null)
    setTrackingExportId('')
    rememberExport(exportId)
  }

  const resetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setCity('')
    setVendorId('')
    setZoneId('')
    setCategoryId('')
    setStatus('')
    setLimit('20')
    setFormError(null)
  }

  return (
    <PageContainer>
      <PageContextHeader
        actionNode={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" title="Reload report" variant="secondary" onClick={() => void reportQuery.refetch()}>
              <RefreshCcw className="mr-2 size-4" />
              Refresh
            </Button>
            <Button
              disabled={!canQueueExport}
              isLoading={exportMutation.isPending}
              size="sm"
              title="Queue report export"
              onClick={queueExport}
            >
              <Download className="mr-2 size-4" />
              Queue Export
            </Button>
          </div>
        }
        description="Operational report views and async export jobs."
        title="Reports"
      />

      {!canExport ? (
        <InlineAlert message="Your role can view reports but cannot queue or track exports." />
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {reportTypes.map((type) => (
          <button
            className={cn(
              'rounded-lg border p-3 text-left transition hover:border-primary/60',
              type === reportType
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-surface text-muted',
            )}
            key={type}
            type="button"
            onClick={() => {
              setReportType(type)
              setStatus('')
            }}
          >
            <span className="block text-sm font-semibold text-foreground">
              {reportCatalog[type].label}
            </span>
            <span className="mt-1 block text-xs leading-5">{reportCatalog[type].description}</span>
          </button>
        ))}
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Filters</h2>
            <p className="text-sm text-muted">{activeReport.label}</p>
          </div>
          <Button size="sm" title="Reset filters" variant="secondary" onClick={resetFilters}>
            <RefreshCcw className="mr-2 size-4" />
            Reset
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Date From</span>
            <Input
              type="datetime-local"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Date To</span>
            <Input
              type="datetime-local"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
          <OptionalSelect
            label="Status"
            options={activeReport.statusOptions}
            value={status}
            onChange={setStatus}
          />
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">City</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                className="pl-9"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
          </label>
          {[
            ['Zone ID', zoneId, setZoneId],
            ['Vendor ID', vendorId, setVendorId],
            ['Category ID', categoryId, setCategoryId],
            ['Limit', limit, setLimit],
          ].map(([label, value, setter]) => (
            <label className="space-y-1" key={label as string}>
              <span className="text-sm font-medium text-foreground">{label as string}</span>
              <Input
                max={label === 'Limit' ? 100 : undefined}
                min={label === 'Limit' ? 1 : undefined}
                type={label === 'Limit' ? 'number' : 'text'}
                value={value as string}
                onChange={(event) => (setter as (nextValue: string) => void)(event.target.value)}
              />
            </label>
          ))}
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Export Format</span>
            <select
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={format}
              onChange={(event) => setFormat(event.target.value as ReportExportFormat)}
            >
              {exportFormats.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Export Reason</span>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        </div>

        {filterError ? <InlineAlert message={filterError} /> : null}
        {reasonError ? <InlineAlert message={reasonError} /> : null}
        {formError ? <InlineAlert message={formError} /> : null}
        {exportMutationError ? <InlineAlert message={exportMutationError} /> : null}
        {reportData?.warnings.length ? (
          <div className="space-y-2">
            {reportData.warnings.map((warning) => (
              <div
                className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-3 text-sm text-warning"
                key={warning}
              >
                <TriangleAlert className="mt-0.5 size-4" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {reportData ? (
        <MetricStrip
          generatedAt={reportData.generatedAt}
          rowCount={reportData.rowCount}
          summary={reportData.summary}
        />
      ) : null}

      {reportData?.byStatus ? <StatusBreakdown rows={reportData.byStatus} /> : null}

      {reportQuery.isError || filterError ? (
        <ErrorState
          description={reportErrorMessage ?? filterError ?? 'We could not load this report.'}
          title="Report unavailable"
          onRetry={() => void reportQuery.refetch()}
        />
      ) : reportQuery.isLoading || reportQuery.isFetching ? (
        <TableSkeleton columnCount={6} rowCount={8} />
      ) : rows.length === 0 ? (
        <EmptyState description="No report rows matched this filter." title="No report rows" />
      ) : (
        <DynamicTable
          bodyMaxHeight={560}
          columns={columns}
          data={rows}
          description={`${formatNumber(rows.length)} rows returned for ${activeReport.label}.`}
          title={activeReport.label}
          getRowId={(row, index) => rowId(row, index, reportType)}
        />
      )}

      {canExport ? (
        <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Exports</h2>
              <p className="text-sm text-muted">Queue, refresh, and download report files.</p>
            </div>
            <div className="flex min-w-[min(100%,28rem)] flex-1 items-end gap-2 md:flex-none">
              <label className="min-w-0 flex-1 space-y-1">
                <span className="text-sm font-medium text-foreground">Export ID</span>
                <Input
                  value={trackingExportId}
                  onChange={(event) => setTrackingExportId(event.target.value)}
                />
              </label>
              <Button size="sm" title="Track export" variant="secondary" onClick={trackExport}>
                <Eye className="mr-2 size-4" />
                Track
              </Button>
            </div>
          </div>

          {trackedExportIds.length ? (
            <div className="flex flex-wrap gap-2">
              {trackedExportIds.map((exportId) => (
                <button
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-semibold transition',
                    exportId === selectedExportId
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background/50 text-foreground hover:border-primary/60',
                  )}
                  title={exportId}
                  key={exportId}
                  type="button"
                  onClick={() => setSelectedExportId(exportId)}
                >
                  {compactId(exportId)}
                </button>
              ))}
            </div>
          ) : null}

          <ExportStatusPanel
            errorMessage={exportErrorMessage}
            exportData={exportData}
            isError={exportQuery.isError}
            isLoading={exportQuery.isLoading || exportQuery.isFetching}
            onOpenDownload={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
            onRefresh={() => void exportQuery.refetch()}
          />
        </section>
      ) : null}
    </PageContainer>
  )
}
