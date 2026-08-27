import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  Filter,
  RefreshCcw,
  SlidersHorizontal,
  TriangleAlert,
  X,
  XCircle,
} from 'lucide-react'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
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
import { PageContextHeader } from '../../../components/ui/PageHeader'
import {
  DynamicTable,
  TableSkeleton,
  type DynamicTableColumn,
} from '../../../components/ui/Table'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { useListSelection } from '../../../hooks/useListSelection'
import { mapApiError } from '../../../services/apiErrorMapper'
import type { LookupOption } from '../../../types/lookup.types'
import {
  buildPathWithQueryParams,
  readLookupOptionsFromSearchParams,
  readSearchParamList,
} from '../../../utils/buildQueryParams'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import {
  searchCategoryLookupOptions,
  searchCustomerLookupOptions,
  searchVendorLookupOptions,
} from '../../lookups/adminLookups'
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

type ReportsPageMode = 'list' | 'detail'
interface SelectableReportRow {
  id: string
  row: ReportRow
}

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
      'PRICE_REVISION_PENDING_CUSTOMER',
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
const reportSlugByType: Record<AdminReportType, string> = {
  ORDER_LIFECYCLE: 'order-lifecycle',
  VENDOR_PERFORMANCE: 'vendor-performance',
  PAYMENTS: 'payments',
  PAYOUTS: 'payouts',
  REFUNDS: 'refunds',
}
const exportFormats: ReportExportFormat[] = ['CSV', 'JSON']
const emptyReportRows: ReportRow[] = []
const REPORT_DEFAULT_COLUMN_WIDTH = 220
const REPORT_COLUMN_GAP = 12
const REPORT_INLINE_PADDING = 24
const REPORT_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.report.columnWidths.v1'
const REPORT_ACTION_COLUMN_WIDTH = 230

type ReportColumnWidths = Record<string, number>

interface ReportRowHandoff {
  key: string
  label: string
  path: string
}

interface ReportOperationsDrilldown {
  description: string
  label: string
  path: string
}

interface ReportGridStyle extends CSSProperties {
  '--report-grid-template': string
  '--report-grid-min-width': string
}

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

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
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
      'PRICE_REVISION_PENDING_CUSTOMER',
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
      return <Badge tone={statusTone(value)}>{humanizeCode(value)}</Badge>
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

function valueToSearchText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function rowMatchesSearch(row: ReportRow, search: string) {
  const term = search.trim().toLowerCase()

  if (!term) return true

  return Object.values(row).some((value) =>
    valueToSearchText(value).toLowerCase().includes(term),
  )
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
    Object.entries(query).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0
      return value !== undefined && value !== null && value !== ''
    }),
  )
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
    'deliveredAt',
    'paidAt',
  ]
  const discoveredKeys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))

  return [
    ...preferredKeys.filter((key) => discoveredKeys.includes(key)),
    ...discoveredKeys.filter((key) => !preferredKeys.includes(key)),
  ]
}

function defaultVisibleColumns(columns: string[]) {
  return columns.slice(0, Math.min(columns.length, 6))
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

function reportColumnStorageKey(reportType: AdminReportType, columnId: string) {
  return `${reportType}:${columnId}`
}

function getReportColumnMinWidth(columnId: string) {
  return columnId.toLowerCase().includes('id') ? 210 : 150
}

function getReportColumnWidth(
  reportType: AdminReportType,
  columnWidths: ReportColumnWidths,
  columnId: string,
) {
  return Math.max(
    getReportColumnMinWidth(columnId),
    columnWidths[reportColumnStorageKey(reportType, columnId)] ??
      REPORT_DEFAULT_COLUMN_WIDTH,
  )
}

function loadReportColumnWidths() {
  if (typeof window === 'undefined') return {}

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(REPORT_COLUMN_WIDTH_STORAGE_KEY) ?? '{}',
    ) as Record<string, unknown>

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) => typeof value === 'number' && Number.isFinite(value),
      ),
    ) as ReportColumnWidths
  } catch {
    return {}
  }
}

function getReportGridTemplate(
  reportType: AdminReportType,
  visibleColumns: string[],
  columnWidths: ReportColumnWidths,
) {
  const selectedWidths = visibleColumns
    .map((columnId) => `${getReportColumnWidth(reportType, columnWidths, columnId)}px`)

  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...selectedWidths,
    `${REPORT_ACTION_COLUMN_WIDTH}px`,
  ].join(' ')
}

