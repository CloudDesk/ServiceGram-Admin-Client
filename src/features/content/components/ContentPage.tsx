import {
  Archive,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  Filter,
  FilePlus2,
  Globe2,
  RefreshCcw,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Smartphone,
  X,
} from 'lucide-react'
import type {
  CSSProperties,
  FormEvent,
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
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import {
  QuickPreviewActions,
  QuickPreviewFact,
  QuickPreviewFactGrid,
  QuickPreviewTabs,
  type QuickPreviewAction,
} from '../../../components/ui/QuickPreview'
import { TableSkeleton } from '../../../components/ui/Table'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import type { LookupOption } from '../../../types/lookup.types'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { contentService } from '../services/content.service'
import type {
  ContentFormat,
  ContentPage as ContentPageRecord,
  ContentPagesQueryParams,
  ContentPageStatus,
  ContentPageType,
  CustomerAppHomePayload,
} from '../types/content.types'

const DEFAULT_PAGE_SIZE = 10
const CONTENT_DEFAULT_COLUMN_WIDTH = 220
const CONTENT_GRID_COLUMN_GAP = 12
const CONTENT_GRID_INLINE_PADDING = 24
const CONTENT_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.content.columnWidths.v1'
const CONTENT_ACTION_COLUMN_WIDTH = 270
const CONTENT_MAX_COLUMN_WIDTH = 560

const statuses: ContentPageStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED']
const pageTypes: ContentPageType[] = [
  'LEGAL',
  'FAQ',
  'SUPPORT',
  'ONBOARDING',
  'POLICY',
  'MARKETING',
]
const formats: ContentFormat[] = ['MARKDOWN', 'HTML', 'PLAIN_TEXT']

const contentDataColumns = [
  { id: 'page', label: 'Page', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 210 },
  { id: 'status', label: 'Status', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 160 },
  { id: 'type', label: 'Type', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 155 },
  { id: 'format', label: 'Format', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 150 },
  { id: 'version', label: 'Version', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 150 },
  { id: 'visibility', label: 'Visibility', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 170 },
  { id: 'warnings', label: 'Signals', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 220 },
  { id: 'updatedAt', label: 'Updated', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 170 },
] as const

type ContentColumnId = (typeof contentDataColumns)[number]['id']
type ContentColumnWidths = Partial<Record<ContentColumnId, number>>
type ContentQueueKey = 'all' | 'custom' | 'draft' | 'published' | 'hidden' | 'archived'
type ContentActionKind = 'PUBLISH' | 'ARCHIVE'
type ContentPreviewTab = 'preview' | 'publishing' | 'signals'

const defaultContentColumns: ContentColumnId[] = [
  'page',
  'status',
  'type',
  'version',
  'visibility',
  'updatedAt',
]
const EMPTY_CONTENT_PAGES: ContentPageRecord[] = []

interface ContentGridStyle extends CSSProperties {
  '--content-grid-template': string
  '--content-grid-min-width': string
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

function statusTone(status: ContentPageStatus): StatusTone {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

function customerAppHomeSurfaceStatus({
  home,
  isError,
  isLoading,
}: {
  home: CustomerAppHomePayload | null
  isError: boolean
  isLoading: boolean
}): { helper: string; label: string; tone: StatusTone } {
  if (isError && !home) {
    return {
      helper: 'Open the detail view or retry to load the latest home setup.',
      label: 'Unavailable',
      tone: 'danger',
    }
  }

  if (isLoading && !home) {
    return {
      helper: 'Loading the customer app home setup.',
      label: 'Loading',
      tone: 'neutral',
    }
  }

  if (!home) {
    return {
      helper: 'Open the detail view to configure the app home surface.',
      label: 'Not loaded',
      tone: 'neutral',
    }
  }

  if (!home.section.isEnabled) {
    return {
      helper: 'Carousel section is currently hidden from customers.',
      label: 'Hidden from app',
      tone: 'danger',
    }
  }

  if (home.carousel.summary.published > 0) {
    return {
      helper: 'Published slides are visible on the customer app home screen.',
      label: 'Live in app',
      tone: 'success',
    }
  }

  return {
    helper: 'Enabled, but no published slides are live yet.',
    label: 'Needs live slide',
    tone: 'warning',
  }
}

function buildLookupOptions<TValue extends string>(values: readonly TValue[]): LookupOption[] {
  return values.map((value) => ({ label: humanizeCode(value), value }))
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

function readSearchVisibility(searchParams: URLSearchParams) {
  const rawVisibility =
    searchParams.get('isVisibleToCustomers') ?? searchParams.get('visibility')

  if (rawVisibility === 'true' || rawVisibility === 'visible') return 'visible'
  if (rawVisibility === 'false' || rawVisibility === 'hidden') return 'hidden'

  return 'all'
}

function queueKeyForFilters(
  selectedStatuses: ContentPageStatus[],
  selectedVisibility: 'all' | 'hidden' | 'visible',
): ContentQueueKey {
  if (selectedVisibility === 'hidden' && selectedStatuses.length === 0) return 'hidden'
  if (selectedVisibility !== 'all') return 'custom'
  if (selectedStatuses.length === 0) return 'all'
  if (selectedStatuses.length > 1) return 'custom'

  const [status] = selectedStatuses

  if (status === 'DRAFT') return 'draft'
  if (status === 'PUBLISHED') return 'published'
  if (status === 'ARCHIVED') return 'archived'

  return 'custom'
}

function buildContentAuditPath(page: ContentPageRecord) {
  const params = new URLSearchParams({
    moduleCode: 'content',
    entityType: 'content_page',
    entityId: page.pageId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function getContentColumnDefaultWidth(columnId: ContentColumnId) {
  return (
    contentDataColumns.find((column) => column.id === columnId)?.defaultWidth ??
    CONTENT_DEFAULT_COLUMN_WIDTH
  )
}

function getContentColumnMinWidth(columnId: ContentColumnId) {
  return contentDataColumns.find((column) => column.id === columnId)?.minWidth ?? 140
}

function getContentColumnWidth(
  columnWidths: ContentColumnWidths,
  columnId: ContentColumnId,
) {
  const storedWidth = columnWidths[columnId]
  const fallbackWidth = getContentColumnDefaultWidth(columnId)
  const width =
    typeof storedWidth === 'number' && Number.isFinite(storedWidth)
      ? storedWidth
      : fallbackWidth

  return Math.max(
    getContentColumnMinWidth(columnId),
    Math.min(CONTENT_MAX_COLUMN_WIDTH, width),
  )
}

function getContentGridTemplate(
  visibleColumns: ContentColumnId[],
  columnWidths: ContentColumnWidths,
) {
  const selectedWidths = contentDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => {
      const width = getContentColumnWidth(columnWidths, column.id)

      return column.id === 'page' ? `minmax(${width}px, 1fr)` : `${width}px`
    })

  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...selectedWidths,
    `${CONTENT_ACTION_COLUMN_WIDTH}px`,
  ].join(' ')
}

function getContentGridMinWidth(
  visibleColumns: ContentColumnId[],
  columnWidths: ContentColumnWidths,
) {
  const columnsWidth = visibleColumns.reduce(
    (sum, columnId) => sum + getContentColumnWidth(columnWidths, columnId),
    0,
  )

  return (
    columnsWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    CONTENT_ACTION_COLUMN_WIDTH +
    Math.max(visibleColumns.length + 1, 0) * CONTENT_GRID_COLUMN_GAP +
    CONTENT_GRID_INLINE_PADDING
  )
}

function loadColumnWidths(): ContentColumnWidths {
  if (typeof window === 'undefined') return {}

  try {
    const rawValue = window.localStorage.getItem(CONTENT_COLUMN_WIDTH_STORAGE_KEY)

    if (!rawValue) return {}

    const parsed = JSON.parse(rawValue) as ContentColumnWidths
    const columnIds = new Set<string>(contentDataColumns.map((column) => column.id))

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [ContentColumnId, number] => {
          const [columnId, value] = entry
          return columnIds.has(columnId) && typeof value === 'number' && Number.isFinite(value)
        })
        .map(([columnId, value]) => [
          columnId,
          Math.max(
            getContentColumnMinWidth(columnId),
            Math.min(CONTENT_MAX_COLUMN_WIDTH, value),
          ),
        ]),
    )
  } catch {
    return {}
  }
}

interface ContentQueueCounts {
  all: number
  draft: number
  published: number
  hidden: number
  archived: number
}

function buildQueueItems(counts?: ContentQueueCounts) {
  return [
    { key: 'all' as const, label: 'All content', count: counts?.all },
    {
      key: 'draft' as const,
      label: 'Drafts',
      count: counts?.draft,
    },
    {
      key: 'published' as const,
      label: 'Published',
      count: counts?.published,
    },
    {
      key: 'hidden' as const,
      label: 'Hidden',
      count: counts?.hidden,
    },
    {
      key: 'archived' as const,
      label: 'Archived',
      count: counts?.archived,
    },
  ]
}

function canRunContentListAction({
  action,
  canPublishContent,
  canUpdateContent,
  page,
}: {
  action: 'ARCHIVE' | 'PUBLISH' | 'UPDATE'
  canPublishContent: boolean
  canUpdateContent: boolean
  page: ContentPageRecord
}) {
  if (!page.availableActions.includes(action)) return false
  if (action === 'PUBLISH') return canPublishContent
  return canUpdateContent
}

function ContentActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  action: { kind: ContentActionKind; page: ContentPageRecord }
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const isArchive = action.kind === 'ARCHIVE'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedReason = reason.trim()
    setFormError(null)

    if (trimmedReason.length < 5) {
      setFormError('Reason must be at least 5 characters.')
      return
    }

    onSubmit(trimmedReason)
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-[0.875rem] border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isArchive ? 'Archive content' : 'Publish content'}
            </h2>
            <p className="mt-1 text-sm text-muted">{action.page.title}</p>
          </div>
          <button
            aria-label="Close content action"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit}>
          <label className="mt-5 block space-y-2">
            <span className="text-sm font-semibold text-foreground">Change note *</span>
            <textarea
              className="form-input min-h-28 resize-y"
              placeholder={
                isArchive
                  ? 'Replacing this page with updated content.'
                  : 'Approved after final content review.'
              }
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          {formError || error ? (
            <div className="mt-4 rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              size="sm"
              type="submit"
              variant={isArchive ? 'danger' : 'primary'}
            >
              {isArchive ? 'Archive' : 'Publish'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomerAppHomeMetric({
  label,
  tone = 'neutral',
  value,
}: {
  label: string
  tone?: StatusTone
  value: ReactNode
}) {
  return (
    <div className="min-w-0 bg-surface px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div
        className={cn(
          'mt-1 min-w-0 truncate text-sm font-semibold',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
          tone === 'info' && 'text-info',
          tone === 'neutral' && 'text-foreground',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function CustomerAppHomeSurface({
  home,
  isError,
  isLoading,
  isRefreshing,
  onOpen,
  onRetry,
}: {
  home: CustomerAppHomePayload | null
  isError: boolean
  isLoading: boolean
  isRefreshing: boolean
  onOpen: () => void
  onRetry: () => void
}) {
  const status = customerAppHomeSurfaceStatus({ home, isError, isLoading })
  const summary = home?.carousel.summary
  const updatedAt = home?.section.lifecycle.updatedAt

  return (
    <section className="shrink-0 overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface">
      <div className="flex flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:justify-between sm:px-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] bg-primary/10 text-primary">
            <Smartphone className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                Content surface
              </p>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              Customer App Home
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-muted">
              Manage the hero carousel that customers see first in the app.
              {status.helper ? ` ${status.helper}` : ''}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
          <Button
            className="w-full border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted sm:w-auto"
            isLoading={isRefreshing}
            size="sm"
            type="button"
            variant="secondary"
            onClick={onRetry}
          >
            <RefreshCcw className="mr-2 size-4" />
            Refresh
          </Button>
          <Button className="w-full sm:w-auto" size="sm" type="button" onClick={onOpen}>
            <ArrowUpRight className="mr-2 size-4" />
            Open detail
          </Button>
        </div>
      </div>

      <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2 xl:grid-cols-5">
        <CustomerAppHomeMetric
          label="Surface"
          tone={status.tone}
          value={status.label}
        />
        <CustomerAppHomeMetric
          label="Live slides"
          tone={(summary?.published ?? 0) > 0 ? 'success' : 'warning'}
          value={summary?.published ?? '...'}
        />
        <CustomerAppHomeMetric label="Drafts" value={summary?.draft ?? '...'} />
        <CustomerAppHomeMetric
          label="Scheduled"
          tone={(summary?.scheduled ?? 0) > 0 ? 'info' : 'neutral'}
          value={summary?.scheduled ?? '...'}
        />
        <CustomerAppHomeMetric label="Updated" value={formatDateSafe(updatedAt)} />
      </div>
    </section>
  )
}

function ContentCell({
  columnId,
  page,
}: {
  columnId: ContentColumnId
  page: ContentPageRecord
}) {
  if (columnId === 'page') {
    return (
      <div className="min-w-0 overflow-hidden space-y-1">
        <p className="truncate font-semibold text-foreground">{page.title}</p>
        <p className="truncate text-xs text-muted">{page.slug}</p>
        <p className="line-clamp-1 text-xs text-muted">
          {page.excerpt ?? page.bodyPreview}
        </p>
      </div>
    )
  }

  if (columnId === 'status') {
    return (
      <div className="min-w-0 overflow-hidden space-y-1">
        <Badge tone={statusTone(page.status)}>{humanizeCode(page.status)}</Badge>
        <p className="truncate text-xs text-muted">
          {page.nextRecommendedAction
            ? humanizeCode(page.nextRecommendedAction)
            : 'No next action'}
        </p>
      </div>
    )
  }

  if (columnId === 'type') {
    return (
      <div className="min-w-0 overflow-hidden">
        <Badge tone="info">{humanizeCode(page.pageType)}</Badge>
      </div>
    )
  }

  if (columnId === 'format') {
    return (
      <div className="min-w-0 overflow-hidden">
        <Badge tone="neutral">{humanizeCode(page.contentFormat)}</Badge>
      </div>
    )
  }

  if (columnId === 'version') {
    return (
      <div className="min-w-0 overflow-hidden space-y-1">
        <p className="text-sm font-medium text-foreground">v{page.version}</p>
        <p className="truncate text-xs text-muted">
          Published {page.publishedVersion ? `v${page.publishedVersion}` : 'not yet'}
        </p>
      </div>
    )
  }

  if (columnId === 'visibility') {
    return (
      <div className="min-w-0 overflow-hidden space-y-1">
        <Badge tone={page.isVisibleToCustomers ? 'success' : 'danger'}>
          {page.isVisibleToCustomers ? 'Visible' : 'Hidden'}
        </Badge>
        <p className="truncate text-xs text-muted">Customer-facing surfaces</p>
      </div>
    )
  }

  if (columnId === 'warnings') {
    const signals = [...page.warnings, ...page.blockingReasons]

    return signals.length > 0 ? (
      <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
        {signals.slice(0, 2).map((signal) => (
          <Badge key={signal} tone={page.blockingReasons.includes(signal) ? 'danger' : 'warning'}>
            {signal}
          </Badge>
        ))}
        {signals.length > 2 ? <Badge tone="neutral">+{signals.length - 2}</Badge> : null}
      </div>
    ) : (
      <Badge tone="success">Clear</Badge>
    )
  }

  return (
    <div className="min-w-0 overflow-hidden space-y-1">
      <p className="truncate text-sm font-medium text-foreground">
        {formatDateSafe(page.lifecycle.updatedAt)}
      </p>
      <p className="truncate text-xs text-muted">
        Published {formatDateSafe(page.lifecycle.publishedAt)}
      </p>
    </div>
  )
}

function ContentPreviewField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  )
}

function contentPreviewPriority(page: ContentPageRecord) {
  if (page.blockingReasons.length > 0) {
    return {
      iconTone: 'text-danger',
      panelClass: 'border-danger/20 bg-danger/10',
      title: humanizeCode(page.blockingReasons[0]),
      meta: `${page.blockingReasons.length} blocker${page.blockingReasons.length === 1 ? '' : 's'}`,
    }
  }

  if (page.nextRecommendedAction) {
    return {
      iconTone: 'text-warning',
      panelClass: 'border-warning/25 bg-warning/10',
      title: humanizeCode(page.nextRecommendedAction),
      meta: 'Next action',
    }
  }

  if (page.warnings.length > 0) {
    return {
      iconTone: 'text-warning',
      panelClass: 'border-warning/25 bg-warning/10',
      title: humanizeCode(page.warnings[0]),
      meta: `${page.warnings.length} warning${page.warnings.length === 1 ? '' : 's'}`,
    }
  }

  return {
    iconTone: 'text-success',
    panelClass: 'border-success/20 bg-success/10',
    title: 'Ready',
    meta: 'Clear',
  }
}

function contentPrimaryPreviewAction(
  page: ContentPageRecord,
  canPublishContent: boolean,
  canUpdateContent: boolean,
  isSubmitting: boolean,
  onOpenAction: (kind: ContentActionKind, pageRecord: ContentPageRecord) => void,
): QuickPreviewAction | null {
  const recommendedAction = page.nextRecommendedAction

  if (recommendedAction !== 'PUBLISH' && recommendedAction !== 'ARCHIVE') {
    return null
  }

  const canRun = canRunContentListAction({
    action: recommendedAction,
    canPublishContent,
    canUpdateContent,
    page,
  })

  if (!canRun) return null

  return {
    disabled: isSubmitting,
    icon:
      recommendedAction === 'PUBLISH' ? (
        <Send className="size-4" />
      ) : (
        <Archive className="size-4" />
      ),
    key: recommendedAction,
    label: humanizeCode(recommendedAction),
    onClick: () => onOpenAction(recommendedAction, page),
    variant: recommendedAction === 'ARCHIVE' ? 'danger' : 'primary',
  }
}

function ContentPreviewPanel({
  canPublishContent,
  canReadAudit,
  canUpdateContent,
  isSubmitting,
  page,
  onClose,
  onOpenAction,
  onOpenAudit,
  onOpenDetails,
}: {
  canPublishContent: boolean
  canReadAudit: boolean
  canUpdateContent: boolean
  isSubmitting: boolean
  page: ContentPageRecord
  onClose: () => void
  onOpenAction: (kind: ContentActionKind, pageRecord: ContentPageRecord) => void
  onOpenAudit: (pageRecord: ContentPageRecord) => void
  onOpenDetails: (pageRecord: ContentPageRecord) => void
}) {
  const [activeTab, setActiveTab] = useState<ContentPreviewTab>('preview')
  const priority = contentPreviewPriority(page)
  const previewTabs: { key: ContentPreviewTab; label: string }[] = [
    { key: 'preview', label: 'Preview' },
    { key: 'publishing', label: 'Publishing' },
    { key: 'signals', label: 'Signals' },
  ]
  const primaryAction = contentPrimaryPreviewAction(
    page,
    canPublishContent,
    canUpdateContent,
    isSubmitting,
    onOpenAction,
  )
  const detailAction: QuickPreviewAction = {
    icon: <Eye className="size-4" />,
    key: 'detail',
    label: primaryAction ? 'Detail' : 'Open detail',
    onClick: () => onOpenDetails(page),
  }
  const secondaryActions: QuickPreviewAction[] = []
  const canPublish = canRunContentListAction({
    action: 'PUBLISH',
    canPublishContent,
    canUpdateContent,
    page,
  })
  const canArchive = canRunContentListAction({
    action: 'ARCHIVE',
    canPublishContent,
    canUpdateContent,
    page,
  })

  if (canPublish && primaryAction?.key !== 'PUBLISH') {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: <Send className="size-4" />,
      key: 'publish',
      label: 'Publish',
      onClick: () => onOpenAction('PUBLISH', page),
      variant: 'primary',
    })
  }

  if (canArchive && primaryAction?.key !== 'ARCHIVE') {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: <Archive className="size-4" />,
      key: 'archive',
      label: 'Archive',
      onClick: () => onOpenAction('ARCHIVE', page),
      variant: 'danger',
    })
  }

  if (canReadAudit) {
    secondaryActions.push({
      icon: <ClipboardList className="size-4" />,
      key: 'audit',
      label: 'Audit',
      onClick: () => onOpenAudit(page),
      variant: 'secondary',
    })
  }

  return (
    <>
      <button
        aria-label="Close content preview"
        className="fixed inset-0 z-40 bg-black/20 xl:hidden"
        type="button"
        onClick={onClose}
      />
      <aside className="fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:inset-x-auto xl:bottom-6 xl:right-6 xl:top-[calc(var(--spacing-topbar)+0.75rem)] xl:z-40 xl:w-[22rem]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted">
              Content preview
            </p>
            <div className="mt-2 flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] bg-primary/10 text-primary">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-base font-semibold text-foreground">
                  {page.title}
                </h3>
                <p className="mt-1 break-all text-xs text-muted">{page.slug}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={statusTone(page.status)}>{humanizeCode(page.status)}</Badge>
                  <Badge tone={page.isVisibleToCustomers ? 'success' : 'danger'}>
                    {page.isVisibleToCustomers ? 'Visible' : 'Hidden'}
                  </Badge>
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
          ariaLabel="Content preview sections"
          tabs={previewTabs}
          onChange={setActiveTab}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'preview' ? (
            <div className="space-y-3">
              <div className={cn('rounded-[0.75rem] border p-3', priority.panelClass)}>
                <div className="flex items-start gap-2">
                  <ShieldAlert className={cn('mt-0.5 size-4 shrink-0', priority.iconTone)} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {priority.title}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {priority.meta}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Customer copy
                </p>
                <h4 className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">
                  {page.title}
                </h4>
                <p className="mt-2 line-clamp-5 text-sm leading-6 text-muted">
                  {page.excerpt ?? page.bodyPreview}
                </p>
              </div>

              <QuickPreviewFactGrid>
                <QuickPreviewFact label="Type" value={humanizeCode(page.pageType)} />
                <QuickPreviewFact
                  label="Version"
                  tone={page.version !== page.publishedVersion ? 'warning' : 'info'}
                  value={`v${page.version}`}
                />
                <QuickPreviewFact label="Format" value={humanizeCode(page.contentFormat)} />
                <QuickPreviewFact
                  label="Visibility"
                  tone={page.isVisibleToCustomers ? 'success' : 'danger'}
                  value={page.isVisibleToCustomers ? 'Visible' : 'Hidden'}
                />
              </QuickPreviewFactGrid>
            </div>
          ) : null}

          {activeTab === 'publishing' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Globe2 className="size-4 text-muted" />
                  Publishing
                </div>
                <ContentPreviewField label="Updated" value={formatDateSafe(page.lifecycle.updatedAt)} />
                <ContentPreviewField label="Published" value={formatDateSafe(page.lifecycle.publishedAt)} />
                <ContentPreviewField
                  label="Published version"
                  value={page.publishedVersion ? `v${page.publishedVersion}` : 'Not published'}
                />
                <ContentPreviewField label="Slug" value={page.slug} />
              </div>

              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="size-4 text-muted" />
                  Search appearance
                </div>
                <ContentPreviewField
                  label="Title"
                  value={page.seo.title ?? page.title}
                />
                <ContentPreviewField
                  label="Description"
                  value={page.seo.description ?? page.excerpt ?? 'Not set'}
                />
              </div>
            </div>
          ) : null}

          {activeTab === 'signals' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-sm font-semibold text-foreground">Warnings</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {page.warnings.length ? (
                    page.warnings.map((warning) => (
                      <Badge key={warning} tone="warning">
                        {humanizeCode(warning)}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="success">No warnings</Badge>
                  )}
                </div>
              </div>

              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-sm font-semibold text-foreground">Blockers</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {page.blockingReasons.length ? (
                    page.blockingReasons.map((blocker) => (
                      <Badge key={blocker} tone="danger">
                        {humanizeCode(blocker)}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="success">No blockers</Badge>
                  )}
                </div>
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

export function ContentPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canCreateContent = usePermission('content:update')
  const canPublishContent = usePermission('content:publish')
  const canReadAudit = usePermission('audit:read')
  const canUpdateContent = usePermission('content:update')
  const initialStatuses = readSearchEnumList(searchParams, 'status', statuses)
  const initialVisibility = readSearchVisibility(searchParams)
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') ?? '')
  const [formatsFilter, setFormatsFilter] = useState<ContentFormat[]>(() =>
    readSearchEnumList(searchParams, 'contentFormat', formats),
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const [pageTypesFilter, setPageTypesFilter] = useState<ContentPageType[]>(() =>
    readSearchEnumList(searchParams, 'pageType', pageTypes),
  )
  const [queueKey, setQueueKey] = useState<ContentQueueKey>(() =>
    queueKeyForFilters(initialStatuses, initialVisibility),
  )
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [statusesFilter, setStatusesFilter] =
    useState<ContentPageStatus[]>(initialStatuses)
  const [visibility, setVisibility] = useState<'all' | 'hidden' | 'visible'>(
    initialVisibility,
  )
  const [visibleColumns, setVisibleColumns] = useState<ContentColumnId[]>(
    defaultContentColumns,
  )
  const [previewPageId, setPreviewPageId] = useState<string | null>(null)
  const [columnWidths, setColumnWidths] =
    useState<ContentColumnWidths>(() => loadColumnWidths())
  const [selectedAction, setSelectedAction] = useState<{
    kind: ContentActionKind
    page: ContentPageRecord
  } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const columnMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.localStorage.setItem(
      CONTENT_COLUMN_WIDTH_STORAGE_KEY,
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

  const query = useMemo<ContentPagesQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: statusesFilter.length > 0 ? statusesFilter : undefined,
      pageType: pageTypesFilter.length > 0 ? pageTypesFilter : undefined,
      contentFormat: formatsFilter.length > 0 ? formatsFilter : undefined,
      isVisibleToCustomers:
        visibility === 'all' ? undefined : visibility === 'visible',
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [
      dateFrom,
      dateTo,
      formatsFilter,
      limit,
      page,
      pageTypesFilter,
      search,
      statusesFilter,
      visibility,
    ],
  )

  const contentQuery = useQuery({
    queryKey: ['content-pages', query],
    queryFn: () => contentService.getPages(query),
  })
  const appHomeQuery = useQuery({
    queryKey: ['content', 'customer-app-home'],
    queryFn: () => contentService.getCustomerAppHome(),
    staleTime: 30_000,
  })
  const queueCountBaseQuery = useMemo<ContentPagesQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      pageType: pageTypesFilter.length > 0 ? pageTypesFilter : undefined,
      contentFormat: formatsFilter.length > 0 ? formatsFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [
      dateFrom,
      dateTo,
      formatsFilter,
      pageTypesFilter,
      search,
    ],
  )
  const queueCountsQuery = useQuery({
    queryKey: ['content-pages', 'queue-counts', queueCountBaseQuery],
    queryFn: async (): Promise<ContentQueueCounts> => {
      const [statusSummary, hiddenSummary] = await Promise.all([
        contentService.getPages(queueCountBaseQuery),
        contentService.getPages({
          ...queueCountBaseQuery,
          isVisibleToCustomers: false,
        }),
      ])

      return {
        all: statusSummary.pagination.totalItems,
        draft: statusSummary.summary.draft,
        published: statusSummary.summary.published,
        hidden: hiddenSummary.pagination.totalItems,
        archived: statusSummary.summary.archived,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const pages = contentQuery.data?.data ?? EMPTY_CONTENT_PAGES
  const appHome = appHomeQuery.data?.data ?? null
  const pagination = contentQuery.data?.pagination
  const contentSelection = useListSelection(pages, (pageRecord) => pageRecord.pageId)
  const isLoading = contentQuery.isLoading
  const isRefreshing =
    contentQuery.isFetching || queueCountsQuery.isFetching || appHomeQuery.isFetching
  const queueItems = buildQueueItems(queueCountsQuery.data)
  const previewPage = pages.find((pageRecord) => pageRecord.pageId === previewPageId) ?? null
  const hasActiveFilters = Boolean(
    search.trim() ||
      statusesFilter.length ||
      pageTypesFilter.length ||
      formatsFilter.length ||
      visibility !== 'all' ||
      dateFrom ||
      dateTo,
  )
  const gridStyle = useMemo<ContentGridStyle>(
    () => ({
      '--content-grid-template': getContentGridTemplate(visibleColumns, columnWidths),
      '--content-grid-min-width': `${getContentGridMinWidth(
        visibleColumns,
        columnWidths,
      )}px`,
    }),
    [columnWidths, visibleColumns],
  )

  const resetToFirstPage = () => setPage(1)

  const clearSeededContentParams = () => {
    const seededKeys = [
      'contentFormat',
      'dateFrom',
      'dateTo',
      'isVisibleToCustomers',
      'pageType',
      'search',
      'status',
      'visibility',
    ]

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const applyQueue = (nextQueueKey: ContentQueueKey) => {
    clearSeededContentParams()
    setQueueKey(nextQueueKey)
    setPage(1)

    if (nextQueueKey === 'all') {
      setStatusesFilter([])
      setVisibility('all')
      return
    }

    if (nextQueueKey === 'draft') {
      setStatusesFilter(['DRAFT'])
      setVisibility('all')
      return
    }

    if (nextQueueKey === 'published') {
      setStatusesFilter(['PUBLISHED'])
      setVisibility('all')
      return
    }

    if (nextQueueKey === 'hidden') {
      setStatusesFilter([])
      setVisibility('hidden')
      return
    }

    if (nextQueueKey === 'archived') {
      setStatusesFilter(['ARCHIVED'])
      setVisibility('all')
    }
  }

  const clearFilters = () => {
    clearSeededContentParams()
    setDateFrom('')
    setDateTo('')
    setFormatsFilter([])
    setPageTypesFilter([])
    setQueueKey('all')
    setSearch('')
    setStatusesFilter([])
    setVisibility('all')
    setPage(1)
  }

  const toggleColumn = (columnId: ContentColumnId) => {
    setVisibleColumns((current) => {
      if (current.includes(columnId)) {
        return current.length === 1
          ? current
          : current.filter((visibleColumn) => visibleColumn !== columnId)
      }

      const next = [...current, columnId]
      return contentDataColumns
        .map((column) => column.id)
        .filter((id) => next.includes(id))
    })
  }

  const startColumnResize = (
    columnId: ContentColumnId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getContentColumnWidth(columnWidths, columnId)
    const minWidth = getContentColumnMinWidth(columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.max(
        minWidth,
        Math.min(CONTENT_MAX_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX),
      )
      setColumnWidths((current) => ({ ...current, [columnId]: nextWidth }))
    }

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      pageRecord,
      reason,
    }: {
      action: ContentActionKind
      pageRecord: ContentPageRecord
      reason: string
    }) => {
      if (action === 'PUBLISH') {
        return contentService.publishPage(pageRecord.pageId, { reason })
      }

      return contentService.archivePage(pageRecord.pageId, { reason })
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: (response, variables) => {
      setSelectedAction(null)
      setActionMessage(
        response.message ??
          (variables.action === 'PUBLISH'
            ? 'Content page published.'
            : 'Content page archived.'),
      )
      void queryClient.invalidateQueries({ queryKey: ['content-pages'] })
      void queryClient.invalidateQueries({
        queryKey: ['content-page-detail', variables.pageRecord.pageId],
      })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Content action failed.',
      )
    },
  })

  const openContentAction = (
    kind: ContentActionKind,
    pageRecord: ContentPageRecord,
    event?: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation()

    if (
      !canRunContentListAction({
        action: kind,
        canPublishContent,
        canUpdateContent,
        page: pageRecord,
      })
    ) {
      return
    }

    setActionError(null)
    setSelectedAction({ kind, page: pageRecord })
  }

  const openContentDetail = (pageRecord: ContentPageRecord) => {
    navigate(`${routePaths.content}/${pageRecord.pageId}`)
  }

  const openCustomerAppHomeDetail = () => {
    navigate(routePaths.customerAppHome)
  }

  const openContentAudit = (pageRecord: ContentPageRecord) => {
    navigate(buildContentAuditPath(pageRecord))
  }

  const renderRowActions = (pageRecord: ContentPageRecord) => {
    const canPublish = canRunContentListAction({
      action: 'PUBLISH',
      canPublishContent,
      canUpdateContent,
      page: pageRecord,
    })
    const canArchive = canRunContentListAction({
      action: 'ARCHIVE',
      canPublishContent,
      canUpdateContent,
      page: pageRecord,
    })

    return (
      <div className="flex min-w-0 flex-nowrap items-center justify-start gap-1.5 xl:justify-end">
        <Button
          className="h-8 min-h-8 whitespace-nowrap px-2.5"
          size="sm"
          title="Open content detail"
          type="button"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation()
            openContentDetail(pageRecord)
          }}
        >
          <ArrowUpRight className="mr-1.5 size-3.5" />
          Open
        </Button>
        {canPublish ? (
          <Button
            className="h-8 min-h-8 whitespace-nowrap px-2.5"
            disabled={actionMutation.isPending}
            size="sm"
            title="Publish content page"
            type="button"
            onClick={(event) => openContentAction('PUBLISH', pageRecord, event)}
          >
            <Send className="mr-1.5 size-3.5" />
            Publish
          </Button>
        ) : null}
        {canArchive ? (
          <button
            aria-label={`Archive ${pageRecord.title}`}
            className="btn-icon size-8 min-h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionMutation.isPending}
            title="Archive content page"
            type="button"
            onClick={(event) => openContentAction('ARCHIVE', pageRecord, event)}
          >
            <Archive className="size-3.5" />
          </button>
        ) : null}
        {canReadAudit ? (
          <button
            aria-label={`Open audit logs for ${pageRecord.title}`}
            className="btn-icon size-8 min-h-8 shrink-0"
            title="Open audit logs"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              openContentAudit(pageRecord)
            }}
          >
            <ClipboardList className="size-3.5" />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <PageContainer className="flex min-h-full flex-col gap-3 !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        description="Manage customer-facing pages and customer app home content."
        layout="workspace"
        placement="topbar"
        title="Content"
      />

      {actionMessage ? (
        <div className="shrink-0 rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
          {actionMessage}
        </div>
      ) : null}

      <CustomerAppHomeSurface
        home={appHome}
        isError={appHomeQuery.isError}
        isLoading={appHomeQuery.isLoading}
        isRefreshing={appHomeQuery.isFetching}
        onOpen={openCustomerAppHomeDetail}
        onRetry={() => void appHomeQuery.refetch()}
      />

      <main
        className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1"
        id="content-pages"
      >
        <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(11rem,auto)_minmax(22rem,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Content pages</h2>
              <span
                className={cn(
                  'rounded-full border border-border bg-surface-muted/65 px-2 py-0.5 text-xs font-medium',
                  isRefreshing ? 'text-primary' : 'text-muted',
                )}
              >
                {pagination
                  ? `${pagination.totalItems} pages`
                  : `${pages.length} loaded`}
              </span>
            </div>

            <ListHeaderSearch
              className="w-full min-w-0"
              placeholder="Search content..."
              value={search}
              onChange={(value) => {
                clearSeededContentParams()
                setSearch(value)
                resetToFirstPage()
              }}
            />

            <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
              <Button
                aria-expanded={filtersOpen}
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <Filter className="mr-2 size-4" />
                Filters
                {hasActiveFilters ? (
                  <span className="ml-1 size-2 rounded-full bg-primary" />
                ) : null}
              </Button>
              <div className="relative" ref={columnMenuRef}>
                <Button
                  aria-expanded={isColumnMenuOpen}
                  aria-haspopup="menu"
                  className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setIsColumnMenuOpen((current) => !current)}
                >
                  <SlidersHorizontal className="mr-2 size-4" />
                  Columns
                  <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                    {visibleColumns.length}
                  </span>
                </Button>
                {isColumnMenuOpen ? (
                  <div
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-60 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
                    role="menu"
                  >
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-normal text-muted">
                      Visible columns
                    </p>
                    {contentDataColumns.map((column) => {
                      const isChecked = visibleColumns.includes(column.id)
                      const isRequiredLastColumn = isChecked && visibleColumns.length === 1

                      return (
                        <label
                          className={cn(
                            'flex min-h-9 cursor-pointer items-center gap-2 rounded-[0.65rem] px-2 text-sm text-foreground hover:bg-surface-muted',
                            isRequiredLastColumn && 'cursor-not-allowed opacity-60',
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
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                isLoading={isRefreshing}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => {
                  void appHomeQuery.refetch()
                  void contentQuery.refetch()
                  void queueCountsQuery.refetch()
                }}
              >
                <RefreshCcw className="mr-2 size-4" />
                Refresh
              </Button>
              {canCreateContent ? (
                <Link to={`${routePaths.content}/new`}>
                  <Button size="sm" type="button">
                    <FilePlus2 className="mr-2 size-4" />
                    New
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto rounded-[0.875rem] border border-border bg-surface-muted/40 p-1">
            {queueItems.map((queue) => {
              const isActive = queueKey === queue.key

              return (
                <button
                  aria-pressed={isActive}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-2 rounded-[0.65rem] border px-2.5 text-sm font-medium transition',
                    isActive
                      ? 'border-primary/30 bg-surface text-primary shadow-[var(--sg-shadow-surface)]'
                      : 'border-transparent text-muted hover:bg-surface hover:text-foreground',
                  )}
                  key={queue.key}
                  type="button"
                  onClick={() => applyQueue(queue.key)}
                >
                  <span>{queue.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface text-muted',
                    )}
                  >
                    {queue.count ?? '...'}
                  </span>
                </button>
              )
            })}
          </div>

          {filtersOpen || hasActiveFilters ? (
            <div className="mt-2 rounded-[0.75rem] border border-border bg-surface-muted/45 p-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(9rem,0.8fr)_minmax(11rem,1fr)_minmax(10rem,0.8fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_auto] lg:items-end">
                <MultiSelectFilter
                  label="Status"
                  options={buildLookupOptions(statuses)}
                  placeholder="All statuses"
                  values={statusesFilter}
                  onChange={(values) => {
                    clearSeededContentParams()
                    setStatusesFilter(values as ContentPageStatus[])
                    setQueueKey(values.length > 0 ? 'custom' : 'all')
                    resetToFirstPage()
                  }}
                />
                <MultiSelectFilter
                  label="Type"
                  options={buildLookupOptions(pageTypes)}
                  placeholder="All types"
                  values={pageTypesFilter}
                  onChange={(values) => {
                    clearSeededContentParams()
                    setPageTypesFilter(values as ContentPageType[])
                    resetToFirstPage()
                  }}
                />
                <MultiSelectFilter
                  label="Format"
                  options={buildLookupOptions(formats)}
                  placeholder="All formats"
                  values={formatsFilter}
                  onChange={(values) => {
                    clearSeededContentParams()
                    setFormatsFilter(values as ContentFormat[])
                    resetToFirstPage()
                  }}
                />
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Visible</span>
                  <select
                    className="h-10 w-full rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                    value={visibility}
                    onChange={(event) => {
                      clearSeededContentParams()
                      setVisibility(event.target.value as 'all' | 'hidden' | 'visible')
                      setQueueKey(event.target.value === 'all' ? 'all' : 'custom')
                      resetToFirstPage()
                    }}
                  >
                    <option value="all">All</option>
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Updated from</span>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      clearSeededContentParams()
                      setDateFrom(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Updated to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      clearSeededContentParams()
                      setDateTo(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>
                <Button
                  className="w-full lg:w-auto"
                  disabled={!hasActiveFilters}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={clearFilters}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {contentQuery.isError ? (
          <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <ErrorState
              description="Retry the content list."
              title="Content unavailable"
              onRetry={() => void contentQuery.refetch()}
            />
          </div>
        ) : isLoading ? (
          <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <TableSkeleton columnCount={visibleColumns.length + 2} hasFooter rowCount={8} />
          </div>
        ) : pages.length === 0 ? (
          <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <EmptyState
              actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
              description={hasActiveFilters ? 'No matches.' : 'Library is empty.'}
              title="No content pages"
              onAction={hasActiveFilters ? clearFilters : undefined}
            />
          </div>
        ) : (
          <div
            className={cn(
              'grid xl:min-h-0 xl:flex-1',
              previewPage &&
                'xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-3 xl:p-3',
            )}
          >
            <div className="flex min-w-0 flex-col xl:min-h-0">
              <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                <div
                  className="min-w-0 xl:min-w-[var(--content-grid-min-width)]"
                  style={gridStyle}
                >
                  <div className="sticky top-0 z-30 hidden gap-x-3 grid-cols-[var(--content-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted shadow-[0_1px_0_var(--adaptive-border)] xl:grid">
                    <div className="flex min-w-0 items-center">
                      <ListSelectionCheckbox
                        checked={contentSelection.allVisibleSelected}
                        indeterminate={contentSelection.someVisibleSelected}
                        label="Select visible content pages"
                        onChange={contentSelection.setVisibleSelected}
                      />
                    </div>
                    {visibleColumns.map((columnId) => {
                      const column = contentDataColumns.find((item) => item.id === columnId)

                      return (
                        <div
                          className="group relative flex min-w-0 items-center pr-3"
                          key={columnId}
                        >
                          <span className="truncate">{column?.label}</span>
                          <button
                            aria-label={`Resize ${column?.label ?? columnId} column`}
                            className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Drag to resize"
                            type="button"
                            onPointerDown={(event) => startColumnResize(columnId, event)}
                          >
                            <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                          </button>
                        </div>
                      )
                    })}
                    <div className="workbench-sticky-action-head flex min-w-0 pr-3">
                      <span className="truncate">Actions</span>
                    </div>
                  </div>
                  <ListSelectionToolbar
                    allVisibleSelected={contentSelection.allVisibleSelected}
                    selectedCount={contentSelection.selectedCount}
                    visibleCount={contentSelection.visibleCount}
                    onClear={contentSelection.clearSelection}
                    onSelectVisible={() => contentSelection.setVisibleSelected(true)}
                  />

                  <div>
                    {pages.map((contentPage) => {
                      const isPreviewed = previewPageId === contentPage.pageId
                      const isSelected = contentSelection.isSelected(contentPage.pageId)

                      return (
                        <article
                          aria-label={`Preview ${contentPage.title}`}
                          aria-selected={isPreviewed || isSelected}
                          className={cn(
                            'workbench-grid-row grid min-w-0 cursor-pointer gap-2 border-b border-border bg-surface px-3 py-2 transition last:border-b-0 hover:bg-surface-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset xl:grid-cols-[var(--content-grid-template)] xl:items-center xl:gap-x-3',
                            isPreviewed &&
                              'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
                            isSelected && 'bg-primary/5 hover:bg-primary/10',
                          )}
                          key={contentPage.pageId}
                          role="button"
                          tabIndex={0}
                          onClick={() => setPreviewPageId(contentPage.pageId)}
                          onKeyDown={(keyboardEvent) => {
                            if (keyboardEvent.target !== keyboardEvent.currentTarget) return

                            if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                              keyboardEvent.preventDefault()
                              setPreviewPageId(contentPage.pageId)
                            }
                          }}
                        >
                          <div className="flex min-w-0 items-start xl:items-center">
                            <ListSelectionCheckbox
                              checked={isSelected}
                              label={`Select ${contentPage.title}`}
                              onChange={(selected) =>
                                contentSelection.setItemSelected(
                                  contentPage.pageId,
                                  selected,
                                )
                              }
                            />
                          </div>
                          {visibleColumns.map((columnId) => (
                            <div
                              className="min-w-0 text-sm"
                              key={`${contentPage.pageId}-${columnId}`}
                            >
                              <ContentCell columnId={columnId} page={contentPage} />
                            </div>
                          ))}
                          <div className="workbench-sticky-action-cell flex min-w-0 py-1 pl-2 text-sm">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-muted xl:hidden">
                              Actions
                            </span>
                            {renderRowActions(contentPage)}
                          </div>
                        </article>
                      )
                    })}
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

            {previewPage ? (
              <ContentPreviewPanel
                canPublishContent={canPublishContent}
                canReadAudit={canReadAudit}
                canUpdateContent={canUpdateContent}
                isSubmitting={actionMutation.isPending}
                page={previewPage}
                onClose={() => setPreviewPageId(null)}
                onOpenAction={openContentAction}
                onOpenAudit={openContentAudit}
                onOpenDetails={openContentDetail}
              />
            ) : null}
          </div>
        )}
      </main>

      {selectedAction ? (
        <ContentActionModal
          action={selectedAction}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          key={`${selectedAction.kind}-${selectedAction.page.pageId}`}
          onClose={() => {
            if (!actionMutation.isPending) {
              setSelectedAction(null)
              setActionError(null)
            }
          }}
          onSubmit={(reason) =>
            actionMutation.mutate({
              action: selectedAction.kind,
              pageRecord: selectedAction.page,
              reason,
            })
          }
        />
      ) : null}
    </PageContainer>
  )
}
