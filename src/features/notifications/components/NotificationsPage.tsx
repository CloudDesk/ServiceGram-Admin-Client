import {
  ArrowUpRight,
  BellPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  ListFilter,
  Mail,
  MessageSquareText,
  Pencil,
  RefreshCcw,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Smartphone,
  TriangleAlert,
  UserRound,
  X,
} from 'lucide-react'
import type {
  CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DynamicTable, TableSkeleton, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { ListHeaderSearch } from '../../../components/ui/ListHeaderSearch'
import {
  LIST_SELECTION_COLUMN_WIDTH,
  ListSelectionCheckbox,
  ListSelectionToolbar,
} from '../../../components/ui/ListSelection'
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import {
  QuickPreviewActions,
  QuickPreviewFact,
  QuickPreviewFactGrid,
  QuickPreviewTabs,
  type QuickPreviewAction,
} from '../../../components/ui/QuickPreview'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import type { LookupOption } from '../../../types/lookup.types'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { notificationService } from '../services/notification.service'
import type {
  NotificationChannel,
  NotificationEvent,
  NotificationEventStatus,
  NotificationEventsResponse,
  NotificationEventsQueryParams,
  NotificationRecipientType,
  NotificationTemplate,
  NotificationTemplatesQueryParams,
  UpdateNotificationTemplatePayload,
} from '../types/notification.types'

const DEFAULT_PAGE_SIZE = 10
const NOTIFICATION_DEFAULT_COLUMN_WIDTH = 220
const NOTIFICATION_GRID_COLUMN_GAP = 12
const NOTIFICATION_GRID_INLINE_PADDING = 24
const NOTIFICATION_COLUMN_WIDTH_STORAGE_KEY =
  'servicegram.notification.columnWidths.v2'

const channels: NotificationChannel[] = ['PUSH', 'SMS', 'EMAIL']
const recipientTypes: NotificationRecipientType[] = ['CUSTOMER', 'VENDOR', 'ADMIN']
const statuses: NotificationEventStatus[] = ['QUEUED', 'SENT', 'FAILED', 'SKIPPED']

const notificationDataColumns = [
  {
    id: 'event',
    label: 'Event',
    defaultWidth: 220,
    minWidth: 190,
  },
  {
    id: 'recipient',
    label: 'Recipient',
    defaultWidth: 220,
    minWidth: 190,
  },
  {
    id: 'status',
    label: 'Status',
    defaultWidth: 150,
    minWidth: 130,
  },
  {
    id: 'channel',
    label: 'Channel',
    defaultWidth: 120,
    minWidth: 112,
  },
  {
    id: 'message',
    label: 'Message',
    defaultWidth: 260,
    minWidth: 220,
  },
  {
    id: 'retry',
    label: 'Retry',
    defaultWidth: 200,
    minWidth: 180,
  },
  {
    id: 'provider',
    label: 'Provider',
    defaultWidth: 220,
    minWidth: 190,
  },
  {
    id: 'readAt',
    label: 'Read',
    defaultWidth: 190,
    minWidth: 160,
  },
  {
    id: 'createdAt',
    label: 'Created',
    defaultWidth: 190,
    minWidth: 160,
  },
] as const

const defaultNotificationColumns: NotificationColumnId[] = [
  'event',
  'recipient',
  'status',
  'channel',
  'message',
  'createdAt',
]
const EMPTY_NOTIFICATION_EVENTS: NotificationEvent[] = []
const EMPTY_NOTIFICATION_TEMPLATES: NotificationTemplate[] = []

type ActiveFilter = '' | 'true' | 'false'
type NotificationColumnId = (typeof notificationDataColumns)[number]['id']
type NotificationColumnWidths = Partial<Record<NotificationColumnId, number>>
type NotificationQueueKey =
  | 'all'
  | 'custom'
  | 'needsReview'
  | 'queued'
  | 'sent'
  | 'skipped'
type NotificationPreviewTab = 'summary' | 'message' | 'links'
type NotificationTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning'

interface NotificationGridStyle extends CSSProperties {
  '--notification-grid-template': string
  '--notification-grid-min-width': string
}

interface NotificationMetric {
  label: string
  meta: string
  tone: NotificationTone
  value: string
}

interface NotificationQueueCounts {
  all: number
  needsReview: number
  queued: number
  sent: number
  skipped: number
}

const templateColumns: DynamicTableColumn<NotificationTemplate>[] = [
  {
    key: 'templateCode',
    label: 'Template',
    minWidth: 280,
    renderCell: (template) => (
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{template.templateCode}</p>
        <p className="line-clamp-1 text-xs text-muted">
          {template.titleTemplate ?? 'No title template'}
        </p>
        <p className="line-clamp-1 text-xs text-muted">{template.bodyTemplate}</p>
      </div>
    ),
  },
  {
    key: 'channel',
    label: 'Channel',
    minWidth: 120,
    renderCell: (template) => <Badge tone="info">{template.channel}</Badge>,
  },
  {
    key: 'isActive',
    label: 'State',
    minWidth: 120,
    renderCell: (template) => (
      <Badge tone={template.isActive ? 'success' : 'warning'}>
        {template.isActive ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    key: 'warnings',
    label: 'Warnings',
    minWidth: 180,
    renderCell: (template) =>
      template.warnings.length ? (
        <div className="flex flex-wrap gap-1">
          {template.warnings.map((warning) => (
            <Badge key={warning} tone="warning">
              {humanizeCode(warning)}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted">None</span>
      ),
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    minWidth: 180,
    renderCell: (template) => formatDateSafe(template.updatedAt),
  },
]

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

function statusTone(status: NotificationEventStatus): StatusTone {
  if (status === 'SENT') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'QUEUED') return 'warning'
  return 'neutral'
}

function channelIcon(channel: NotificationChannel) {
  if (channel === 'EMAIL') return <Mail className="size-4" />
  if (channel === 'SMS') return <MessageSquareText className="size-4" />
  return <Smartphone className="size-4" />
}

function notificationSignalTone(event: NotificationEvent): NotificationTone {
  if (event.status === 'FAILED') return 'danger'
  if (event.deliveryRetry?.exhausted) return 'danger'
  if (event.warnings.length > 0) return 'warning'
  if (event.status === 'QUEUED') return 'warning'
  if (event.status === 'SENT') return 'success'
  return 'neutral'
}

function notificationSignalLabel(event: NotificationEvent) {
  if (event.status === 'FAILED') return 'Delivery failed'
  if (event.deliveryRetry?.exhausted) return 'Retries exhausted'
  if (event.warnings.length > 0) return 'Review warnings'
  if (event.status === 'QUEUED') return 'Waiting in queue'
  if (event.status === 'SENT') return 'Sent'
  if (event.status === 'SKIPPED') return 'Skipped'
  return 'Delivery state'
}

function notificationSignalMeta(event: NotificationEvent) {
  if (event.failureReason) return humanizeCode(event.failureReason)
  if (event.deliveryRetry?.nextRetryAt) {
    return `Next retry ${formatDateSafe(event.deliveryRetry.nextRetryAt)}`
  }
  if (event.sentAt) return `Sent ${formatDateSafe(event.sentAt)}`
  if (event.status === 'QUEUED') return 'Queued with the provider pipeline.'
  if (event.status === 'SKIPPED') return 'Skipped by targeting or provider rules.'
  return 'No warning signals are attached.'
}

function retrySummaryLabel(event: NotificationEvent) {
  const retry = event.deliveryRetry

  if (!retry) return 'None'
  if (retry.exhausted) return 'Exhausted'
  if (retry.nextRetryAt) return `${retry.attemptNumber}/${retry.maxAttempts}`
  return humanizeCode(retry.lastProviderStatus)
}

function metricToneClass(tone: NotificationTone) {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
}

function buildLookupOptions<TValue extends string>(values: readonly TValue[]): LookupOption[] {
  return values.map((value) => ({
    label: humanizeCode(value),
    value,
  }))
}

function readSearchList(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

function readSearchEnumList<TValue extends string>(
  searchParams: URLSearchParams,
  key: string,
  allowedValues: readonly TValue[],
) {
  const allowed = new Set<string>(allowedValues)

  return readSearchList(searchParams, key).filter((value): value is TValue =>
    allowed.has(value),
  )
}

function readSearchEnum<TValue extends string>(
  searchParams: URLSearchParams,
  key: string,
  allowedValues: readonly TValue[],
) {
  return readSearchEnumList(searchParams, key, allowedValues)[0] ?? ''
}

function queueKeyForStatuses(
  selectedStatuses: NotificationEventStatus[],
): NotificationQueueKey {
  if (selectedStatuses.length === 0) return 'all'
  if (selectedStatuses.length > 1) return 'custom'

  const [status] = selectedStatuses

  if (status === 'FAILED') return 'needsReview'
  if (status === 'QUEUED') return 'queued'
  if (status === 'SENT') return 'sent'
  if (status === 'SKIPPED') return 'skipped'

  return 'custom'
}

function getNotificationColumnDefaultWidth(columnId: NotificationColumnId) {
  return (
    notificationDataColumns.find((column) => column.id === columnId)
      ?.defaultWidth ?? NOTIFICATION_DEFAULT_COLUMN_WIDTH
  )
}

function getNotificationColumnMinWidth(columnId: NotificationColumnId) {
  return notificationDataColumns.find((column) => column.id === columnId)?.minWidth ?? 140
}

function getNotificationColumnWidth(
  columnWidths: NotificationColumnWidths,
  columnId: NotificationColumnId,
) {
  return Math.max(
    getNotificationColumnMinWidth(columnId),
    columnWidths[columnId] ?? getNotificationColumnDefaultWidth(columnId),
  )
}

function getNotificationGridTemplate(
  visibleColumns: NotificationColumnId[],
  columnWidths: NotificationColumnWidths,
) {
  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...visibleColumns.map(
      (columnId) => `${getNotificationColumnWidth(columnWidths, columnId)}px`,
    ),
  ].join(' ')
}

function getNotificationGridMinWidth(
  visibleColumns: NotificationColumnId[],
  columnWidths: NotificationColumnWidths,
) {
  const columnsWidth = visibleColumns.reduce(
    (sum, columnId) => sum + getNotificationColumnWidth(columnWidths, columnId),
    0,
  )

  return (
    columnsWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    Math.max(visibleColumns.length, 0) * NOTIFICATION_GRID_COLUMN_GAP +
    NOTIFICATION_GRID_INLINE_PADDING
  )
}

function loadColumnWidths(): NotificationColumnWidths {
  if (typeof window === 'undefined') return {}

  try {
    const rawValue = window.localStorage.getItem(
      NOTIFICATION_COLUMN_WIDTH_STORAGE_KEY,
    )

    if (!rawValue) return {}

    const parsed = JSON.parse(rawValue) as NotificationColumnWidths
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [NotificationColumnId, number] => {
        const [columnId, value] = entry
        return (
          notificationDataColumns.some((column) => column.id === columnId) &&
          typeof value === 'number' &&
          Number.isFinite(value)
        )
      }),
    )
  } catch {
    return {}
  }
}

function recipientLabel(event: NotificationEvent) {
  return (
    event.recipient?.mobileNumber ??
    event.recipient?.email ??
    event.recipientUserId ??
    'No recipient'
  )
}

function recipientDirectorySearchValue(event: NotificationEvent) {
  return (
    event.recipient?.mobileNumber ??
    event.recipient?.email ??
    event.recipientUserId ??
    ''
  )
}

function buildRecipientDirectoryPath(event: NotificationEvent) {
  const searchValue = recipientDirectorySearchValue(event)
  const params = new URLSearchParams()

  if (searchValue) {
    params.set('search', searchValue)
  }

  const queryString = params.toString()

  if (event.recipientType === 'CUSTOMER') {
    return queryString ? `${routePaths.customers}?${queryString}` : routePaths.customers
  }

  if (event.recipientType === 'VENDOR') {
    return queryString ? `${routePaths.vendors}?${queryString}` : routePaths.vendors
  }

  return queryString ? `${routePaths.adminUsers}?${queryString}` : routePaths.adminUsers
}

function buildTemplateEditorPath(event: NotificationEvent) {
  const params = new URLSearchParams({
    templateChannel: event.channel,
    templateCode: event.templateCode,
    templateEditor: '1',
  })

  return `${routePaths.notifications}?${params.toString()}#notification-templates`
}

function buildNotificationAuditPath(event: NotificationEvent) {
  const params = new URLSearchParams({
    moduleCode: 'notifications',
    entityType: 'notification_event',
    entityId: event.eventId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function buildNotificationComposerPath(event: NotificationEvent) {
  const params = new URLSearchParams({
    channel: event.channel,
    recipientType: event.recipientType,
    targetType: 'USER',
    templateCode: event.templateCode,
  })

  if (event.recipientUserId) {
    params.set('recipientUserId', event.recipientUserId)
  }

  return `${routePaths.notifications}/new?${params.toString()}`
}

function canOpenRecipientDirectory(
  event: NotificationEvent,
  permissions: {
    canReadAdminUsers: boolean
    canReadCustomers: boolean
    canReadVendors: boolean
  },
) {
  if (!recipientDirectorySearchValue(event)) return false
  if (event.recipientType === 'CUSTOMER') return permissions.canReadCustomers
  if (event.recipientType === 'VENDOR') return permissions.canReadVendors
  return permissions.canReadAdminUsers
}

function buildNotificationMetrics(
  events: NotificationEvent[],
  totalItems: number,
  queueCounts?: NotificationQueueCounts,
): NotificationMetric[] {
  const failed =
    queueCounts?.needsReview ??
    events.filter((event) => event.status === 'FAILED').length
  const queued =
    queueCounts?.queued ??
    events.filter((event) => event.status === 'QUEUED').length
  const sent =
    queueCounts?.sent ??
    events.filter((event) => event.status === 'SENT').length
  const matched = queueCounts?.all ?? totalItems

  return [
    {
      label: 'Failed',
      meta: queueCounts ? 'Failures under base filters' : 'Visible delivery failures',
      tone: failed > 0 ? 'danger' : 'neutral',
      value: String(failed),
    },
    {
      label: 'Queued',
      meta: queueCounts ? 'Queued under base filters' : 'Visible queued events',
      tone: queued > 0 ? 'warning' : 'neutral',
      value: String(queued),
    },
    {
      label: 'Sent',
      meta: queueCounts ? 'Sent under base filters' : 'Visible sent events',
      tone: 'success',
      value: String(sent),
    },
    {
      label: 'Matched events',
      meta: queueCounts
        ? 'Total matching base filters'
        : 'Total matching current filters',
      tone: 'info',
      value: String(matched),
    },
  ]
}

function buildQueueItems(counts?: NotificationQueueCounts) {
  return [
    {
      key: 'all' as const,
      label: 'All events',
      count: counts?.all,
    },
    {
      key: 'needsReview' as const,
      label: 'Needs review',
      count: counts?.needsReview,
    },
    {
      key: 'queued' as const,
      label: 'Queued',
      count: counts?.queued,
    },
    {
      key: 'sent' as const,
      label: 'Sent',
      count: counts?.sent,
    },
    {
      key: 'skipped' as const,
      label: 'Skipped',
      count: counts?.skipped,
    },
  ]
}

function queueCountsFromEventsResponse(
  response?: NotificationEventsResponse,
): NotificationQueueCounts | undefined {
  if (!response) return undefined

  const queueSummary = response.summary.queueSummary
  const byStatus = response.summary.byStatus

  return {
    all: queueSummary?.allEvents ?? response.pagination.totalItems,
    needsReview: queueSummary?.needsReview ?? byStatus.FAILED ?? 0,
    queued: queueSummary?.queued ?? byStatus.QUEUED ?? 0,
    sent: queueSummary?.sent ?? byStatus.SENT ?? 0,
    skipped: queueSummary?.skipped ?? byStatus.SKIPPED ?? 0,
  }
}

function TemplateEditModal({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  template,
}: {
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (payload: UpdateNotificationTemplatePayload) => void
  template: NotificationTemplate
}) {
  const [bodyTemplate, setBodyTemplate] = useState(template.bodyTemplate)
  const [formError, setFormError] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(template.isActive)
  const [reason, setReason] = useState('')
  const [titleTemplate, setTitleTemplate] = useState(template.titleTemplate ?? '')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (bodyTemplate.trim().length < 1) {
      setFormError('Body template is required.')
      return
    }

    if (reason.trim().length < 5) {
      setFormError('Reason must be at least 5 characters.')
      return
    }

    onSubmit({
      titleTemplate: titleTemplate.trim() || null,
      bodyTemplate: bodyTemplate.trim(),
      isActive,
      reason: reason.trim(),
    })
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-[0.875rem] border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Edit template</h2>
            <p className="mt-1 text-sm text-muted">{template.templateCode}</p>
          </div>
          <button
            aria-label="Close template editor"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Channel</span>
              <Input disabled value={template.channel} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">State</span>
              <select
                className="form-input"
                value={isActive ? 'active' : 'inactive'}
                onChange={(event) => setIsActive(event.target.value === 'active')}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Title template</span>
            <Input
              value={titleTemplate}
              onChange={(event) => setTitleTemplate(event.target.value)}
            />
            <span className="block text-right text-xs text-muted">
              {titleTemplate.length}/500
            </span>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Body template *</span>
            <textarea
              className="form-input min-h-32 resize-y"
              value={bodyTemplate}
              onChange={(event) => setBodyTemplate(event.target.value)}
            />
            <span className="block text-right text-xs text-muted">
              {bodyTemplate.length}/1000
            </span>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Reason *</span>
            <Input
              placeholder="Updating copy for clearer customer messaging"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          {formError || error ? (
            <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button isLoading={isSubmitting} size="sm" type="submit">
              Save Template
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SummaryCard({ metric }: { metric: NotificationMetric }) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <p className={cn('text-xs font-semibold uppercase tracking-normal', metricToneClass(metric.tone))}>
        {metric.label}
      </p>
      <p className={cn('mt-3 text-2xl font-semibold tracking-normal', metricToneClass(metric.tone))}>
        {metric.value}
      </p>
      <p className="mt-1 text-xs text-muted">{metric.meta}</p>
    </article>
  )
}

function NotificationPreviewSignal({
  label,
  meta,
  tone,
}: {
  label: string
  meta: string
  tone: NotificationTone
}) {
  return (
    <div
      className={cn(
        'rounded-[0.75rem] border px-3 py-2.5',
        tone === 'danger' && 'border-danger/20 bg-danger/10',
        tone === 'warning' && 'border-warning/25 bg-warning/10',
        tone === 'success' && 'border-success/20 bg-success/10',
        tone === 'info' && 'border-info/20 bg-info/10',
        tone === 'neutral' && 'border-border bg-surface-muted/45',
      )}
    >
      <div className="flex items-center gap-2">
        <TriangleAlert className={cn('size-4 shrink-0', metricToneClass(tone))} />
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
          {label}
        </p>
      </div>
      <p className="mt-1 line-clamp-2 pl-6 text-xs leading-5 text-muted">
        {meta}
      </p>
    </div>
  )
}

function NotificationPreviewField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border py-2.5 last:border-b-0 last:pb-0">
      <p className="shrink-0 text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="min-w-0 break-words text-right text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </div>
    </div>
  )
}

function NotificationPreviewPanel({
  canOpenRecipient,
  canReadAudit,
  canSendNotifications,
  canUpdateTemplates,
  event,
  onClose,
  onCompose,
  onEditTemplate,
  onFilterRecipient,
  onFilterTemplate,
  onOpenAudit,
  onOpenDetails,
  onOpenRecipient,
}: {
  canOpenRecipient: boolean
  canReadAudit: boolean
  canSendNotifications: boolean
  canUpdateTemplates: boolean
  event: NotificationEvent
  onClose: () => void
  onCompose: (event: NotificationEvent) => void
  onEditTemplate: (event: NotificationEvent) => void
  onFilterRecipient: (recipientUserId: string) => void
  onFilterTemplate: (templateCode: string) => void
  onOpenAudit: (event: NotificationEvent) => void
  onOpenDetails: (event: NotificationEvent) => void
  onOpenRecipient: (event: NotificationEvent) => void
}) {
  const [activeTab, setActiveTab] = useState<NotificationPreviewTab>('summary')
  const previewTabs: { key: NotificationPreviewTab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'message', label: 'Message' },
    { key: 'links', label: 'Links' },
  ]
  const primaryAction: QuickPreviewAction | null = canSendNotifications
    ? {
        icon: <Send className="size-4" />,
        key: 'compose',
        label: 'Compose',
        onClick: () => onCompose(event),
        variant: 'primary',
      }
    : null
  const detailAction: QuickPreviewAction = {
    icon: <Eye className="size-4" />,
    key: 'details',
    label: primaryAction ? 'Detail' : 'Open detail',
    onClick: () => onOpenDetails(event),
  }
  const secondaryActions: QuickPreviewAction[] = [
    {
      icon: <ListFilter className="size-4" />,
      key: 'template-filter',
      label: 'Template events',
      onClick: () => onFilterTemplate(event.templateCode),
      variant: 'secondary',
    },
  ]

  if (event.recipientUserId) {
    secondaryActions.push({
      icon: <UserRound className="size-4" />,
      key: 'recipient-filter',
      label: 'Recipient history',
      onClick: () => onFilterRecipient(event.recipientUserId ?? ''),
      variant: 'secondary',
    })
  }

  if (canOpenRecipient) {
    secondaryActions.push({
      icon: <ArrowUpRight className="size-4" />,
      key: 'recipient-open',
      label: 'Find recipient',
      onClick: () => onOpenRecipient(event),
      variant: 'secondary',
    })
  }

  if (canUpdateTemplates) {
    secondaryActions.push({
      icon: <Pencil className="size-4" />,
      key: 'template-edit',
      label: 'Edit template',
      onClick: () => onEditTemplate(event),
      variant: 'secondary',
    })
  }

  if (canReadAudit) {
    secondaryActions.push({
      icon: <ClipboardList className="size-4" />,
      key: 'audit',
      label: 'Audit',
      onClick: () => onOpenAudit(event),
      variant: 'secondary',
    })
  }

  return (
    <>
      <button
        aria-label="Close notification preview"
        className="fixed inset-0 z-40 bg-black/20 2xl:hidden"
        type="button"
        onClick={onClose}
      />
      <aside className="fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface sm:left-auto sm:w-[22rem] 2xl:static 2xl:z-auto 2xl:h-full 2xl:w-[22rem] 2xl:self-stretch">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted">
              Notification preview
            </p>
            <div className="mt-2 flex min-w-0 items-start gap-2.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {channelIcon(event.channel)}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {event.title ?? humanizeCode(event.templateCode)}
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {event.templateCode} / {recipientLabel(event)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Badge tone={statusTone(event.status)}>
                    {humanizeCode(event.status)}
                  </Badge>
                  <Badge tone="info">{event.channel}</Badge>
                  <Badge tone="neutral">{humanizeCode(event.recipientType)}</Badge>
                  {event.warnings.length > 0 ? (
                    <Badge tone="warning">
                      {event.warnings.length} warning
                      {event.warnings.length === 1 ? '' : 's'}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <button
            aria-label="Close preview"
            className="btn-icon shrink-0"
            title="Close preview"
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <QuickPreviewTabs
          activeTab={activeTab}
          ariaLabel="Notification preview sections"
          tabs={previewTabs}
          onChange={setActiveTab}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'summary' ? (
            <div className="space-y-2.5">
              <NotificationPreviewSignal
                label={notificationSignalLabel(event)}
                meta={notificationSignalMeta(event)}
                tone={notificationSignalTone(event)}
              />

              <QuickPreviewFactGrid>
                <QuickPreviewFact
                  label="Status"
                  tone={notificationSignalTone(event)}
                  value={humanizeCode(event.status)}
                />
                <QuickPreviewFact label="Channel" tone="info" value={event.channel} />
                <QuickPreviewFact
                  label="Retry"
                  tone={event.deliveryRetry ? 'warning' : 'neutral'}
                  value={retrySummaryLabel(event)}
                />
                <QuickPreviewFact
                  label="Recipient"
                  value={humanizeCode(event.recipientType)}
                />
              </QuickPreviewFactGrid>

              {event.failureReason || event.warnings.length > 0 ? (
                <div className="rounded-[0.75rem] border border-warning/25 bg-warning/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-normal text-warning">
                    Delivery notes
                  </p>
                  {event.failureReason ? (
                    <p className="mt-1 line-clamp-3 text-sm text-foreground">
                      {humanizeCode(event.failureReason)}
                    </p>
                  ) : null}
                  {event.warnings.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {event.warnings.map((warning) => (
                        <Badge key={warning} tone="warning">
                          {humanizeCode(warning)}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'message' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  {channelIcon(event.channel)}
                  Rendered message
                </div>
                <NotificationPreviewField
                  label="Template"
                  value={event.templateCode}
                />
                <NotificationPreviewField
                  label="Title"
                  value={event.title ?? 'No title'}
                />
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-[0.75rem] border border-border bg-surface-muted/35 p-3 text-sm leading-6 text-foreground">
                  {event.body}
                </pre>
              </div>
            </div>
          ) : null}

          {activeTab === 'links' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UserRound className="size-4 text-muted" />
                  Recipient
                </div>
                <NotificationPreviewField
                  label="Contact"
                  value={recipientLabel(event)}
                />
                <NotificationPreviewField
                  label="Status"
                  value={humanizeCode(event.recipient?.status)}
                />
                <NotificationPreviewField
                  label="User"
                  value={event.recipientUserId ?? 'No linked user'}
                />
              </div>

              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <RotateCcw className="size-4 text-muted" />
                  Delivery
                </div>
                <NotificationPreviewField
                  label="Provider"
                  value={event.providerMessageId ?? 'Not available'}
                />
                <NotificationPreviewField
                  label="Created"
                  value={formatDateSafe(event.createdAt)}
                />
                <NotificationPreviewField
                  label="Sent"
                  value={formatDateSafe(event.sentAt)}
                />
                <NotificationPreviewField
                  label="Read"
                  value={formatDateSafe(event.readAt)}
                />
              </div>
            </div>
          ) : null}
        </div>

        <QuickPreviewActions
          detailAction={detailAction}
          primaryAction={primaryAction}
          secondaryActions={secondaryActions}
        />
      </aside>
    </>
  )
}

function EventCell({
  columnId,
  event,
  canOpenRecipient,
  onFilterRecipient,
  onOpenRecipient,
  onFilterTemplate,
  onOpen,
}: {
  columnId: NotificationColumnId
  event: NotificationEvent
  canOpenRecipient: boolean
  onFilterRecipient: (recipientUserId: string) => void
  onOpenRecipient: (event: NotificationEvent) => void
  onFilterTemplate: (templateCode: string) => void
  onOpen: (event: NotificationEvent) => void
}) {
  if (columnId === 'event') {
    return (
      <div className="min-w-0 space-y-1">
        <p className="truncate font-semibold text-foreground">{event.templateCode}</p>
        <p className="line-clamp-1 text-xs text-muted">
          {event.title ?? event.body}
        </p>
        <div className="flex items-center gap-1 pt-1">
          <button
            aria-label={`Open notification event ${event.eventId}`}
            className="btn-icon size-7"
            title="Open event"
            type="button"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation()
              onOpen(event)
            }}
          >
            <ArrowUpRight className="size-3.5" />
          </button>
          <button
            aria-label={`Filter events by template ${event.templateCode}`}
            className="btn-icon size-7"
            title="Filter by template"
            type="button"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation()
              onFilterTemplate(event.templateCode)
            }}
          >
            <ListFilter className="size-3.5" />
          </button>
        </div>
      </div>
    )
  }

  if (columnId === 'recipient') {
    return (
      <div className="min-w-0 space-y-1">
        <Badge tone="neutral">{humanizeCode(event.recipientType)}</Badge>
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm text-foreground">
            {recipientLabel(event)}
          </p>
          {event.recipientUserId ? (
            <button
              aria-label={`Filter events by recipient ${event.recipientUserId}`}
              className="btn-icon size-7 shrink-0"
              title="Filter by recipient"
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                onFilterRecipient(event.recipientUserId ?? '')
              }}
            >
              <UserRound className="size-3.5" />
            </button>
          ) : null}
          {canOpenRecipient ? (
            <button
              aria-label={`Find recipient ${recipientLabel(event)}`}
              className="btn-icon size-7 shrink-0"
              title="Find recipient"
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                onOpenRecipient(event)
              }}
            >
              <ArrowUpRight className="size-3.5" />
            </button>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted">
          {event.recipient?.status ? humanizeCode(event.recipient.status) : 'Recipient summary unavailable'}
        </p>
      </div>
    )
  }

  if (columnId === 'status') {
    return (
      <div className="min-w-0 space-y-1">
        <Badge tone={statusTone(event.status)}>{humanizeCode(event.status)}</Badge>
        {event.failureReason ? (
          <p className="line-clamp-2 text-xs text-danger">{humanizeCode(event.failureReason)}</p>
        ) : (
          <p className="truncate whitespace-nowrap text-xs text-muted">
            {event.warnings.length > 0
              ? `${event.warnings.length} warning signals`
              : 'No warning signals'}
          </p>
        )}
      </div>
    )
  }

  if (columnId === 'channel') {
    return (
      <div className="min-w-0 space-y-1">
        <Badge tone="info">{event.channel}</Badge>
        <p className="truncate whitespace-nowrap text-xs text-muted">
          {event.sentAt ? 'Sent' : 'Not sent yet'}
        </p>
      </div>
    )
  }

  if (columnId === 'message') {
    return (
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-1 font-medium text-foreground">
          {event.title ?? 'No title'}
        </p>
        <p className="line-clamp-2 text-xs text-muted">{event.body}</p>
      </div>
    )
  }

  if (columnId === 'retry') {
    const retry = event.deliveryRetry

    if (!retry) {
      return (
        <div className="min-w-0 space-y-1">
          <p className="truncate whitespace-nowrap text-sm font-medium text-foreground">
            No retry
          </p>
          <p className="line-clamp-2 text-xs text-muted">
            Current provider state is final or waiting
          </p>
        </div>
      )
    }

    return (
      <div className="min-w-0 space-y-1">
        <Badge tone={retry.exhausted ? 'danger' : 'warning'}>
          {retry.attemptNumber}/{retry.maxAttempts} attempts
        </Badge>
        <p className="truncate text-xs text-muted">
          {retry.nextRetryAt
            ? `Next ${formatDateSafe(retry.nextRetryAt)}`
            : humanizeCode(retry.lastProviderStatus)}
        </p>
      </div>
    )
  }

  if (columnId === 'provider') {
    return (
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-foreground">
          {event.providerMessageId ?? 'No provider message'}
        </p>
        <p className="truncate text-xs text-muted">
          {event.deliveryRetry?.lastProviderStatus
            ? humanizeCode(event.deliveryRetry.lastProviderStatus)
            : 'Provider status unavailable'}
        </p>
      </div>
    )
  }

  if (columnId === 'readAt') {
    return (
      <div className="min-w-0 space-y-1">
        <p className="truncate whitespace-nowrap text-sm font-medium text-foreground">
          {formatDateSafe(event.readAt)}
        </p>
        <p className="truncate whitespace-nowrap text-xs text-muted">
          Push inbox read state
        </p>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-1">
      <p className="truncate whitespace-nowrap text-sm font-medium text-foreground">
        {formatDateSafe(event.createdAt)}
      </p>
      <p className="truncate whitespace-nowrap text-xs text-muted">
        Updated {formatDateSafe(event.updatedAt)}
      </p>
    </div>
  )
}

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const canReadAudit = usePermission('audit:read')
  const canReadAdminUsers = usePermission('admin_users:read')
  const canReadCustomers = usePermission('customers:read')
  const canReadVendors = usePermission('vendors:read')
  const canSendNotifications = usePermission('notifications:send')
  const canUpdateTemplates = usePermission('notifications:update')
  const seededEventChannels = readSearchEnumList(searchParams, 'channel', channels)
  const seededEventStatuses = readSearchEnumList(searchParams, 'status', statuses)
  const seededRecipientTypes = readSearchEnumList(
    searchParams,
    'recipientType',
    recipientTypes,
  )
  const seededTemplateCodes = readSearchList(searchParams, 'templateCode')
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') ?? '')
  const [eventChannels, setEventChannels] =
    useState<NotificationChannel[]>(() => seededEventChannels)
  const [eventSearch, setEventSearch] = useState(
    () => searchParams.get('search') ?? '',
  )
  const [eventStatuses, setEventStatuses] =
    useState<NotificationEventStatus[]>(() => seededEventStatuses)
  const [isFilterRailCollapsed, setIsFilterRailCollapsed] = useState(false)
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false)
  const [templatesPanelOpen, setTemplatesPanelOpen] = useState(
    () =>
      location.hash === '#notification-templates' &&
      searchParams.get('templateEditor') !== '1',
  )
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const [previewEventId, setPreviewEventId] = useState<string | null>(null)
  const [queueKey, setQueueKey] = useState<NotificationQueueKey>(() =>
    queueKeyForStatuses(seededEventStatuses),
  )
  const [recipientTypesState, setRecipientTypesState] =
    useState<NotificationRecipientType[]>(() => seededRecipientTypes)
  const [recipientUserId, setRecipientUserId] = useState(
    () => searchParams.get('recipientUserId') ?? '',
  )
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null)
  const [templateActive, setTemplateActive] = useState<ActiveFilter>('')
  const [templateActionError, setTemplateActionError] = useState<string | null>(null)
  const [templateChannel, setTemplateChannel] = useState<'' | NotificationChannel>(
    () => readSearchEnum(searchParams, 'templateChannel', channels),
  )
  const [templateCodes, setTemplateCodes] =
    useState<string[]>(() => seededTemplateCodes)
  const [templateSearch, setTemplateSearch] = useState(
    () => searchParams.get('templateSearch') ?? seededTemplateCodes[0] ?? '',
  )
  const [visibleColumns, setVisibleColumns] = useState<NotificationColumnId[]>(
    defaultNotificationColumns,
  )
  const [columnWidths, setColumnWidths] =
    useState<NotificationColumnWidths>(() => loadColumnWidths())
  const columnMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.localStorage.setItem(
      NOTIFICATION_COLUMN_WIDTH_STORAGE_KEY,
      JSON.stringify(columnWidths),
    )
  }, [columnWidths])

  useEffect(() => {
    if (!isColumnMenuOpen) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && columnMenuRef.current?.contains(target)) {
        return
      }

      setIsColumnMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsColumnMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isColumnMenuOpen])

  useEffect(() => {
    if (!templatesPanelOpen) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTemplatesPanelOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [templatesPanelOpen])

  const templateQueryParams = useMemo<NotificationTemplatesQueryParams>(
    () => ({
      search: templateSearch.trim() || undefined,
      channel: templateChannel || undefined,
      isActive: templateActive === '' ? undefined : templateActive === 'true',
    }),
    [templateActive, templateChannel, templateSearch],
  )

  const eventQueryParams = useMemo<NotificationEventsQueryParams>(
    () => ({
      page,
      limit,
      search: eventSearch.trim() || undefined,
      channel: eventChannels.length > 0 ? eventChannels : undefined,
      recipientType:
        recipientTypesState.length > 0 ? recipientTypesState : undefined,
      status: eventStatuses.length > 0 ? eventStatuses : undefined,
      templateCode: templateCodes.length > 0 ? templateCodes : undefined,
      recipientUserId: recipientUserId.trim()
        ? [recipientUserId.trim()]
        : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [
      dateFrom,
      dateTo,
      eventChannels,
      eventSearch,
      eventStatuses,
      limit,
      page,
      recipientTypesState,
      recipientUserId,
      templateCodes,
    ],
  )

  const templatesQuery = useQuery({
    queryKey: ['notification-templates', templateQueryParams],
    queryFn: () => notificationService.getTemplates(templateQueryParams),
  })
  const eventsQuery = useQuery({
    queryKey: ['notification-events', eventQueryParams],
    queryFn: () => notificationService.getEvents(eventQueryParams),
  })
  const updateTemplateMutation = useMutation({
    mutationFn: ({
      payload,
      templateId,
    }: {
      payload: UpdateNotificationTemplatePayload
      templateId: string
    }) => notificationService.updateTemplate(templateId, payload),
    onSuccess: () => {
      if (searchParams.has('templateEditor')) {
        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('templateEditor')
        setSearchParams(nextParams, { replace: true })
      }

      setSelectedTemplate(null)
      setTemplateActionError(null)
      void queryClient.invalidateQueries({ queryKey: ['notification-templates'] })
      void queryClient.invalidateQueries({ queryKey: ['notification-events'] })
    },
    onError: (error) => {
      setTemplateActionError(
        error instanceof Error ? error.message : 'Template update failed.',
      )
    },
  })

  const templates = templatesQuery.data?.data ?? EMPTY_NOTIFICATION_TEMPLATES
  const events = eventsQuery.data?.data ?? EMPTY_NOTIFICATION_EVENTS
  const previewEvent =
    events.find((event) => event.eventId === previewEventId) ?? null
  const seededTemplateEditorCode =
    searchParams.get('templateEditor') === '1'
      ? readSearchList(searchParams, 'templateCode')[0]
      : ''
  const urlSelectedTemplate = seededTemplateEditorCode
    ? templates.find((template) => template.templateCode === seededTemplateEditorCode) ?? null
    : null
  const activeTemplate = selectedTemplate ?? urlSelectedTemplate
  const pagination = eventsQuery.data?.pagination
  const eventSelection = useListSelection(events, (event) => event.eventId)
  const templateSummary = templatesQuery.data?.summary
  const isEventsLoading = eventsQuery.isLoading
  const isRefreshing = eventsQuery.isFetching || templatesQuery.isFetching
  const queueCounts = queueCountsFromEventsResponse(eventsQuery.data)
  const metrics = buildNotificationMetrics(
    events,
    pagination?.totalItems ?? events.length,
    queueCounts,
  )
  const queueItems = buildQueueItems(queueCounts)
  const templateCodeOptions = useMemo<LookupOption[]>(() => {
    const uniqueTemplateCodes = Array.from(
      new Set(templates.map((template) => template.templateCode)),
    ).sort()

    return uniqueTemplateCodes.map((templateCode) => ({
      label: humanizeCode(templateCode),
      meta: templateCode,
      value: templateCode,
    }))
  }, [templates])
  const gridStyle = useMemo<NotificationGridStyle>(
    () => ({
      '--notification-grid-template': getNotificationGridTemplate(
        visibleColumns,
        columnWidths,
      ),
      '--notification-grid-min-width': `${getNotificationGridMinWidth(
        visibleColumns,
        columnWidths,
      )}px`,
    }),
    [columnWidths, visibleColumns],
  )

  const resetEventsPage = () => setPage(1)

  const clearSeededNotificationParams = () => {
    const seededKeys = [
      'channel',
      'dateFrom',
      'dateTo',
      'recipientType',
      'recipientUserId',
      'search',
      'status',
      'templateChannel',
      'templateCode',
      'templateEditor',
      'templateSearch',
    ]

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const clearTemplateEditorParam = () => {
    if (!searchParams.has('templateEditor')) return

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('templateEditor')
    setSearchParams(nextParams, { replace: true })
  }

  const applyQueue = (nextQueueKey: NotificationQueueKey) => {
    clearSeededNotificationParams()
    setQueueKey(nextQueueKey)
    setPage(1)

    if (nextQueueKey === 'all') {
      setEventStatuses([])
      return
    }

    if (nextQueueKey === 'needsReview') {
      setEventStatuses(['FAILED'])
      return
    }

    if (nextQueueKey === 'queued') {
      setEventStatuses(['QUEUED'])
      return
    }

    if (nextQueueKey === 'sent') {
      setEventStatuses(['SENT'])
      return
    }

    if (nextQueueKey === 'skipped') {
      setEventStatuses(['SKIPPED'])
    }
  }

  const clearFilters = () => {
    clearSeededNotificationParams()
    setEventChannels([])
    setEventSearch('')
    setEventStatuses([])
    setQueueKey('all')
    setRecipientTypesState([])
    setRecipientUserId('')
    setTemplateCodes([])
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const toggleColumn = (columnId: NotificationColumnId) => {
    setVisibleColumns((current) => {
      if (current.includes(columnId)) {
        return current.length === 1
          ? current
          : current.filter((visibleColumn) => visibleColumn !== columnId)
      }

      const next = [...current, columnId]
      return notificationDataColumns
        .map((column) => column.id)
        .filter((id) => next.includes(id))
    })
  }

  const startColumnResize = (
    columnId: NotificationColumnId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getNotificationColumnWidth(columnWidths, columnId)
    const minWidth = getNotificationColumnMinWidth(columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.max(
        minWidth,
        Math.min(560, startWidth + moveEvent.clientX - startX),
      )
      setColumnWidths((current) => ({
        ...current,
        [columnId]: nextWidth,
      }))
    }

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  const refreshData = () => {
    void Promise.all([eventsQuery.refetch(), templatesQuery.refetch()])
  }

  const openEventDetail = (event: NotificationEvent) => {
    navigate(`${routePaths.notifications}/${event.eventId}`)
  }

  const openRecipientDirectory = (event: NotificationEvent) => {
    navigate(buildRecipientDirectoryPath(event))
  }

  const focusTemplateEvents = (templateCode: string) => {
    clearSeededNotificationParams()
    setTemplatesPanelOpen(false)
    setTemplateCodes([templateCode])
    setEventStatuses([])
    setQueueKey('all')
    setPage(1)
  }

  const focusRecipientEvents = (nextRecipientUserId: string) => {
    if (!nextRecipientUserId) return

    clearSeededNotificationParams()
    setRecipientUserId(nextRecipientUserId)
    setPage(1)
  }

  const openTemplateEditor = (event: NotificationEvent) => {
    const matchingTemplate =
      templates.find(
        (template) =>
          template.templateCode === event.templateCode &&
          template.channel === event.channel,
      ) ??
      templates.find((template) => template.templateCode === event.templateCode)

    if (matchingTemplate) {
      setTemplatesPanelOpen(false)
      setTemplateActionError(null)
      setSelectedTemplate(matchingTemplate)
      return
    }

    navigate(buildTemplateEditorPath(event))
  }

  const openNotificationAudit = (event: NotificationEvent) => {
    navigate(buildNotificationAuditPath(event))
  }

  const composeFromEvent = (event: NotificationEvent) => {
    navigate(buildNotificationComposerPath(event))
  }

  return (
    <PageContainer className="flex min-h-full flex-col gap-3 !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        description="Manage templates, delivery events, retries, and recipient notification history."
        layout="workspace"
        placement="topbar"
        title="Notifications"
      />

      {!canSendNotifications ? (
        <InlineAlert message="Your role can view notifications but cannot send them." />
      ) : null}

      <section className="grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <SummaryCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section
        className={cn(
          'grid gap-3 xl:min-h-0 xl:flex-1 xl:items-stretch xl:overflow-hidden',
          previewEvent
            ? isFilterRailCollapsed
              ? 'lg:grid-cols-[3rem_minmax(0,1fr)] 2xl:grid-cols-[3rem_minmax(0,1fr)_22rem]'
              : 'lg:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)_22rem]'
            : isFilterRailCollapsed
              ? 'lg:grid-cols-[3rem_minmax(0,1fr)]'
              : 'lg:grid-cols-[18rem_minmax(0,1fr)]',
        )}
      >
        <aside className="flex min-w-0 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
            {!isFilterRailCollapsed ? (
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Queue totals</h2>
                <p className="mt-0.5 text-xs text-muted">Counts match base filters.</p>
              </div>
            ) : null}
            <button
              aria-label={isFilterRailCollapsed ? 'Expand filters' : 'Collapse filters'}
              className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground"
              type="button"
              onClick={() => setIsFilterRailCollapsed((current) => !current)}
            >
              <ChevronLeft
                className={cn('size-4 transition', isFilterRailCollapsed && 'rotate-180')}
              />
            </button>
          </div>

          {isFilterRailCollapsed ? null : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
              <div className="space-y-2">
                {queueItems.map((item) => (
                  <button
                    className={cn(
                      'flex min-h-10 w-full items-center justify-between rounded-[0.75rem] border border-border bg-surface px-3 text-left text-sm transition hover:border-primary/35 hover:bg-surface-muted/60',
                      queueKey === item.key &&
                        'border-primary bg-primary/5 text-primary',
                    )}
                    key={item.key}
                    type="button"
                    onClick={() => applyQueue(item.key)}
                    >
                      <span className="font-medium">{item.label}</span>
                    <span className="text-xs font-semibold">
                      {item.count ?? '...'}
                    </span>
                  </button>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Filter stack</h3>
                  <button
                    className="text-xs font-semibold text-primary hover:text-primary-hover"
                    type="button"
                    onClick={clearFilters}
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  <MultiSelectFilter
                    label="Status"
                    options={buildLookupOptions(statuses)}
                    placeholder="All statuses"
                    values={eventStatuses}
                    onChange={(values) => {
                      clearSeededNotificationParams()
                      setEventStatuses(values as NotificationEventStatus[])
                      setQueueKey(values.length > 0 ? 'custom' : 'all')
                      resetEventsPage()
                    }}
                  />
                  <MultiSelectFilter
                    label="Channel"
                    options={buildLookupOptions(channels)}
                    placeholder="All channels"
                    values={eventChannels}
                    onChange={(values) => {
                      clearSeededNotificationParams()
                      setEventChannels(values as NotificationChannel[])
                      resetEventsPage()
                    }}
                  />
                  <MultiSelectFilter
                    label="Recipient"
                    options={buildLookupOptions(recipientTypes)}
                    placeholder="All recipients"
                    values={recipientTypesState}
                    onChange={(values) => {
                      clearSeededNotificationParams()
                      setRecipientTypesState(values as NotificationRecipientType[])
                      resetEventsPage()
                    }}
                  />
                  <MultiSelectFilter
                    emptyLabel="No templates loaded"
                    label="Template"
                    options={templateCodeOptions}
                    placeholder="All templates"
                    values={templateCodes}
                    onChange={(values) => {
                      clearSeededNotificationParams()
                      setTemplateCodes(values)
                      resetEventsPage()
                    }}
                  />
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-muted">Recipient user ID</span>
                    <Input
                      placeholder="UUID"
                      value={recipientUserId}
                      onChange={(event) => {
                        clearSeededNotificationParams()
                        setRecipientUserId(event.target.value)
                        resetEventsPage()
                      }}
                    />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-muted">Date from</span>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(event) => {
                          clearSeededNotificationParams()
                          setDateFrom(event.target.value)
                          resetEventsPage()
                        }}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-muted">Date to</span>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(event) => {
                          clearSeededNotificationParams()
                          setDateTo(event.target.value)
                          resetEventsPage()
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>

        <section id="notification-events" className="flex min-w-0 scroll-mt-4 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0">
          <div className="flex flex-col gap-3 border-b border-border px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Delivery events</h2>
              <p className="mt-1 text-sm text-muted">
                {pagination
                  ? `${pagination.totalItems} events matching current filters`
                  : `${events.length} events in the current window`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ListHeaderSearch
                className="w-full min-w-[16rem] sm:w-72"
                placeholder="Search template, recipient, message"
                value={eventSearch}
                onChange={(value) => {
                  clearSeededNotificationParams()
                  setEventSearch(value)
                  resetEventsPage()
                }}
              />
              <div className="relative" ref={columnMenuRef}>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setIsColumnMenuOpen((current) => !current)}
                >
                  <SlidersHorizontal className="mr-2 size-4" />
                  Columns
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {visibleColumns.length}
                  </span>
                </Button>
                {isColumnMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.35rem)] z-[70] w-64 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface">
                    {notificationDataColumns.map((column) => (
                      <button
                        className="flex min-h-9 w-full items-center justify-between rounded-[0.65rem] px-2 text-sm text-foreground transition hover:bg-surface-muted"
                        key={column.id}
                        type="button"
                        onClick={() => toggleColumn(column.id)}
                      >
                        <span>{column.label}</span>
                        <span
                          className={cn(
                            'inline-flex size-4 items-center justify-center rounded border border-border',
                            visibleColumns.includes(column.id) &&
                              'border-primary bg-primary',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <Button
                isLoading={isRefreshing}
                size="sm"
                type="button"
                variant="secondary"
                onClick={refreshData}
              >
                <RefreshCcw className="mr-2 size-4" />
                Refresh
              </Button>
              <Button
                aria-expanded={templatesPanelOpen}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => setTemplatesPanelOpen(true)}
              >
                <ListFilter className="mr-2 size-4" />
                Templates
                {templateSummary ? (
                  <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                    {templateSummary.total}
                  </span>
                ) : null}
              </Button>
              {canSendNotifications ? (
                <Link to={`${routePaths.notifications}/new`}>
                  <Button size="sm" type="button">
                    <BellPlus className="mr-2 size-4" />
                    New
                  </Button>
                </Link>
              ) : null}
              {canReadAudit ? (
                <Link to={routePaths.audit}>
                  <Button size="sm" type="button" variant="secondary">
                    <ClipboardList className="mr-2 size-4" />
                    Audit
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>

          {eventsQuery.isError ? (
            <div className="p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <ErrorState
                description={
                  eventsQuery.error instanceof Error
                    ? eventsQuery.error.message
                    : 'We could not load notification delivery events.'
                }
                title="Events unavailable"
                onRetry={() => void eventsQuery.refetch()}
              />
            </div>
          ) : isEventsLoading ? (
            <div className="p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <TableSkeleton columnCount={visibleColumns.length + 1} hasFooter rowCount={8} />
            </div>
          ) : events.length === 0 ? (
            <div className="p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <EmptyState description="No notification events matched this filter." title="No events" />
            </div>
          ) : (
            <div className="flex flex-col xl:min-h-0 xl:flex-1">
              <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                <div
                  className="min-w-[var(--notification-grid-min-width)]"
                  style={gridStyle}
                >
                  <div className="sticky top-0 z-10 grid grid-cols-[var(--notification-grid-template)] gap-x-3 border-b border-border bg-surface-muted px-3 py-3 text-xs font-semibold uppercase tracking-normal text-muted">
                    <div className="flex min-w-0 items-center">
                      <ListSelectionCheckbox
                        checked={eventSelection.allVisibleSelected}
                        indeterminate={eventSelection.someVisibleSelected}
                        label="Select visible notification events"
                        onChange={eventSelection.setVisibleSelected}
                      />
                    </div>
                    {visibleColumns.map((columnId) => {
                      const column = notificationDataColumns.find(
                        (item) => item.id === columnId,
                      )

                      return (
                        <div
                          className="group relative flex min-w-0 items-center gap-2"
                          key={columnId}
                        >
                          <span className="truncate">{column?.label}</span>
                          <button
                            aria-label={`Resize ${column?.label ?? columnId} column`}
                            className="absolute -right-2 top-1/2 h-6 w-2 -translate-y-1/2 cursor-col-resize rounded-full border-r border-border opacity-60 transition hover:border-primary hover:opacity-100"
                            type="button"
                            onPointerDown={(event) => startColumnResize(columnId, event)}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <ListSelectionToolbar
                    allVisibleSelected={eventSelection.allVisibleSelected}
                    selectedCount={eventSelection.selectedCount}
                    visibleCount={eventSelection.visibleCount}
                    onClear={eventSelection.clearSelection}
                    onSelectVisible={() => eventSelection.setVisibleSelected(true)}
                  />

                  <div className="divide-y divide-border">
                    {events.map((event) => (
                      <div
                        aria-label={`Preview notification event ${event.templateCode}`}
                        aria-selected={eventSelection.isSelected(event.eventId)}
                        className={cn(
                          'grid min-h-[5.5rem] cursor-pointer grid-cols-[var(--notification-grid-template)] gap-x-3 px-3 py-3 text-left transition hover:bg-surface-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          previewEventId === event.eventId &&
                            'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
                          eventSelection.isSelected(event.eventId) &&
                            'bg-primary/5 hover:bg-primary/10',
                        )}
                        key={event.eventId}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreviewEventId(event.eventId)}
                        onKeyDown={(keyboardEvent) => {
                          if (keyboardEvent.target !== keyboardEvent.currentTarget) return

                          if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                            keyboardEvent.preventDefault()
                            setPreviewEventId(event.eventId)
                          }
                        }}
                      >
                        <div className="flex min-w-0 items-start self-center">
                          <ListSelectionCheckbox
                            checked={eventSelection.isSelected(event.eventId)}
                            label={`Select notification event ${event.eventId}`}
                            onChange={(selected) =>
                              eventSelection.setItemSelected(event.eventId, selected)
                            }
                          />
                        </div>
                        {visibleColumns.map((columnId) => (
                          <div
                            className="min-w-0 self-center text-sm"
                            key={`${event.eventId}-${columnId}`}
                          >
                            <EventCell
                              canOpenRecipient={canOpenRecipientDirectory(event, {
                                canReadAdminUsers,
                                canReadCustomers,
                                canReadVendors,
                              })}
                              columnId={columnId}
                              event={event}
                              onFilterRecipient={focusRecipientEvents}
                              onOpenRecipient={openRecipientDirectory}
                              onFilterTemplate={focusTemplateEvents}
                              onOpen={openEventDetail}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {pagination ? (
                <div className="flex flex-col gap-3 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span>
                      Showing {(pagination.page - 1) * pagination.limit + 1}-
                      {Math.min(
                        pagination.page * pagination.limit,
                        pagination.totalItems,
                      )}{' '}
                      of {pagination.totalItems}
                    </span>
                    <span>Rows</span>
                    <select
                      className="h-9 rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                      value={limit}
                      onChange={(event) => {
                        setLimit(Number(event.target.value))
                        setPage(1)
                      }}
                    >
                      {[10, 20, 50, 100].map((pageSize) => (
                        <option key={pageSize} value={pageSize}>
                          {pageSize}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      disabled={!pagination.hasPreviousPage}
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => setPage(Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-sm font-semibold text-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      disabled={!pagination.hasNextPage}
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
        {previewEvent ? (
          <NotificationPreviewPanel
            canOpenRecipient={canOpenRecipientDirectory(previewEvent, {
              canReadAdminUsers,
              canReadCustomers,
              canReadVendors,
            })}
            canReadAudit={canReadAudit}
            canSendNotifications={canSendNotifications}
            canUpdateTemplates={canUpdateTemplates}
            event={previewEvent}
            onClose={() => setPreviewEventId(null)}
            onCompose={composeFromEvent}
            onEditTemplate={openTemplateEditor}
            onFilterRecipient={focusRecipientEvents}
            onFilterTemplate={focusTemplateEvents}
            onOpenAudit={openNotificationAudit}
            onOpenDetails={openEventDetail}
            onOpenRecipient={openRecipientDirectory}
          />
        ) : null}
      </section>

      {templatesPanelOpen ? (
        <div className="fixed inset-0 z-[90]">
          <button
            aria-label="Close templates"
            className="absolute inset-0 bg-foreground/20"
            type="button"
            onClick={() => setTemplatesPanelOpen(false)}
          />
          <aside
            aria-label="Notification templates"
            aria-modal="true"
            className="absolute inset-y-0 right-0 flex w-full max-w-[54rem] flex-col border-l border-border bg-surface shadow-surface"
            id="notification-templates"
            role="dialog"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Templates</h2>
                <p className="text-sm text-muted">
                  {templateSummary
                    ? `${templateSummary.active} active of ${templateSummary.total}`
                    : 'Template copy and channel states'}
                </p>
              </div>
              <button
                aria-label="Close templates"
                className="btn-icon"
                title="Close"
                type="button"
                onClick={() => setTemplatesPanelOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="flex flex-wrap items-center gap-2 rounded-[0.875rem] border border-border bg-surface-muted/35 p-3">
                <ListHeaderSearch
                  className="w-full min-w-[14rem] sm:w-64"
                  placeholder="Search templates"
                  value={templateSearch}
                  onChange={(value) => {
                    clearSeededNotificationParams()
                    setTemplateSearch(value)
                  }}
                />
                <select
                  className="h-10 rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                  value={templateChannel}
                  onChange={(event) => {
                    clearSeededNotificationParams()
                    setTemplateChannel(event.target.value as '' | NotificationChannel)
                  }}
                >
                  <option value="">All channels</option>
                  {channels.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                  value={templateActive}
                  onChange={(event) => {
                    clearSeededNotificationParams()
                    setTemplateActive(event.target.value as ActiveFilter)
                  }}
                >
                  <option value="">All states</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              {templatesQuery.isError ? (
                <ErrorState
                  description={
                    templatesQuery.error instanceof Error
                      ? templatesQuery.error.message
                      : 'We could not load notification templates.'
                  }
                  title="Templates unavailable"
                  onRetry={() => void templatesQuery.refetch()}
                />
              ) : templatesQuery.isLoading || templatesQuery.isFetching ? (
                <TableSkeleton columns={templateColumns} hasActions rowCount={5} />
              ) : templates.length === 0 ? (
                <EmptyState description="No notification templates matched this filter." title="No templates" />
              ) : (
                <DynamicTable
                  actionColumnMinWidth={190}
                  bodyMaxHeight={520}
                  columns={templateColumns}
                  data={templates}
                  inlineActionLimit={2}
                  rowActions={(template) => [
                    {
                      key: 'filter-template-events',
                      label: 'Events',
                      icon: <ListFilter className="size-4" />,
                      onClick: (row) => focusTemplateEvents(row.templateCode),
                      placement: 'inline',
                    },
                    {
                      key: 'edit-template',
                      label: 'Edit',
                      icon: <Pencil className="size-4" />,
                      isDisabled:
                        !canUpdateTemplates ||
                        updateTemplateMutation.isPending ||
                        !template.availableActions.includes('UPDATE_TEMPLATE'),
                      onClick: (row) => {
                        setTemplatesPanelOpen(false)
                        setTemplateActionError(null)
                        setSelectedTemplate(row)
                      },
                      placement: 'inline',
                    },
                  ]}
                  title="Templates"
                  getRowId={(template) => template.templateId}
                />
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {activeTemplate ? (
        <TemplateEditModal
          key={activeTemplate.templateId}
          error={templateActionError}
          isSubmitting={updateTemplateMutation.isPending}
          template={activeTemplate}
          onClose={() => {
            if (!updateTemplateMutation.isPending) {
              clearTemplateEditorParam()
              setSelectedTemplate(null)
              setTemplateActionError(null)
            }
          }}
          onSubmit={(payload) =>
            updateTemplateMutation.mutate({
              payload,
              templateId: activeTemplate.templateId,
            })
          }
        />
      ) : null}
    </PageContainer>
  )
}