function getReportGridMinWidth(
  reportType: AdminReportType,
  visibleColumns: string[],
  columnWidths: ReportColumnWidths,
) {
  const gridColumnCount = visibleColumns.length + 2
  const gridGapWidth = Math.max(gridColumnCount - 1, 0) * REPORT_COLUMN_GAP
  const visibleWidth = visibleColumns.reduce(
    (sum, columnId) => sum + getReportColumnWidth(reportType, columnWidths, columnId),
    0,
  )

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    REPORT_ACTION_COLUMN_WIDTH +
    gridGapWidth +
    REPORT_INLINE_PADDING
  }px`
}

function reportSupportsCustomerFilter(reportType: AdminReportType) {
  return ['ORDER_LIFECYCLE', 'PAYMENTS', 'REFUNDS'].includes(reportType)
}

function readReportStatuses(searchParams: URLSearchParams, reportType: AdminReportType) {
  const allowedStatuses = new Set(reportCatalog[reportType].statusOptions)

  return readSearchParamList(searchParams, 'status').filter((status) =>
    allowedStatuses.has(status),
  )
}

function readReportFormat(searchParams: URLSearchParams) {
  const format = searchParams.get('format')

  return exportFormats.includes(format as ReportExportFormat)
    ? (format as ReportExportFormat)
    : 'CSV'
}

function getStringField(row: ReportRow, key: string) {
  const value = row[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function buildReportRowHandoffs(
  row: ReportRow,
  access: {
    canReadCustomers: boolean
    canReadOrders: boolean
    canReadPayments: boolean
    canReadPayouts: boolean
    canReadVendors: boolean
  },
): ReportRowHandoff[] {
  const handoffs: ReportRowHandoff[] = []
  const orderId = getStringField(row, 'orderId')
  const vendorId = getStringField(row, 'vendorId')
  const customerId = getStringField(row, 'customerId')
  const paymentId = getStringField(row, 'paymentId')
  const refundId = getStringField(row, 'refundId')
  const payoutId = getStringField(row, 'payoutId')

  if (orderId && access.canReadOrders) {
    handoffs.push({
      key: 'order',
      label: 'Order',
      path: `${routePaths.orders}/${orderId}`,
    })
  }

  if (vendorId && access.canReadVendors) {
    handoffs.push({
      key: 'vendor',
      label: 'Vendor',
      path: `${routePaths.vendors}/${vendorId}`,
    })
  }

  if (customerId && access.canReadCustomers) {
    handoffs.push({
      key: 'customer',
      label: 'Customer',
      path: `${routePaths.customers}/${customerId}`,
    })
  }

  if (paymentId && access.canReadPayments) {
    handoffs.push({
      key: 'payment',
      label: 'Payment',
      path: `${routePaths.payments}/${paymentId}`,
    })
  }

  if (refundId && access.canReadPayments) {
    handoffs.push({
      key: 'refund',
      label: 'Refund',
      path: `${routePaths.refunds}/${refundId}`,
    })
  }

  if (payoutId && access.canReadPayouts) {
    handoffs.push({
      key: 'payout',
      label: 'Payout',
      path: `${routePaths.payouts}/${payoutId}`,
    })
  }

  return handoffs
}

function lookupParamValues(options: LookupOption[]) {
  return options.map((option) => option.value)
}

function lookupParamLabels(options: LookupOption[]) {
  return options.map((option) => option.label || option.value)
}

function singleLookupSearch(options: LookupOption[]) {
  if (options.length !== 1) return undefined

  return (options[0]?.label || options[0]?.value || '').trim() || undefined
}

function buildReportOperationsDrilldown(
  reportType: AdminReportType,
  filters: {
    city: string
    dateFrom: string
    dateTo: string
    selectedCategories: LookupOption[]
    selectedCustomers: LookupOption[]
    selectedStatuses: string[]
    selectedVendors: LookupOption[]
  },
  access: {
    canReadOrders: boolean
    canReadPayments: boolean
    canReadPayouts: boolean
    canReadVendors: boolean
  },
): ReportOperationsDrilldown | null {
  const baseFilters = {
    city: filters.city.trim() || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  }
  const categoryFilters = {
    categoryId: lookupParamValues(filters.selectedCategories),
    categoryLabel: lookupParamLabels(filters.selectedCategories),
  }
  const customerFilters = {
    customerId: lookupParamValues(filters.selectedCustomers),
    customerLabel: lookupParamLabels(filters.selectedCustomers),
  }
  const vendorFilters = {
    vendorId: lookupParamValues(filters.selectedVendors),
    vendorLabel: lookupParamLabels(filters.selectedVendors),
  }

  if (reportType === 'ORDER_LIFECYCLE' && access.canReadOrders) {
    return {
      description: 'Open matching orders with the current report filters applied.',
      label: 'Open Orders',
      path: buildPathWithQueryParams(routePaths.orders, {
        ...baseFilters,
        ...categoryFilters,
        ...customerFilters,
        ...vendorFilters,
        orderStatus: filters.selectedStatuses,
      }),
    }
  }

  if (reportType === 'VENDOR_PERFORMANCE' && access.canReadVendors) {
    return {
      description: 'Open the vendor list with matching city/category context.',
      label: 'Open Vendors',
      path: buildPathWithQueryParams(routePaths.vendors, {
        city: baseFilters.city,
        ...categoryFilters,
        search: singleLookupSearch(filters.selectedVendors),
      }),
    }
  }

  if (reportType === 'PAYMENTS' && access.canReadPayments) {
    return {
      description: 'Open matching payments with supported report filters applied.',
      label: 'Open Payments',
      path: buildPathWithQueryParams(routePaths.payments, {
        ...baseFilters,
        ...customerFilters,
        ...vendorFilters,
        status: filters.selectedStatuses,
      }),
    }
  }

  if (reportType === 'PAYOUTS' && access.canReadPayouts) {
    return {
      description: 'Open matching payouts with supported report filters applied.',
      label: 'Open Payouts',
      path: buildPathWithQueryParams(routePaths.payouts, {
        ...baseFilters,
        ...vendorFilters,
        status: filters.selectedStatuses,
      }),
    }
  }

  if (reportType === 'REFUNDS' && access.canReadPayments) {
    return {
      description: 'Open matching refunds with supported report filters applied.',
      label: 'Open Refunds',
      path: buildPathWithQueryParams(routePaths.refunds, {
        ...baseFilters,
        ...customerFilters,
        ...vendorFilters,
        status: filters.selectedStatuses,
      }),
    }
  }

  return null
}

function statusOptionsForReport(reportType: AdminReportType): LookupOption[] {
  return reportCatalog[reportType].statusOptions.map((status) => ({
    label: humanizeCode(status),
    value: status,
  }))
}

function MetricCard({
  label,
  meta,
  value,
}: {
  label: string
  meta?: string
  value: ReactNode
}) {
  return (
    <div className="min-h-[4.35rem] rounded-[0.75rem] border border-border bg-surface p-2.5">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-1 text-lg font-semibold tracking-normal text-foreground">
        {value}
      </div>
      {meta ? <p className="mt-1 text-xs text-muted">{meta}</p> : null}
    </div>
  )
}

function MetricStrip({
  generatedAt,
  rowCount,
  summary,
  warnings,
}: {
  generatedAt?: string
  rowCount?: number
  summary: ReportSummary
  warnings: number
}) {
  const entries = Object.entries(summary).slice(0, 3)

  return (
    <section className="grid shrink-0 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Rows"
        meta={generatedAt ? formatDateSafe(generatedAt) : 'Generated on refresh'}
        value={typeof rowCount === 'number' ? formatNumber(rowCount) : '0'}
      />
      {entries.map(([key, value]) => (
        <MetricCard key={key} label={fieldLabel(key)} value={formatValue(key, value)} />
      ))}
      {entries.length < 3 ? (
        <MetricCard
          label="Warnings"
          meta={warnings ? 'Needs review' : 'No warnings'}
          value={warnings}
        />
      ) : null}
    </section>
  )
}

function StatusBreakdown({ rows }: { rows: Record<string, unknown>[] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (rows.length === 0) {
    return null
  }

  const breakdownRows = rows
    .map((row, index) => {
      const status = typeof row.status === 'string' ? row.status : `STATE_${index + 1}`
      const countEntry = Object.entries(row).find(
        ([key, value]) =>
          key.toLowerCase().includes('count') &&
          (typeof value === 'number' || typeof value === 'string'),
      )
      const amountEntry = Object.entries(row).find(([key]) => isMoneyKey(key))
      const numericCount = countEntry ? Number(countEntry[1]) : 0

      return {
        amountEntry,
        countEntry,
        numericCount: Number.isFinite(numericCount) ? numericCount : 0,
        status,
      }
    })
    .sort((left, right) => right.numericCount - left.numericCount)
  const visibleRows = isExpanded ? breakdownRows : breakdownRows.slice(0, 5)
  const hiddenCount = Math.max(breakdownRows.length - visibleRows.length, 0)

  return (
    <section className="shrink-0 rounded-[0.875rem] border border-border bg-surface px-3 py-2.5 shadow-surface">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Status Breakdown</h2>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{rows.length} states</Badge>
          {breakdownRows.length > 5 ? (
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => setIsExpanded((current) => !current)}
            >
              {isExpanded ? 'Less' : `+${hiddenCount}`}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {visibleRows.map(({ amountEntry, countEntry, status }) => (
          <div
            className="min-h-[5.15rem] rounded-[0.75rem] border border-border bg-surface-muted/35 px-2.5 py-2"
            key={status}
          >
            <Badge tone={statusTone(status)}>{humanizeCode(status)}</Badge>
            <p className="mt-1.5 text-base font-semibold text-foreground">
              {countEntry ? formatValue(countEntry[0], countEntry[1]) : '0'}
            </p>
            {amountEntry ? (
              <p className="truncate text-xs text-muted">
                {fieldLabel(amountEntry[0])}: {formatValue(amountEntry[0], amountEntry[1])}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
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
    return <RefreshCcw className="size-4 animate-spin text-info motion-reduce:animate-none" />
  }

  return <Clock3 className="size-4 text-warning" />
}

function ExportStatusPanel({
  exportData,
  isLoading,
  isError,
  errorMessage,
  onOpenDetail,
  onRefresh,
  onOpenDownload,
}: {
  exportData?: ReportExport
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  onOpenDetail: (exportId: string) => void
  onRefresh: () => void
  onOpenDownload: (url: string) => void
}) {
  if (isLoading && !exportData) {
    return (
      <div className="rounded-[0.875rem] border border-border bg-surface p-3">
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
  const canDownload =
    Boolean(downloadUrl) && exportData.availableActions.includes('DOWNLOAD_FILE')
  const canRefresh = exportData.availableActions.includes('REFRESH_STATUS')

  return (
    <section className="space-y-3 rounded-[0.875rem] border border-border bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {statusIcon(exportData.status)}
            <h2 className="text-sm font-semibold text-foreground">
              Export {compactId(exportData.exportId)}
            </h2>
            <Badge tone={statusTone(exportData.status)}>{humanizeCode(exportData.status)}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {reportCatalog[exportData.reportType].label} / {exportData.format}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            title="Open export detail"
            variant="secondary"
            onClick={() => onOpenDetail(exportData.exportId)}
          >
            <ExternalLink className="mr-2 size-4" />
            Detail
          </Button>
          <Button
            disabled={isLoading || !canRefresh}
            size="sm"
            title="Refresh export status"
            variant="secondary"
            onClick={onRefresh}
          >
            <RefreshCcw className="mr-2 size-4" />
            Refresh
          </Button>
          <Button
            disabled={!canDownload}
            size="sm"
            title="Open signed download"
            onClick={() => canDownload && downloadUrl && onOpenDownload(downloadUrl)}
          >
            <ExternalLink className="mr-2 size-4" />
            Download
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Queued" value={formatDateSafe(exportData.lifecycle.queuedAt)} />
        <MetricCard
          label="Rows"
          value={exportData.rowCount === null ? 'Pending' : formatNumber(exportData.rowCount)}
        />
        <MetricCard label="Provider" value={humanizeCode(exportData.download.providerStatus)} />
        <MetricCard
          label="Expires"
          value={
            exportData.download.expiresAt
              ? formatDateSafe(exportData.download.expiresAt)
              : 'Not available'
          }
        />
      </div>

      {exportData.failureReason ? <InlineAlert message={exportData.failureReason} /> : null}
      {exportData.download.warnings.length ? (
        <div className="space-y-2">
          {exportData.download.warnings.map((warning) => (
            <div
              className="flex items-start gap-2 rounded-[0.75rem] border border-warning/20 bg-warning/5 p-3 text-sm text-warning"
              key={warning}
            >
              <TriangleAlert className="mt-0.5 size-4" />
              <span>{humanizeCode(warning)}</span>
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
            warnings={0}
          />
          {hasInlineRows ? (
            <DynamicTable
              bodyMaxHeight={320}
              columns={buildPreviewColumns(exportData.result.rows as ReportRow[])}
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

function ReportRowsTable({
  getRowActions,
  columns,
  isSelected,
  onOpenAction,
  onSelect,
  rows,
}: {
  getRowActions: (row: ReportRow) => ReportRowHandoff[]
  columns: string[]
  isSelected: (id: string) => boolean
  onOpenAction: (path: string) => void
  onSelect: (id: string, selected: boolean) => void
  rows: SelectableReportRow[]
}) {
  return (
    <div>
      {rows.map(({ id, row }, index) => {
        const rowActions = getRowActions(row)

        return (
          <article
            aria-selected={isSelected(id)}
            className={cn(
              'workbench-grid-row grid min-w-0 gap-3 border-b border-border bg-surface px-3 py-2.5 last:border-b-0 xl:grid-cols-[var(--report-grid-template)] xl:items-center',
              isSelected(id) && 'bg-primary/5',
            )}
            key={id}
          >
            <div className="flex min-w-0 items-start xl:items-center">
              <ListSelectionCheckbox
                checked={isSelected(id)}
                label={`Select report row ${index + 1}`}
                onChange={(selected) => onSelect(id, selected)}
              />
            </div>
            {columns.map((columnId) => (
              <div className="min-w-0 text-sm" key={columnId}>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-muted xl:hidden">
                  {fieldLabel(columnId)}
                </span>
                <div className="line-clamp-2 break-words text-foreground">
                  {formatValue(columnId, row[columnId])}
                </div>
              </div>
            ))}
            <div className="workbench-sticky-action-cell min-w-0 pl-2 text-sm xl:flex xl:items-center xl:justify-end">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-muted xl:hidden">
                Related
              </span>
              {rowActions.length ? (
                <div className="flex min-w-0 flex-wrap gap-1.5 xl:justify-end">
                  {rowActions.map((action) => (
                    <Button
                      key={action.key}
                      size="sm"
                      title={`Open ${action.label}`}
                      type="button"
                      variant="secondary"
                      onClick={() => onOpenAction(action.path)}
                    >
                      <ExternalLink className="mr-2 size-4" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <Badge tone="neutral">No direct link</Badge>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function ReportsPage({
  initialReportType = 'ORDER_LIFECYCLE',
  mode = 'list',
}: {
  initialReportType?: AdminReportType
  mode?: ReportsPageMode
}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialExportId = searchParams.get('exportId') ?? ''
  const canExport = usePermission('reports:export')
  const canReadCustomers = usePermission('customers:read')
  const canReadOrders = usePermission('orders:read')
  const canReadPayments = usePermission('payments:read')
  const canReadPayouts = usePermission('payouts:read')
  const canReadVendors = usePermission('vendors:read')
  const [reportType, setReportType] = useState<AdminReportType>(initialReportType)
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') ?? '')
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [selectedVendors, setSelectedVendors] = useState<LookupOption[]>(() =>
    readLookupOptionsFromSearchParams(searchParams, 'vendorId', 'vendorLabel'),
  )
  const [selectedCategories, setSelectedCategories] = useState<LookupOption[]>(() =>
    readLookupOptionsFromSearchParams(searchParams, 'categoryId', 'categoryLabel'),
  )
  const [selectedCustomers, setSelectedCustomers] = useState<LookupOption[]>(() =>
    reportSupportsCustomerFilter(initialReportType)
      ? readLookupOptionsFromSearchParams(searchParams, 'customerId', 'customerLabel')
      : [],
  )
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() =>
    readReportStatuses(searchParams, initialReportType),
  )
  const [limit, setLimit] = useState(() => searchParams.get('limit') ?? '20')
  const [rowSearch, setRowSearch] = useState('')
  const [format, setFormat] = useState<ReportExportFormat>(() =>
    readReportFormat(searchParams),
  )
  const [reason, setReason] = useState('')
  const [selectedExportId, setSelectedExportId] = useState(initialExportId)
  const [trackedExportIds, setTrackedExportIds] = useState<string[]>(() =>
    initialExportId ? [initialExportId] : [],
  )
  const [trackingExportId, setTrackingExportId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [exportPanelOpen, setExportPanelOpen] = useState(() => Boolean(initialExportId))
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [visibleColumnsByReport, setVisibleColumnsByReport] = useState<
    Partial<Record<AdminReportType, string[]>>
  >({})
  const [columnWidths, setColumnWidths] =
    useState<ReportColumnWidths>(loadReportColumnWidths)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)
  const exportPanelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        REPORT_COLUMN_WIDTH_STORAGE_KEY,
        JSON.stringify(columnWidths),
      )
    } catch {
      // Width persistence is optional; the table still works without storage.
    }
  }, [columnWidths])

  useEffect(() => {
    if (!columnsOpen) return undefined

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

  useEffect(() => {
    if (!exportPanelOpen) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExportPanelOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [exportPanelOpen])

  const activeReport = reportCatalog[reportType]
  const categoryIds = useMemo(
    () => selectedCategories.map((category) => category.value),
    [selectedCategories],
  )
  const vendorIds = useMemo(
    () => selectedVendors.map((vendor) => vendor.value),
    [selectedVendors],
  )
  const customerIds = useMemo(
    () => selectedCustomers.map((customer) => customer.value),
    [selectedCustomers],
  )
  const dateError = getDateRangeError(dateFrom, dateTo)
  const limitError = getLimitError(limit)
  const parsedLimit = limit.trim() ? Number(limit) : 20
  const filterError = dateError ?? limitError

  const query = useMemo<ReportQueryParams>(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      city: city.trim() || undefined,
      vendorId: vendorIds.length > 0 ? vendorIds : undefined,
      categoryId: categoryIds.length > 0 ? categoryIds : undefined,
      customerId:
        reportSupportsCustomerFilter(reportType) && customerIds.length > 0
          ? customerIds
          : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      limit: Number.isInteger(parsedLimit) ? parsedLimit : 20,
    }),
    [
      categoryIds,
      city,
      customerIds,
      dateFrom,
      dateTo,
      parsedLimit,
      reportType,
      selectedStatuses,
      vendorIds,
    ],
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

  const reportData: ReportData | undefined = reportQuery.data?.data
  const rows = reportData?.rows ?? emptyReportRows
  const filteredRows = useMemo(
    () => rows.filter((row) => rowMatchesSearch(row, rowSearch)),
    [rows, rowSearch],
  )
  const selectableRows = useMemo<SelectableReportRow[]>(
    () =>
      filteredRows.map((row, index) => ({
        id: rowId(row, index, reportType),
        row,
      })),
    [filteredRows, reportType],
  )
  const reportSelection = useListSelection(selectableRows, (row) => row.id)
  const reportColumns = useMemo(() => getReportColumnKeys(rows), [rows])
  const visibleColumns = useMemo(() => {
    const savedColumns =
      visibleColumnsByReport[reportType]?.filter((column) =>
        reportColumns.includes(column),
      ) ?? []

    return savedColumns.length > 0 ? savedColumns : defaultVisibleColumns(reportColumns)
  }, [reportColumns, reportType, visibleColumnsByReport])
  const reportGridStyle = useMemo<ReportGridStyle>(
    () => ({
      '--report-grid-template': getReportGridTemplate(
        reportType,
        visibleColumns,
        columnWidths,
      ),
      '--report-grid-min-width': getReportGridMinWidth(
        reportType,
        visibleColumns,
        columnWidths,
      ),
    }),
    [columnWidths, reportType, visibleColumns],
  )
  const rowHandoffAccess = useMemo(
    () => ({
      canReadCustomers,
      canReadOrders,
      canReadPayments,
      canReadPayouts,
      canReadVendors,
    }),
    [
      canReadCustomers,
      canReadOrders,
      canReadPayments,
      canReadPayouts,
      canReadVendors,
    ],
  )
  const operationsDrilldown = useMemo(
    () =>
      buildReportOperationsDrilldown(
        reportType,
        {
          city,
          dateFrom,
          dateTo,
          selectedCategories,
          selectedCustomers,
          selectedStatuses,
          selectedVendors,
        },
        {
          canReadOrders,
          canReadPayments,
          canReadPayouts,
          canReadVendors,
        },
      ),
    [
      canReadOrders,
      canReadPayments,
      canReadPayouts,
      canReadVendors,
      city,
      dateFrom,
      dateTo,
      reportType,
      selectedCategories,
      selectedCustomers,
      selectedStatuses,
      selectedVendors,
    ],
  )
  const exportErrorMessage = exportQuery.error ? mapApiError(exportQuery.error) : undefined
  const reportErrorMessage = reportQuery.error ? mapApiError(reportQuery.error) : undefined
  const reasonError =
    reason.trim() && reason.trim().length < 5
      ? 'Export reason must be at least 5 characters.'
      : null
  const canQueueExport = canExport && !filterError && !reasonError && reason.trim().length >= 5
  const isInitialLoading = reportQuery.isLoading && !reportQuery.data
  const isRefreshing = reportQuery.isFetching && Boolean(reportQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing now'
    : formatRefreshTime(reportQuery.dataUpdatedAt)
  const hasActiveFilters = Boolean(
    city ||
      dateFrom ||
      dateTo ||
      categoryIds.length > 0 ||
      vendorIds.length > 0 ||
      customerIds.length > 0 ||
      selectedStatuses.length > 0 ||
      rowSearch ||
      limit !== '20',
  )

  const clearSeededReportParams = () => {
    const seededKeys = [
      'categoryId',
      'categoryLabel',
      'city',
      'customerId',
      'customerLabel',
      'dateFrom',
      'dateTo',
      'exportId',
      'format',
      'limit',
      'status',
      'vendorId',
      'vendorLabel',
    ]

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const rememberExport = (exportId: string) => {
    const trimmedId = exportId.trim()

    if (!trimmedId) {
      return
    }

    setSelectedExportId(trimmedId)
    setExportPanelOpen(true)
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

  const activeExportData =
    exportQuery.data?.data ??
    (exportMutation.data?.data.exportId === selectedExportId
      ? exportMutation.data.data
      : undefined)
  const activeExportMutationError = exportMutation.error
    ? mapApiError(exportMutation.error)
    : null

  const selectReportType = (nextReportType: AdminReportType) => {
    clearSeededReportParams()
    setReportType(nextReportType)
    setSelectedStatuses([])
    setRowSearch('')
    setColumnsOpen(false)

    if (!reportSupportsCustomerFilter(nextReportType)) {
      setSelectedCustomers([])
    }

    if (mode === 'detail') {
      navigate(`${routePaths.reports}/${reportSlugByType[nextReportType]}`)
    }
  }

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

  const openReportRowAction = (path: string) => {
    navigate(path)
  }

  const clearFilters = () => {
    clearSeededReportParams()
    setDateFrom('')
    setDateTo('')
    setCity('')
    setSelectedVendors([])
    setSelectedCategories([])
    setSelectedCustomers([])
    setSelectedStatuses([])
    setLimit('20')
    setRowSearch('')
    setFormError(null)
  }

  const toggleColumn = (columnId: string) => {
    setVisibleColumnsByReport((current) => {
      const currentColumns = current[reportType] ?? defaultVisibleColumns(reportColumns)

      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return current

        return {
          ...current,
          [reportType]: currentColumns.filter((column) => column !== columnId),
        }
      }

      return {
        ...current,
        [reportType]: [...currentColumns, columnId],
      }
    })
  }

  const startColumnResize = (
    columnId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getReportColumnWidth(reportType, columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [reportColumnStorageKey(reportType, columnId)]: Math.max(
          getReportColumnMinWidth(columnId),
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

  const resetColumnWidth = (columnId: string) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [reportColumnStorageKey(reportType, columnId)]: REPORT_DEFAULT_COLUMN_WIDTH,
    }))
  }

  const adjustColumnWidth = (columnId: string, delta: number) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [reportColumnStorageKey(reportType, columnId)]: Math.max(
        getReportColumnMinWidth(columnId),
        getReportColumnWidth(reportType, currentWidths, columnId) + delta,
      ),
    }))
  }

  const header =
    mode === 'detail' ? (
      <DetailPageHeader
        description="Filter, inspect, and export this operational report."
        listHref={routePaths.reports}
        listLabel="Reports"
        recordName={activeReport.label}
        title={activeReport.label}
        titleMetaNode={<Badge tone="info">Report</Badge>}
      />
    ) : (
      <PageContextHeader
        description="Operational report views and async export jobs."
        layout="workspace"
        placement="topbar"
        title="Reports"
      />
    )

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      {header}

      <div className="flex flex-col gap-3 xl:min-h-0 xl:flex-1">
        {!canExport ? (
          <InlineAlert message="Your role can view reports but cannot queue or track exports." />
        ) : null}

        {reportData ? (
          <MetricStrip
            generatedAt={reportData.generatedAt}
            rowCount={reportData.rowCount}
            summary={reportData.summary}
            warnings={reportData.warnings.length}
          />
        ) : null}

        {reportData?.byStatus ? <StatusBreakdown rows={reportData.byStatus} /> : null}

        <section
          className={cn(
            'grid min-h-[28rem] gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-stretch xl:overflow-hidden',
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
                  aria-label="Expand report filters"
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
                      Report views
                    </h2>
                    <button
                      aria-label="Collapse report filters"
                      className="btn-icon"
                      title="Collapse filters"
                      type="button"
                      onClick={() => setFiltersCollapsed(true)}
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {reportTypes.map((type) => (
                      <button
                        className={cn(
                          'flex min-h-10 w-full items-center justify-between rounded-[0.75rem] border px-3 text-left text-sm transition',
                          type === reportType
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-surface-muted/50 text-foreground hover:border-primary/35',
                        )}
                        key={type}
                        type="button"
                        onClick={() => selectReportType(type)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {reportCatalog[type].label}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {reportCatalog[type].description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Filter stack
                    </h3>
                    {hasActiveFilters ? (
                      <button
                        className="text-xs font-semibold text-primary hover:underline"
                        type="button"
                        onClick={clearFilters}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-2.5">
                    {activeReport.statusOptions.length ? (
                      <MultiSelectFilter
                        label="Status"
                        options={statusOptionsForReport(reportType)}
                        placeholder="All statuses"
                        searchPlaceholder="Search status"
                        values={selectedStatuses}
                        onChange={(values) => {
                          clearSeededReportParams()
                          setSelectedStatuses(values)
                        }}
                      />
                    ) : null}

                    <LookupMultiSelect
                      fetchOptions={searchCategoryLookupOptions}
                      label="Category"
                      placeholder="All categories"
                      queryKey={['report-category-lookup']}
                      selectedOptions={selectedCategories}
                      onChange={(options) => {
                        clearSeededReportParams()
                        setSelectedCategories(options)
                        setSelectedVendors([])
                      }}
                    />

                    <LookupMultiSelect
                      fetchOptions={(search) =>
                        searchVendorLookupOptions(search, { categoryIds })
                      }
                      label="Vendor"
                      placeholder={
                        categoryIds.length ? 'Vendors in selected categories' : 'All vendors'
                      }
                      queryKey={['report-vendor-lookup', categoryIds.join(',')]}
                      selectedOptions={selectedVendors}
                      onChange={(options) => {
                        clearSeededReportParams()
                        setSelectedVendors(options)
                      }}
                    />

                    {reportSupportsCustomerFilter(reportType) ? (
                      <LookupMultiSelect
                        fetchOptions={searchCustomerLookupOptions}
                        label="Customer"
                        placeholder="All customers"
                        queryKey={['report-customer-lookup']}
                        selectedOptions={selectedCustomers}
                        onChange={(options) => {
                          clearSeededReportParams()
                          setSelectedCustomers(options)
                        }}
                      />
                    ) : null}

                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">City</span>
                      <Input
                        className="h-10"
                        placeholder="City"
                        value={city}
                        onChange={(event) => {
                          clearSeededReportParams()
                          setCity(event.target.value)
                        }}
                      />
                    </label>

                    <div className="grid grid-cols-1 gap-2">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">
                          Date from
                        </span>
                        <Input
                          className="h-10"
                          type="datetime-local"
                          value={dateFrom}
                          onChange={(event) => {
                            clearSeededReportParams()
                            setDateFrom(event.target.value)
                          }}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">
                          Date to
                        </span>
                        <Input
                          className="h-10"
                          type="datetime-local"
                          value={dateTo}
                          onChange={(event) => {
                            clearSeededReportParams()
                            setDateTo(event.target.value)
                          }}
                        />
                      </label>
                    </div>

                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">Limit</span>
                      <Input
                        className="h-10"
                        max={100}
                        min={1}
                        type="number"
                        value={limit}
                        onChange={(event) => {
                          clearSeededReportParams()
                          setLimit(event.target.value)
                        }}
                      />
                    </label>
                  </div>
                </div>

                {canExport ? (
                  <div className="border-t border-border pt-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Export
                    </h3>
                    <div className="mt-3 space-y-2.5">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">
                          Format
                        </span>
                        <select
                          className="form-input h-10"
                          value={format}
                          onChange={(event) => {
                            clearSeededReportParams()
                            setFormat(event.target.value as ReportExportFormat)
                          }}
                        >
                          {exportFormats.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">
                          Reason
                        </span>
                        <Input
                          className="h-10"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                        />
                      </label>
                      <Button
                        className="w-full justify-center"
                        disabled={!canQueueExport}
                        isLoading={exportMutation.isPending}
                        size="sm"
                        type="button"
                        onClick={queueExport}
                      >
                        <Download className="mr-2 size-4" />
                        Queue Export
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </aside>

          <main id="report-rows" className="scroll-mt-4 flex min-h-[26rem] min-w-0 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {activeReport.label}
                </h2>
                <p className="text-sm text-muted">
                  {reportData
                    ? `${filteredRows.length} visible rows of ${reportData.rowCount} report rows`
                    : activeReport.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  className="w-full sm:w-72 lg:w-80"
                  placeholder="Search report rows"
                  value={rowSearch}
                  onChange={setRowSearch}
                />
                <span
                  className={cn(
                    'text-xs font-medium',
                    isRefreshing ? 'text-primary' : 'text-muted',
                  )}
                >
                  {refreshStatusLabel}
                </span>
                {mode === 'list' ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      navigate(`${routePaths.reports}/${reportSlugByType[reportType]}`)
                    }
                  >
                    <ExternalLink className="mr-2 size-4" />
                    Detail
                  </Button>
                ) : null}
                {operationsDrilldown ? (
                  <Button
                    size="sm"
                    title={operationsDrilldown.description}
                    type="button"
                    variant="secondary"
                    onClick={() => navigate(operationsDrilldown.path)}
                  >
                    <ExternalLink className="mr-2 size-4" />
                    {operationsDrilldown.label}
                  </Button>
                ) : null}
                {canExport ? (
                  <Button
                    aria-expanded={exportPanelOpen}
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => setExportPanelOpen(true)}
                  >
                    <Eye className="mr-2 size-4" />
                    Exports
                    {trackedExportIds.length ? (
                      <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                        {trackedExportIds.length}
                      </span>
                    ) : null}
                  </Button>
                ) : null}
                <div className="relative" ref={columnsMenuRef}>
                  <Button
                    aria-expanded={columnsOpen}
                    aria-haspopup="menu"
                    disabled={reportColumns.length === 0}
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
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] max-h-80 w-64 overflow-y-auto rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
                      role="menu"
                    >
                      <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-normal text-muted">
                        Visible columns
                      </p>
                      {reportColumns.map((columnId) => {
                        const isChecked = visibleColumns.includes(columnId)
                        const isRequiredLastColumn =
                          isChecked && visibleColumns.length === 1

                        return (
                          <label
                            className={cn(
                              'flex min-h-9 cursor-pointer items-center gap-2 rounded-[0.65rem] px-2 text-sm text-foreground hover:bg-surface-muted',
                              isRequiredLastColumn && 'cursor-not-allowed opacity-60',
                            )}
                            key={columnId}
                          >
                            <input
                              checked={isChecked}
                              className="size-4 accent-[color:var(--adaptive-primary)]"
                              disabled={isRequiredLastColumn}
                              type="checkbox"
                              onChange={() => toggleColumn(columnId)}
                            />
                            <span className="truncate">{fieldLabel(columnId)}</span>
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
                  onClick={() => void reportQuery.refetch()}
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

            {filterError ? <InlineAlert message={filterError} /> : null}
            {reasonError ? <InlineAlert message={reasonError} /> : null}
            {formError ? <InlineAlert message={formError} /> : null}
            {activeExportMutationError ? <InlineAlert message={activeExportMutationError} /> : null}
            {reportData?.warnings.length ? (
              <div className="space-y-2 p-3">
                {reportData.warnings.map((warning) => (
                  <div
                    className="flex items-start gap-2 rounded-[0.75rem] border border-warning/20 bg-warning/5 p-3 text-sm text-warning"
                    key={warning}
                  >
                    <TriangleAlert className="mt-0.5 size-4" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {reportQuery.isError || filterError ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ErrorState
                  description={reportErrorMessage ?? filterError ?? 'We could not load this report.'}
                  title="Report unavailable"
                  onRetry={() => void reportQuery.refetch()}
                />
              </div>
            ) : isInitialLoading ? (
              <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <TableSkeleton columnCount={7} rowCount={8} />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <EmptyState description="No report rows matched this filter." title="No report rows" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <EmptyState description="No visible rows match the table search." title="No matching rows" />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-[20rem] overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--report-grid-min-width)]"
                    style={reportGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden gap-3 border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid xl:grid-cols-[var(--report-grid-template)]">
                      <div className="flex min-w-0 items-center">
                        <ListSelectionCheckbox
                          checked={reportSelection.allVisibleSelected}
                          indeterminate={reportSelection.someVisibleSelected}
                          label="Select visible report rows"
                          onChange={reportSelection.setVisibleSelected}
                        />
                      </div>
                      {visibleColumns.map((columnId) => (
                        <div
                          className="relative flex min-w-0 items-center pr-3"
                          key={columnId}
                        >
                          <span className="truncate">{fieldLabel(columnId)}</span>
                          <button
                            aria-label={`Resize ${fieldLabel(columnId)} column`}
                            className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Drag to resize"
                            type="button"
                            onDoubleClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              resetColumnWidth(columnId)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'ArrowLeft') {
                                event.preventDefault()
                                adjustColumnWidth(columnId, -16)
                              }

                              if (event.key === 'ArrowRight') {
                                event.preventDefault()
                                adjustColumnWidth(columnId, 16)
                              }
                            }}
                            onPointerDown={(event) =>
                              startColumnResize(columnId, event)
                            }
                          >
                            <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                          </button>
                        </div>
                      ))}
                      <div className="workbench-sticky-action-head flex min-w-0 pr-3">
                        <span>Related</span>
                      </div>
                    </div>
                    <ListSelectionToolbar
                      allVisibleSelected={reportSelection.allVisibleSelected}
                      selectedCount={reportSelection.selectedCount}
                      visibleCount={reportSelection.visibleCount}
                      onClear={reportSelection.clearSelection}
                      onSelectVisible={() => reportSelection.setVisibleSelected(true)}
                    />

                    <ReportRowsTable
                      columns={visibleColumns}
                      getRowActions={(row) =>
                        buildReportRowHandoffs(row, rowHandoffAccess)
                      }
                      isSelected={reportSelection.isSelected}
                      onOpenAction={openReportRowAction}
                      rows={selectableRows}
                      onSelect={reportSelection.setItemSelected}
                    />
                  </div>
                </div>
              </div>
            )}
          </main>
        </section>

      </div>

      {canExport && exportPanelOpen ? (
        <div className="fixed inset-0 z-[90]">
          <button
            aria-label="Close exports"
            className="absolute inset-0 bg-foreground/20"
            type="button"
            onClick={() => setExportPanelOpen(false)}
          />
          <aside
            aria-label="Report exports"
            aria-modal="true"
            className="absolute inset-y-0 right-0 flex w-full max-w-[34rem] flex-col border-l border-border bg-surface shadow-surface"
            ref={exportPanelRef}
            role="dialog"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Exports</h2>
                <p className="text-sm text-muted">Track and download queued report files.</p>
              </div>
              <button
                aria-label="Close exports"
                className="btn-icon"
                title="Close"
                type="button"
                onClick={() => setExportPanelOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="rounded-[0.875rem] border border-border bg-surface-muted/35 p-3">
                <div className="flex items-end gap-2">
                  <label className="min-w-0 flex-1 space-y-1">
                    <span className="text-xs font-semibold text-muted">Export ID</span>
                    <Input
                      className="h-10"
                      value={trackingExportId}
                      onChange={(event) => setTrackingExportId(event.target.value)}
                    />
                  </label>
                  <Button size="sm" title="Track export" variant="secondary" onClick={trackExport}>
                    <Eye className="mr-2 size-4" />
                    Track
                  </Button>
                </div>

                {trackedExportIds.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {trackedExportIds.map((exportId) => (
                      <button
                        className={cn(
                          'rounded-[0.75rem] border px-3 py-2 text-sm font-semibold transition',
                          exportId === selectedExportId
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-surface text-foreground hover:border-primary/60',
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
              </div>

              <ExportStatusPanel
                errorMessage={exportErrorMessage}
                exportData={activeExportData}
                isError={exportQuery.isError}
                isLoading={exportQuery.isLoading || exportQuery.isFetching}
                onOpenDetail={(exportId) =>
                  navigate(`${routePaths.reports}/exports/${exportId}`)
                }
                onOpenDownload={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
                onRefresh={() => void exportQuery.refetch()}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </PageContainer>
  )
}
