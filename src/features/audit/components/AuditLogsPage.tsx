import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileJson,
  Filter,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react'
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
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { buildPathWithQueryParams } from '../../../utils/buildQueryParams'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { auditService } from '../services/audit.service'
import type { AuditLog, AuditLogsQueryParams, AuditPagination } from '../types/audit.types'

const DEFAULT_PAGE_SIZE = 10
const AUDIT_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.audit.columnWidths.v1'
const AUDIT_DEFAULT_COLUMN_WIDTH = 220
const AUDIT_GRID_COLUMN_GAP = 12
const AUDIT_GRID_INLINE_PADDING = 24
const AUDIT_ACTION_COLUMN_WIDTH = 224
const emptyAuditLogs: AuditLog[] = []

type AuditColumnId = 'action' | 'actor' | 'entity' | 'reason' | 'request' | 'createdAt'
type AuditColumnWidths = Record<AuditColumnId, number>
type AuditFilterParamKey =
  | 'actionCode'
  | 'action'
  | 'actorAdminId'
  | 'actorUserId'
  | 'dateFrom'
  | 'dateTo'
  | 'entityId'
  | 'entityType'
  | 'module'
  | 'moduleCode'
  | 'search'
type AuditFilterParamValues = Partial<Record<AuditFilterParamKey, string | null | undefined>>

interface AuditGridStyle extends CSSProperties {
  '--audit-grid-template': string
  '--audit-grid-min-width': string
}

interface AuditColumn {
  id: AuditColumnId
  label: string
  minWidth: number
  render: (log: AuditLog) => ReactNode
}

const auditColumns: AuditColumn[] = [
  {
    id: 'action',
    label: 'Action',
    minWidth: 190,
    render: (log) => (
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge tone={moduleTone(log.moduleCode)}>{humanizeCode(log.moduleCode)}</Badge>
          <span className="truncate text-xs font-semibold text-muted">
            {humanizeCode(log.actionCode)}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-muted">{log.auditLogId}</p>
      </div>
    ),
  },
  {
    id: 'actor',
    label: 'Actor',
    minWidth: 220,
    render: (log) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">
          {log.actor.adminName ?? log.actor.email ?? humanizeCode(log.actor.actorType)}
        </p>
        <p className="truncate text-xs text-muted">
          {log.actor.email ?? log.actor.actorAdminId ?? log.actor.actorUserId ?? 'No actor id'}
        </p>
      </div>
    ),
  },
  {
    id: 'entity',
    label: 'Entity',
    minWidth: 210,
    render: (log) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {humanizeCode(log.entityType)}
        </p>
        <p className="truncate text-xs text-muted">{log.entityId ?? 'No entity id'}</p>
      </div>
    ),
  },
  {
    id: 'reason',
    label: 'Reason',
    minWidth: 230,
    render: (log) => (
      <p className="line-clamp-2 text-sm text-foreground">
        {log.reason || <span className="text-muted">No reason recorded</span>}
      </p>
    ),
  },
  {
    id: 'request',
    label: 'Request',
    minWidth: 210,
    render: (log) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{log.requestId}</p>
        <p className="truncate text-xs text-muted">{log.ipAddress ?? 'IP not available'}</p>
      </div>
    ),
  },
  {
    id: 'createdAt',
    label: 'Created',
    minWidth: 180,
    render: (log) => (
      <div className="min-w-0">
        <p className="font-medium text-foreground">{formatDate(log.createdAt, true)}</p>
        <p className="text-xs text-muted">{relativeDate(log.createdAt)}</p>
      </div>
    ),
  },
]

const defaultAuditColumns = auditColumns.map((column) => column.id)
const defaultAuditColumnWidths = Object.fromEntries(
  auditColumns.map((column) => [
    column.id,
    Math.max(column.minWidth, AUDIT_DEFAULT_COLUMN_WIDTH),
  ]),
) as AuditColumnWidths

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function moduleTone(moduleCode: string): StatusTone {
  const normalized = moduleCode.toLowerCase()

  if (['payments', 'refunds', 'payouts'].includes(normalized)) return 'warning'
  if (['rbac', 'settings', 'audit'].includes(normalized)) return 'info'
  if (['vendors', 'orders', 'customers'].includes(normalized)) return 'success'

  return 'neutral'
}

function relativeDate(value: string) {
  const timestamp = new Date(value).getTime()

  if (!Number.isFinite(timestamp)) return 'Time not available'

  const diffMs = Date.now() - timestamp
  const minutes = Math.max(0, Math.round(diffMs / 60_000))

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`

  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function formatRefreshTime(value: number) {
  if (!value) return 'Not refreshed yet'

  return `Last refreshed ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))}`
}

function valueToSearchText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function logMatchesSearch(log: AuditLog, search: string) {
  const term = search.trim().toLowerCase()
  if (!term) return true

  return [
    log.auditLogId,
    log.moduleCode,
    log.actionCode,
    log.entityType,
    log.entityId,
    log.reason,
    log.requestId,
    log.ipAddress,
    log.actor.adminName,
    log.actor.email,
    log.actor.actorAdminId,
    log.actor.actorUserId,
    valueToSearchText(log.oldValue),
    valueToSearchText(log.newValue),
  ].some((value) => valueToSearchText(value).toLowerCase().includes(term))
}

function normalizeEntityType(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function buildAuditSearchParams(values: AuditFilterParamValues) {
  const params = new URLSearchParams()

  Object.entries(values).forEach(([key, value]) => {
    const normalized = value?.trim()

    if (normalized) {
      params.set(key, normalized)
    }
  })

  return params
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getRecordString(value: unknown, key: string) {
  if (!isPlainRecord(value)) return null

  const fieldValue = value[key]

  return typeof fieldValue === 'string' && fieldValue.trim()
    ? fieldValue.trim()
    : null
}

function getNestedRecordString(value: unknown, parentKey: string, key: string) {
  if (!isPlainRecord(value)) return null

  return getRecordString(value[parentKey], key)
}

function getSnapshotString(log: AuditLog, key: string) {
  return getRecordString(log.newValue, key) ?? getRecordString(log.oldValue, key)
}

function getNestedSnapshotString(log: AuditLog, parentKey: string, key: string) {
  return (
    getNestedRecordString(log.newValue, parentKey, key) ??
    getNestedRecordString(log.oldValue, parentKey, key)
  )
}

function changedTopLevelKeys(oldValue: unknown, newValue: unknown) {
  if (!isPlainRecord(oldValue) && !isPlainRecord(newValue)) return []

  const oldRecord = isPlainRecord(oldValue) ? oldValue : {}
  const newRecord = isPlainRecord(newValue) ? newValue : {}
  const keys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])

  return Array.from(keys)
    .filter(
      (key) => JSON.stringify(oldRecord[key] ?? null) !== JSON.stringify(newRecord[key] ?? null),
    )
    .sort((left, right) => left.localeCompare(right))
}

function snapshotSummary(value: unknown) {
  if (value === null || value === undefined) return 'No snapshot'
  if (Array.isArray(value)) return `${value.length} array item${value.length === 1 ? '' : 's'}`
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>)
    return `${keys.length} field${keys.length === 1 ? '' : 's'}`
  }

  return typeof value
}

function getDateRangeError(dateFrom: string, dateTo: string) {
  if (!dateFrom || !dateTo) return null

  return new Date(dateFrom).getTime() <= new Date(dateTo).getTime()
    ? null
    : 'From date must be before To date.'
}

function normalizeAuditColumnWidths(value: unknown): AuditColumnWidths {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultAuditColumnWidths
  }

  const record = value as Record<string, unknown>
  const widths = { ...defaultAuditColumnWidths }

  auditColumns.forEach((column) => {
    const width = record[column.id]

    if (typeof width === 'number' && Number.isFinite(width)) {
      widths[column.id] = Math.max(column.minWidth, Math.round(width))
    }
  })

  return widths
}

function loadAuditColumnWidths() {
  if (typeof window === 'undefined') return defaultAuditColumnWidths

  try {
    return normalizeAuditColumnWidths(
      JSON.parse(window.localStorage.getItem(AUDIT_COLUMN_WIDTH_STORAGE_KEY) ?? 'null'),
    )
  } catch {
    return defaultAuditColumnWidths
  }
}

function getAuditColumnWidth(widths: AuditColumnWidths, columnId: AuditColumnId) {
  const column = auditColumns.find((item) => item.id === columnId)
  const minWidth = column?.minWidth ?? AUDIT_DEFAULT_COLUMN_WIDTH

  return Math.max(minWidth, widths[columnId] ?? AUDIT_DEFAULT_COLUMN_WIDTH)
}

function getAuditGridTemplate(
  visibleColumns: AuditColumnId[],
  columnWidths: AuditColumnWidths,
) {
  const selectedWidths = auditColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => `${getAuditColumnWidth(columnWidths, column.id)}px`)

  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...selectedWidths,
    `${AUDIT_ACTION_COLUMN_WIDTH}px`,
  ].join(' ')
}

function getAuditGridMinWidth(
  visibleColumns: AuditColumnId[],
  columnWidths: AuditColumnWidths,
) {
  const gridColumnCount = visibleColumns.length + 2
  const gridGapWidth = Math.max(gridColumnCount - 1, 0) * AUDIT_GRID_COLUMN_GAP
  const visibleWidth = auditColumns
    .filter((column) => visibleColumns.includes(column.id))
    .reduce((total, column) => total + getAuditColumnWidth(columnWidths, column.id), 0)

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    AUDIT_ACTION_COLUMN_WIDTH +
    gridGapWidth +
    AUDIT_GRID_INLINE_PADDING
  }px`
}

function ActiveFilterChips({
  chips,
  onClearAll,
}: {
  chips: { key: string; label: string; onClear: () => void }[]
  onClearAll: () => void
}) {
  if (chips.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:bg-surface-muted"
          key={chip.key}
          type="button"
          onClick={chip.onClear}
        >
          <span>{chip.label}</span>
          <X className="size-3.5 text-muted" />
        </button>
      ))}
      <button
        className="h-8 px-2 text-xs font-semibold text-primary"
        type="button"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  )
}

function AuditRowsSkeleton() {
  return (
    <div className="space-y-2.5 p-3">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="h-16 w-full rounded-[0.875rem]" key={index} />
      ))}
    </div>
  )
}

function AuditPaginationControls({
  onPageChange,
  onPageSizeChange,
  pagination,
}: {
  onPageChange: (page: number) => void
  onPageSizeChange: (limit: number) => void
  pagination?: AuditPagination
}) {
  if (!pagination) return null

  const start =
    pagination.totalItems === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.totalItems)

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface-muted px-3 py-2.5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing {start}-{end} of {pagination.totalItems}
        </span>
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select
            aria-label="Rows per page"
            className="h-9 rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
            value={pagination.limit}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[10, 20, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3 sm:justify-end">
        <button
          aria-label="Previous page"
          className="btn-icon"
          disabled={!pagination.hasPreviousPage}
          type="button"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium text-foreground">
          Page {pagination.page} of {Math.max(1, pagination.totalPages)}
        </span>
        <button
          aria-label="Next page"
          className="btn-icon"
          disabled={!pagination.hasNextPage}
          type="button"
          onClick={() => onPageChange(pagination.page + 1)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

interface AuditEntityAccess {
  adminUsers: boolean
  content: boolean
  customers: boolean
  influencers: boolean
  notifications: boolean
  orders: boolean
  payments: boolean
  payouts: boolean
  reels: boolean
  reports: boolean
  roles: boolean
  settings: boolean
  vendors: boolean
}

interface RelatedEntityLink {
  label: string
  path: string
  canOpen: boolean
}

function buildPlatformSettingPath(log: AuditLog) {
  const settingKey = getSnapshotString(log, 'settingKey')

  if (settingKey) {
    return `${routePaths.settings}/settings/${encodeURIComponent(settingKey)}`
  }

  return buildPathWithQueryParams(routePaths.settings, {
    search: log.entityId,
    type: 'settings',
  }) + '#settings-records'
}

function buildServiceTypePath(log: AuditLog) {
  const categoryId = getSnapshotString(log, 'categoryId')

  if (!categoryId) return null

  return `${routePaths.settings}/categories/${encodeURIComponent(
    categoryId,
  )}#settings-service-types`
}

function buildPolicyRulePath(log: AuditLog) {
  const family = getSnapshotString(log, 'family')
  const status = getSnapshotString(log, 'status')
  const scopeType =
    getNestedSnapshotString(log, 'scope', 'scopeType') ??
    getSnapshotString(log, 'scopeType')

  return buildPathWithQueryParams(routePaths.settings, {
    family,
    scopeType,
    status,
    type: 'policies',
  }) + '#settings-policy-rules'
}

function getRelatedEntityLink(
  log: AuditLog,
  access: AuditEntityAccess,
): RelatedEntityLink | null {
  if (!log.entityId) return null

  const entityType = normalizeEntityType(log.entityType)

  if (entityType === 'admin_user') {
    return {
      canOpen: access.adminUsers,
      label: 'Admin user',
      path: `${routePaths.adminUsers}/${log.entityId}`,
    }
  }

  if (entityType === 'role') {
    return {
      canOpen: access.roles,
      label: 'Role',
      path: `${routePaths.roles}/${log.entityId}`,
    }
  }

  if (entityType === 'customer') {
    return {
      canOpen: access.customers,
      label: 'Customer',
      path: `${routePaths.customers}/${log.entityId}`,
    }
  }

  if (entityType === 'vendor') {
    return {
      canOpen: access.vendors,
      label: 'Vendor',
      path: `${routePaths.vendors}/${log.entityId}`,
    }
  }

  if (entityType === 'order') {
    return {
      canOpen: access.orders,
      label: 'Order',
      path: `${routePaths.orders}/${log.entityId}`,
    }
  }

  if (entityType === 'payment') {
    return {
      canOpen: access.payments,
      label: 'Payment',
      path: `${routePaths.payments}/${log.entityId}`,
    }
  }

  if (entityType === 'refund') {
    return {
      canOpen: access.payments,
      label: 'Refund',
      path: `${routePaths.refunds}/${log.entityId}`,
    }
  }

  if (entityType === 'payout') {
    return {
      canOpen: access.payouts,
      label: 'Payout',
      path: `${routePaths.payouts}/${log.entityId}`,
    }
  }

  if (entityType === 'reel') {
    return {
      canOpen: access.reels,
      label: 'Reel',
      path: `${routePaths.reels}/${log.entityId}`,
    }
  }

  if (entityType === 'customer_influencer_profile') {
    return {
      canOpen: access.influencers,
      label: 'Influencer profile',
      path: `${routePaths.influencers}/${log.entityId}`,
    }
  }

  if (entityType === 'notification_event') {
    return {
      canOpen: access.notifications,
      label: 'Notification event',
      path: `${routePaths.notifications}/${log.entityId}`,
    }
  }

  if (entityType === 'content_page') {
    return {
      canOpen: access.content,
      label: 'Content page',
      path: `${routePaths.content}/${log.entityId}`,
    }
  }

  if (entityType === 'report_export') {
    return {
      canOpen: access.reports,
      label: 'Report export',
      path: `${routePaths.reports}/exports/${log.entityId}`,
    }
  }

  if (entityType === 'platform_setting') {
    return {
      canOpen: access.settings,
      label: 'Platform setting',
      path: buildPlatformSettingPath(log),
    }
  }

  if (entityType === 'service_category') {
    return {
      canOpen: access.settings,
      label: 'Service category',
      path: `${routePaths.settings}/categories/${log.entityId}`,
    }
  }

  if (entityType === 'service_zone') {
    return {
      canOpen: access.settings,
      label: 'Service zone',
      path: `${routePaths.settings}/zones/${log.entityId}`,
    }
  }

  if (entityType === 'service_type') {
    const path = buildServiceTypePath(log)

    if (!path) return null

    return {
      canOpen: access.settings,
      label: 'Service type',
      path,
    }
  }

  if (entityType === 'policy_rule') {
    return {
      canOpen: access.settings,
      label: 'Policy rules',
      path: buildPolicyRulePath(log),
    }
  }

  return null
}

function getActorAdminLink(
  log: AuditLog,
  canReadAdminUsers: boolean,
): RelatedEntityLink | null {
  if (!log.actor.actorAdminId) return null

  return {
    canOpen: canReadAdminUsers,
    label: 'Actor admin',
    path: `${routePaths.adminUsers}/${log.actor.actorAdminId}`,
  }
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {title}
      </p>
      <pre className="mt-2 max-h-52 overflow-auto rounded-[0.65rem] bg-surface-muted p-3 text-xs leading-5 text-foreground">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </div>
  )
}

function AuditDetailField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/35 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-1.5 break-words text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </div>
    </div>
  )
}

function AuditEventFact({
  label,
  meta,
  value,
}: {
  label: string
  meta?: ReactNode
  value: ReactNode
}) {
  return (
    <div className="min-w-0 border-border/80 py-1 sm:border-l sm:pl-4 sm:first:border-l-0 sm:first:pl-0">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">
        {value ?? 'Not available'}
      </div>
      {meta ? <p className="mt-0.5 truncate text-xs text-muted">{meta}</p> : null}
    </div>
  )
}

function AuditDetailSection({
  actionNode,
  children,
  description,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  title: string
}) {
  return (
    <section className="rounded-[0.875rem] border border-border bg-surface p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
          ) : null}
        </div>
        {actionNode ? <div className="shrink-0">{actionNode}</div> : null}
      </div>
      {children}
    </section>
  )
}

function RelatedAuditRow({
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
        <Button
          className="shrink-0"
          size="sm"
          type="button"
          variant="secondary"
          onClick={onOpen}
        >
          <ArrowUpRight className="mr-2 size-4" />
          {actionLabel}
        </Button>
      ) : (
        <Badge tone="neutral">View only</Badge>
      )}
    </div>
  )
}

function AuditDetailModal({
  actorAdminLink,
  log,
  onClose,
  onFilterActor,
  onFilterEntity,
  onFilterModuleAction,
  onOpenActorAdmin,
  onOpenRelated,
  onSearchRequest,
  relatedEntityLink,
}: {
  actorAdminLink: RelatedEntityLink | null
  log: AuditLog
  onClose: () => void
  onFilterActor: () => void
  onFilterEntity: () => void
  onFilterModuleAction: () => void
  onOpenActorAdmin: () => void
  onOpenRelated: () => void
  onSearchRequest: () => void
  relatedEntityLink: RelatedEntityLink | null
}) {
  const changedKeys = changedTopLevelKeys(log.oldValue, log.newValue)
  const actorLabel =
    log.actor.adminName ??
    log.actor.email ??
    log.actor.actorAdminId ??
    log.actor.actorUserId ??
    humanizeCode(log.actor.actorType)
  const hasActorFilter = Boolean(log.actor.actorAdminId || log.actor.actorUserId)

  return (
    <div className="premium-overlay flex items-start justify-center overflow-y-auto p-3 sm:p-6 lg:items-center">
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[calc(100vh-3rem)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={moduleTone(log.moduleCode)}>
                {humanizeCode(log.moduleCode)}
              </Badge>
              <Badge tone="neutral">{humanizeCode(log.actionCode)}</Badge>
              <Badge tone={log.reason ? 'success' : 'warning'}>
                {log.reason ? 'Reason recorded' : 'No reason'}
              </Badge>
            </div>
            <h2 className="mt-2 break-words text-lg font-semibold text-foreground">
              {humanizeCode(log.actionCode)}
            </h2>
            <p className="mt-1 break-all text-sm text-muted">
              {humanizeCode(log.moduleCode)} · {log.auditLogId}
            </p>
          </div>
          <button
            aria-label="Close audit detail"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <section className="rounded-[0.875rem] border border-border bg-surface-muted/35 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AuditEventFact
                label="Actor"
                meta={humanizeCode(log.actor.actorType)}
                value={actorLabel}
              />
              <AuditEventFact
                label="Entity"
                meta={log.entityId ?? 'No entity id'}
                value={humanizeCode(log.entityType)}
              />
              <AuditEventFact
                label="Changed fields"
                meta="Top-level diff"
                value={changedKeys.length}
              />
              <AuditEventFact
                label="Created"
                meta={relativeDate(log.createdAt)}
                value={formatDate(log.createdAt, true)}
              />
            </div>
          </section>

          <section className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.55fr)]">
            <div className="space-y-3">
              <AuditDetailSection
                actionNode={
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      disabled={!hasActorFilter}
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={onFilterActor}
                    >
                      <Filter className="mr-2 size-4" />
                      Filter actor
                    </Button>
                    {actorAdminLink ? (
                      <Button
                        disabled={!actorAdminLink.canOpen}
                        size="sm"
                        type="button"
                        onClick={onOpenActorAdmin}
                      >
                        <ArrowUpRight className="mr-2 size-4" />
                        Admin
                      </Button>
                    ) : null}
                  </div>
                }
                title="Actor"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <AuditDetailField label="Actor type" value={humanizeCode(log.actor.actorType)} />
                  <AuditDetailField label="Admin name" value={log.actor.adminName} />
                  <AuditDetailField label="Email" value={log.actor.email} />
                  <AuditDetailField label="Admin ID" value={log.actor.actorAdminId} />
                  <AuditDetailField label="User ID" value={log.actor.actorUserId} />
                  <AuditDetailField label="User status" value={humanizeCode(log.actor.userStatus)} />
                </div>
              </AuditDetailSection>

              <AuditDetailSection
                actionNode={
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      disabled={!log.entityId}
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={onFilterEntity}
                    >
                      <Filter className="mr-2 size-4" />
                      Filter entity
                    </Button>
                    {relatedEntityLink ? (
                      <Button
                        disabled={!relatedEntityLink.canOpen}
                        size="sm"
                        type="button"
                        onClick={onOpenRelated}
                      >
                        <ArrowUpRight className="mr-2 size-4" />
                        Open
                      </Button>
                    ) : null}
                  </div>
                }
                title="Entity"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <AuditDetailField label="Entity type" value={humanizeCode(log.entityType)} />
                  <AuditDetailField label="Entity ID" value={log.entityId} />
                  <AuditDetailField
                    label="Related route"
                    value={
                      relatedEntityLink
                        ? relatedEntityLink.canOpen
                          ? relatedEntityLink.label
                          : `${relatedEntityLink.label} permission required`
                        : 'No direct route'
                    }
                  />
                  <AuditDetailField label="Reason" value={log.reason} />
                </div>
              </AuditDetailSection>
            </div>

            <div className="space-y-3">
              <AuditDetailSection
                title="Related records"
              >
                <div className="divide-y divide-border">
                  <RelatedAuditRow
                    actionLabel="Open"
                    canOpen={Boolean(relatedEntityLink?.canOpen)}
                    icon={<FileJson className="size-4" />}
                    label="Target record"
                    meta={
                      relatedEntityLink
                        ? relatedEntityLink.canOpen
                          ? relatedEntityLink.label
                          : `${relatedEntityLink.label} permission required`
                        : 'No standalone admin route'
                    }
                    value={log.entityId ?? 'No entity id'}
                    onOpen={onOpenRelated}
                  />
                  <RelatedAuditRow
                    actionLabel="History"
                    canOpen={Boolean(log.entityId)}
                    icon={<Filter className="size-4" />}
                    label="Entity history"
                    meta={humanizeCode(log.entityType)}
                    value={log.entityId ?? 'No entity id'}
                    onOpen={onFilterEntity}
                  />
                  <RelatedAuditRow
                    actionLabel="Admin"
                    canOpen={Boolean(actorAdminLink?.canOpen)}
                    icon={<UserRound className="size-4" />}
                    label="Actor admin"
                    meta={
                      actorAdminLink
                        ? actorAdminLink.canOpen
                          ? actorAdminLink.label
                          : 'Admin user permission required'
                        : humanizeCode(log.actor.actorType)
                    }
                    value={actorLabel}
                    onOpen={onOpenActorAdmin}
                  />
                  <RelatedAuditRow
                    actionLabel="Activity"
                    canOpen={hasActorFilter}
                    icon={<UserRound className="size-4" />}
                    label="Actor activity"
                    meta="Filter audit trail by actor id"
                    value={
                      log.actor.actorAdminId ??
                      log.actor.actorUserId ??
                      humanizeCode(log.actor.actorType)
                    }
                    onOpen={onFilterActor}
                  />
                  <RelatedAuditRow
                    actionLabel="Queue"
                    canOpen
                    icon={<ShieldCheck className="size-4" />}
                    label="Module action"
                    meta={humanizeCode(log.moduleCode)}
                    value={humanizeCode(log.actionCode)}
                    onOpen={onFilterModuleAction}
                  />
                  <RelatedAuditRow
                    actionLabel="Search"
                    canOpen
                    icon={<Search className="size-4" />}
                    label="Request correlation"
                    meta={log.ipAddress ?? 'IP not available'}
                    value={log.requestId}
                    onOpen={onSearchRequest}
                  />
                </div>
              </AuditDetailSection>

              <AuditDetailSection
                actionNode={
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={onFilterModuleAction}
                  >
                    <Filter className="mr-2 size-4" />
                    Filter action
                  </Button>
                }
                title="Request"
              >
                <div className="grid gap-3">
                  <AuditDetailField label="Module" value={log.moduleCode} />
                  <AuditDetailField label="Action" value={log.actionCode} />
                  <AuditDetailField label="Request ID" value={log.requestId} />
                  <AuditDetailField label="IP address" value={log.ipAddress} />
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={onSearchRequest}
                  >
                    <Search className="mr-2 size-4" />
                    Search request on page
                  </Button>
                </div>
              </AuditDetailSection>

              <AuditDetailSection
                title="Change signals"
              >
                <div className="flex flex-wrap gap-2">
                  {changedKeys.length ? (
                    changedKeys.map((key) => (
                      <Badge key={key} tone="info">
                        {humanizeCode(key)}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="neutral">No top-level diff</Badge>
                  )}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <AuditDetailField label="Old snapshot" value={snapshotSummary(log.oldValue)} />
                  <AuditDetailField label="New snapshot" value={snapshotSummary(log.newValue)} />
                </div>
              </AuditDetailSection>
            </div>
          </section>

          <section className="mt-4 grid gap-3 xl:grid-cols-2">
            <JsonBlock title="Old value" value={log.oldValue} />
            <JsonBlock title="New value" value={log.newValue} />
          </section>
        </div>
      </div>
    </div>
  )
}

function AuditRow({
  actorAdminLink,
  isSelected,
  log,
  onInspect,
  onOpenActorAdmin,
  onOpenRelated,
  onSelect,
  relatedEntityLink,
  visibleColumns,
}: {
  actorAdminLink: RelatedEntityLink | null
  isSelected: boolean
  log: AuditLog
  onInspect: () => void
  onOpenActorAdmin: () => void
  onOpenRelated: () => void
  onSelect: (log: AuditLog, selected: boolean) => void
  relatedEntityLink: RelatedEntityLink | null
  visibleColumns: AuditColumnId[]
}) {
  const visibleColumnDefinitions = auditColumns.filter((column) =>
    visibleColumns.includes(column.id),
  )

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onInspect()
    }
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        aria-label={`Inspect audit log ${log.auditLogId}`}
        aria-selected={isSelected}
        className={cn(
          'workbench-grid-row grid w-full min-w-0 cursor-pointer gap-3 bg-surface px-3 py-2.5 text-left transition hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--audit-grid-template)] xl:items-center',
          isSelected && 'bg-primary/5 hover:bg-primary/10',
        )}
        role="button"
        tabIndex={0}
        onClick={onInspect}
        onKeyDown={handleKeyDown}
      >
        <div className="flex min-w-0 items-start xl:items-center">
          <ListSelectionCheckbox
            checked={isSelected}
            label={`Select audit log ${log.auditLogId}`}
            onChange={(selected) => onSelect(log, selected)}
          />
        </div>
        {visibleColumnDefinitions.map((column) => (
          <div className="min-w-0" key={column.id}>
            <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-normal text-muted xl:hidden">
              {column.label}
            </p>
            {column.render(log)}
          </div>
        ))}
        <div
          className="workbench-sticky-action-cell flex min-w-0 flex-nowrap items-center gap-1.5 pl-2 xl:justify-end"
          onClick={(event) => event.stopPropagation()}
        >
          <Button size="sm" type="button" variant="secondary" onClick={onInspect}>
            <Eye className="mr-2 size-4" />
            Inspect
          </Button>
          {relatedEntityLink ? (
            <button
              aria-label={`Open ${relatedEntityLink.label}`}
              className="btn-icon shrink-0"
              disabled={!relatedEntityLink.canOpen}
              title={
                relatedEntityLink.canOpen
                  ? `Open ${relatedEntityLink.label}`
                  : `${relatedEntityLink.label} permission required`
              }
              type="button"
              onClick={onOpenRelated}
            >
              <ArrowUpRight className="size-4" />
            </button>
          ) : null}
          {actorAdminLink ? (
            <button
              aria-label="Open actor admin"
              className="btn-icon shrink-0"
              disabled={!actorAdminLink.canOpen}
              title={
                actorAdminLink.canOpen
                  ? 'Open actor admin'
                  : 'Admin user permission required'
              }
              type="button"
              onClick={onOpenActorAdmin}
            >
              <UserRound className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function AuditLogsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const canReadAdminUsers = usePermission('admin_users:read')
  const canReadContent = usePermission('content:read')
  const canReadCustomers = usePermission('customers:read')
  const canReadInfluencers = usePermission('influencers:read')
  const canReadNotifications = usePermission('notifications:read')
  const canReadOrders = usePermission('orders:read')
  const canReadPayments = usePermission('payments:read')
  const canReadPayouts = usePermission('payouts:read')
  const canReadReels = usePermission('reels:read')
  const canReadReports = usePermission('reports:read')
  const canReadRoles = usePermission('roles:read')
  const canReadSettings = usePermission('settings:read')
  const canReadVendors = usePermission('vendors:read')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [moduleCode, setModuleCode] = useState(
    () => searchParams.get('moduleCode') ?? searchParams.get('module') ?? '',
  )
  const [actionCode, setActionCode] = useState(
    () => searchParams.get('actionCode') ?? searchParams.get('action') ?? '',
  )
  const [entityType, setEntityType] = useState(
    () => searchParams.get('entityType') ?? '',
  )
  const [entityId, setEntityId] = useState(() => searchParams.get('entityId') ?? '')
  const [actorAdminId, setActorAdminId] = useState(
    () => searchParams.get('actorAdminId') ?? '',
  )
  const [actorUserId, setActorUserId] = useState(
    () => searchParams.get('actorUserId') ?? '',
  )
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') ?? '')
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [visibleColumns, setVisibleColumns] =
    useState<AuditColumnId[]>(defaultAuditColumns)
  const [columnWidths, setColumnWidths] =
    useState<AuditColumnWidths>(loadAuditColumnWidths)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  const dateRangeError = getDateRangeError(dateFrom, dateTo)
  const hasActiveFilters = Boolean(
    moduleCode ||
      actionCode ||
      entityType ||
      entityId ||
      actorAdminId ||
      actorUserId ||
      dateFrom ||
      dateTo ||
      search,
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(
        AUDIT_COLUMN_WIDTH_STORAGE_KEY,
        JSON.stringify(columnWidths),
      )
    } catch {
      // Width persistence is optional.
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

  const resetToFirstPage = () => {
    setPage(1)
    setSelectedLog(null)
  }

  const query = useMemo<AuditLogsQueryParams>(
    () => ({
      page,
      limit,
      moduleCode: moduleCode.trim() || undefined,
      actionCode: actionCode.trim() || undefined,
      entityType: entityType.trim() || undefined,
      entityId: entityId.trim() || undefined,
      actorAdminId: actorAdminId.trim() || undefined,
      actorUserId: actorUserId.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [
      actionCode,
      actorAdminId,
      actorUserId,
      dateFrom,
      dateTo,
      entityId,
      entityType,
      limit,
      moduleCode,
      page,
    ],
  )

  const auditQuery = useQuery({
    enabled: !dateRangeError,
    queryKey: ['audit-logs', query],
    queryFn: () => auditService.getAuditLogs(query),
  })

  const logs = auditQuery.data?.data ?? emptyAuditLogs
  const pagination = auditQuery.data?.pagination
  const visibleLogs = useMemo(
    () => logs.filter((log) => logMatchesSearch(log, search)),
    [logs, search],
  )
  const auditSelection = useListSelection(visibleLogs, (log) => log.auditLogId)
  const visibleModules = useMemo(() => {
    const counts = new Map<string, number>()

    logs.forEach((log) => {
      counts.set(log.moduleCode, (counts.get(log.moduleCode) ?? 0) + 1)
    })

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [logs])
  const isInitialLoading = auditQuery.isLoading && logs.length === 0
  const isRefreshing = auditQuery.isFetching && !isInitialLoading
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing'
    : formatRefreshTime(auditQuery.dataUpdatedAt)
  const auditGridStyle = useMemo<AuditGridStyle>(
    () => ({
      '--audit-grid-template': getAuditGridTemplate(visibleColumns, columnWidths),
      '--audit-grid-min-width': getAuditGridMinWidth(visibleColumns, columnWidths),
    }),
    [columnWidths, visibleColumns],
  )
  const entityAccess = useMemo<AuditEntityAccess>(
    () => ({
      adminUsers: canReadAdminUsers,
      content: canReadContent,
      customers: canReadCustomers,
      influencers: canReadInfluencers,
      notifications: canReadNotifications,
      orders: canReadOrders,
      payments: canReadPayments,
      payouts: canReadPayouts,
      reels: canReadReels,
      reports: canReadReports,
      roles: canReadRoles,
      settings: canReadSettings,
      vendors: canReadVendors,
    }),
    [
      canReadAdminUsers,
      canReadContent,
      canReadCustomers,
      canReadInfluencers,
      canReadNotifications,
      canReadOrders,
      canReadPayments,
      canReadPayouts,
      canReadReels,
      canReadReports,
      canReadRoles,
      canReadSettings,
      canReadVendors,
    ],
  )
  const selectedRelatedEntityLink = selectedLog
    ? getRelatedEntityLink(selectedLog, entityAccess)
    : null
  const selectedActorAdminLink = selectedLog
    ? getActorAdminLink(selectedLog, canReadAdminUsers)
    : null

  const startColumnResize = (
    columnId: AuditColumnId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getAuditColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          auditColumns.find((column) => column.id === columnId)?.minWidth ??
            AUDIT_DEFAULT_COLUMN_WIDTH,
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

  const adjustColumnWidth = (columnId: AuditColumnId, delta: number) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: Math.max(
        auditColumns.find((column) => column.id === columnId)?.minWidth ??
          AUDIT_DEFAULT_COLUMN_WIDTH,
        getAuditColumnWidth(currentWidths, columnId) + delta,
      ),
    }))
  }

  const resetColumnWidth = (columnId: AuditColumnId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: defaultAuditColumnWidths[columnId],
    }))
  }

  const toggleColumn = (columnId: AuditColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        return currentColumns.length === 1
          ? currentColumns
          : currentColumns.filter((item) => item !== columnId)
      }

      return auditColumns
        .map((column) => column.id)
        .filter((item) => currentColumns.includes(item) || item === columnId)
    })
  }

  const clearSeededAuditParams = () => {
    const seededKeys: AuditFilterParamKey[] = [
      'actionCode',
      'action',
      'actorAdminId',
      'actorUserId',
      'dateFrom',
      'dateTo',
      'entityId',
      'entityType',
      'module',
      'moduleCode',
      'search',
    ]

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const applyAuditFilterState = (values: AuditFilterParamValues) => {
    setModuleCode(values.moduleCode ?? '')
    setActionCode(values.actionCode ?? '')
    setEntityType(values.entityType ?? '')
    setEntityId(values.entityId ?? '')
    setActorAdminId(values.actorAdminId ?? '')
    setActorUserId(values.actorUserId ?? '')
    setDateFrom(values.dateFrom ?? '')
    setDateTo(values.dateTo ?? '')
    setSearch(values.search ?? '')
    setPage(1)
    setSelectedLog(null)
    setSearchParams(buildAuditSearchParams(values), { replace: true })
  }

  const clearFilters = () => {
    applyAuditFilterState({})
  }

  const applyEntityFilter = (log: AuditLog) => {
    applyAuditFilterState({
      entityType: log.entityType,
      entityId: log.entityId,
    })
  }

  const applyActorFilter = (log: AuditLog) => {
    applyAuditFilterState({
      actorAdminId: log.actor.actorAdminId,
      actorUserId: log.actor.actorAdminId ? null : log.actor.actorUserId,
    })
  }

  const applyModuleActionFilter = (log: AuditLog) => {
    applyAuditFilterState({
      moduleCode: log.moduleCode,
      actionCode: log.actionCode,
    })
  }

  const applyRequestSearch = (log: AuditLog) => {
    setSearch(log.requestId)
    setSelectedLog(null)
    setSearchParams(
      buildAuditSearchParams({
        moduleCode,
        actionCode,
        entityType,
        entityId,
        actorAdminId,
        actorUserId,
        dateFrom,
        dateTo,
        search: log.requestId,
      }),
      { replace: true },
    )
  }

  const openRelatedEntity = () => {
    if (!selectedRelatedEntityLink?.canOpen) return

    navigate(selectedRelatedEntityLink.path)
  }

  const openActorAdmin = () => {
    if (!selectedActorAdminLink?.canOpen) return

    navigate(selectedActorAdminLink.path)
  }

  const openRelatedEntityForLog = (log: AuditLog) => {
    const relatedLink = getRelatedEntityLink(log, entityAccess)

    if (!relatedLink?.canOpen) return

    navigate(relatedLink.path)
  }

  const openActorAdminForLog = (log: AuditLog) => {
    const actorLink = getActorAdminLink(log, canReadAdminUsers)

    if (!actorLink?.canOpen) return

    navigate(actorLink.path)
  }

  const setTodayFilter = () => {
    const today = new Date().toISOString().slice(0, 10)

    clearSeededAuditParams()
    setDateFrom(today)
    setDateTo(today)
    resetToFirstPage()
  }

  const activeFilterChips = [
    moduleCode
      ? {
          key: 'module',
          label: `Module: ${humanizeCode(moduleCode)}`,
          onClear: () => {
            clearSeededAuditParams()
            setModuleCode('')
            resetToFirstPage()
          },
        }
      : null,
    actionCode
      ? {
          key: 'action',
          label: `Action: ${humanizeCode(actionCode)}`,
          onClear: () => {
            clearSeededAuditParams()
            setActionCode('')
            resetToFirstPage()
          },
        }
      : null,
    entityType
      ? {
          key: 'entity-type',
          label: `Entity: ${humanizeCode(entityType)}`,
          onClear: () => {
            clearSeededAuditParams()
            setEntityType('')
            resetToFirstPage()
          },
        }
      : null,
    entityId
      ? {
          key: 'entity-id',
          label: `Entity ID: ${entityId}`,
          onClear: () => {
            clearSeededAuditParams()
            setEntityId('')
            resetToFirstPage()
          },
        }
      : null,
    actorAdminId
      ? {
          key: 'actor-admin',
          label: `Actor admin: ${actorAdminId}`,
          onClear: () => {
            clearSeededAuditParams()
            setActorAdminId('')
            resetToFirstPage()
          },
        }
      : null,
    actorUserId
      ? {
          key: 'actor-user',
          label: `Actor user: ${actorUserId}`,
          onClear: () => {
            clearSeededAuditParams()
            setActorUserId('')
            resetToFirstPage()
          },
        }
      : null,
    dateFrom
      ? {
          key: 'date-from',
          label: `From: ${dateFrom}`,
          onClear: () => {
            clearSeededAuditParams()
            setDateFrom('')
            resetToFirstPage()
          },
        }
      : null,
    dateTo
      ? {
          key: 'date-to',
          label: `To: ${dateTo}`,
          onClear: () => {
            clearSeededAuditParams()
            setDateTo('')
            resetToFirstPage()
          },
        }
      : null,
    search
      ? {
          key: 'search',
          label: `Search: ${search}`,
          onClear: () => {
            clearSeededAuditParams()
            setSearch('')
            setSelectedLog(null)
          },
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; onClear: () => void }[]

  const activeContextLabel = [
    moduleCode ? `Module: ${humanizeCode(moduleCode)}` : null,
    entityType ? `Entity: ${humanizeCode(entityType)}` : null,
    actorAdminId || actorUserId ? 'Actor filtered' : null,
    dateFrom || dateTo ? 'Date filtered' : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const resultSummary = pagination
    ? `${visibleLogs.length} visible · ${pagination.totalItems} backend matches`
    : 'Backend audit trail'

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader layout="workspace" placement="topbar" title="Audit Logs" />

      <main
        className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1"
        id="audit-records"
      >
        <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(9rem,auto)_minmax(22rem,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Audit Logs</h2>
              <span
                className={cn(
                  'rounded-full border border-border bg-surface-muted/65 px-2 py-0.5 text-xs font-medium',
                  isRefreshing ? 'text-primary' : 'text-muted',
                )}
              >
                {refreshStatusLabel}
              </span>
            </div>

            <ListHeaderSearch
              className="w-full min-w-0"
              placeholder="Search loaded audit logs..."
              value={search}
              onChange={(nextSearch) => {
                clearSeededAuditParams()
                setSearch(nextSearch)
                setSelectedLog(null)
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

              <div className="relative" ref={columnsMenuRef}>
                <Button
                  aria-expanded={columnsOpen}
                  aria-haspopup="menu"
                  className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
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
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-60 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
                    role="menu"
                  >
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-normal text-muted">
                      Visible columns
                    </p>
                    {auditColumns.map((column) => {
                      const isChecked = visibleColumns.includes(column.id)
                      const isRequiredLastColumn =
                        isChecked && visibleColumns.length === 1

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
                disabled={Boolean(dateRangeError)}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => void auditQuery.refetch()}
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

          <div className="mt-3 flex gap-1 overflow-x-auto rounded-[0.875rem] border border-border bg-surface-muted/40 p-1">
            <button
              className={cn(
                'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[0.65rem] px-3 text-sm font-medium transition',
                !hasActiveFilters
                  ? 'bg-surface text-primary shadow-sm ring-1 ring-primary'
                  : 'text-muted hover:bg-surface hover:text-foreground',
              )}
              type="button"
              onClick={clearFilters}
            >
              All logs
              <span className="rounded-full bg-surface-muted px-1.5 text-xs">
                {pagination?.totalItems ?? '...'}
              </span>
            </button>
            <button
              className={cn(
                'inline-flex h-9 shrink-0 items-center justify-center rounded-[0.65rem] px-3 text-sm font-medium transition',
                dateFrom && dateTo && dateFrom === dateTo
                  ? 'bg-surface text-primary shadow-sm ring-1 ring-primary'
                  : 'text-muted hover:bg-surface hover:text-foreground',
              )}
              type="button"
              onClick={setTodayFilter}
            >
              Today
            </button>
            {visibleModules.map(([module, count]) => (
              <button
                className={cn(
                  'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[0.65rem] px-3 text-sm font-medium transition',
                  moduleCode === module
                    ? 'bg-surface text-primary shadow-sm ring-1 ring-primary'
                    : 'text-muted hover:bg-surface hover:text-foreground',
                )}
                key={module}
                type="button"
                onClick={() => {
                  clearSeededAuditParams()
                  setModuleCode(moduleCode === module ? '' : module)
                  resetToFirstPage()
                }}
              >
                {humanizeCode(module)}
                <span className="rounded-full bg-surface-muted px-1.5 text-xs">
                  {count}
                </span>
              </button>
            ))}
          </div>

          <ActiveFilterChips chips={activeFilterChips} onClearAll={clearFilters} />

          {filtersOpen ? (
            <div className="mt-2 rounded-[0.75rem] border border-border bg-surface-muted/45 p-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(9rem,0.7fr)_minmax(9rem,0.7fr)_minmax(10rem,0.7fr)_minmax(11rem,0.8fr)_minmax(11rem,0.8fr)_minmax(11rem,0.8fr)_minmax(9rem,0.65fr)_minmax(9rem,0.65fr)_auto] xl:items-end">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Module</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <Input
                      className="min-h-10 pl-9"
                      placeholder="vendors"
                      value={moduleCode}
                      onChange={(event) => {
                        clearSeededAuditParams()
                        setModuleCode(event.target.value)
                        resetToFirstPage()
                      }}
                    />
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Action</span>
                  <Input
                    className="min-h-10"
                    placeholder="approve"
                    value={actionCode}
                    onChange={(event) => {
                      clearSeededAuditParams()
                      setActionCode(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Entity type</span>
                  <Input
                    className="min-h-10"
                    placeholder="order"
                    value={entityType}
                    onChange={(event) => {
                      clearSeededAuditParams()
                      setEntityType(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Entity ID</span>
                  <Input
                    className="min-h-10"
                    placeholder="UUID"
                    value={entityId}
                    onChange={(event) => {
                      clearSeededAuditParams()
                      setEntityId(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Actor admin ID</span>
                  <Input
                    className="min-h-10"
                    placeholder="UUID"
                    value={actorAdminId}
                    onChange={(event) => {
                      clearSeededAuditParams()
                      setActorAdminId(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Actor user ID</span>
                  <Input
                    className="min-h-10"
                    placeholder="UUID"
                    value={actorUserId}
                    onChange={(event) => {
                      clearSeededAuditParams()
                      setActorUserId(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">From</span>
                  <Input
                    className="min-h-10"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      clearSeededAuditParams()
                      setDateFrom(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">To</span>
                  <Input
                    className="min-h-10"
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      clearSeededAuditParams()
                      setDateTo(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>

                <Button
                  className="min-h-10 px-3"
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={clearFilters}
                >
                  Reset
                </Button>
              </div>

              {dateRangeError ? (
                <p className="mt-2 rounded-[0.65rem] border border-danger/20 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                  {dateRangeError}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>{resultSummary}</span>
            <span>{activeContextLabel || 'Immutable admin activity'}</span>
          </div>
        </div>

        {dateRangeError ? (
          <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <ErrorState
              description={dateRangeError}
              title="Date range needs attention"
            />
          </div>
        ) : auditQuery.isError ? (
          <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <ErrorState
              description={
                auditQuery.error instanceof Error
                  ? auditQuery.error.message
                  : 'We could not load audit logs.'
              }
              title="Audit logs unavailable"
              onRetry={() => void auditQuery.refetch()}
            />
          </div>
        ) : isInitialLoading ? (
          <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <AuditRowsSkeleton />
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <EmptyState
              description={
                logs.length
                  ? 'No loaded audit logs matched the table search.'
                  : 'No audit logs matched this filter.'
              }
              title="No audit logs"
            />
          </div>
        ) : (
          <div className="flex flex-col xl:min-h-0 xl:flex-1">
            <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
              <div
                className="min-w-0 xl:min-w-[var(--audit-grid-min-width)]"
                style={auditGridStyle}
              >
                <div className="sticky top-0 z-30 hidden gap-3 grid-cols-[var(--audit-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
                  <div className="flex min-w-0 items-center">
                    <ListSelectionCheckbox
                      checked={auditSelection.allVisibleSelected}
                      indeterminate={auditSelection.someVisibleSelected}
                      label="Select visible audit logs"
                      onChange={auditSelection.setVisibleSelected}
                    />
                  </div>
                  {auditColumns
                    .filter((column) => visibleColumns.includes(column.id))
                    .map((column) => (
                      <div
                        className="relative flex min-w-0 items-center pr-3"
                        key={column.id}
                      >
                        <span className="truncate">{column.label}</span>
                        <button
                          aria-label={`Resize ${column.label} column`}
                          className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title="Drag to resize"
                          type="button"
                          onDoubleClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            resetColumnWidth(column.id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'ArrowLeft') {
                              event.preventDefault()
                              adjustColumnWidth(column.id, -16)
                            }

                            if (event.key === 'ArrowRight') {
                              event.preventDefault()
                              adjustColumnWidth(column.id, 16)
                            }
                          }}
                          onPointerDown={(event) => startColumnResize(column.id, event)}
                        >
                          <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                        </button>
                      </div>
                    ))}
                  <div className="workbench-sticky-action-head flex min-w-0 pr-3">
                    <span className="truncate">Actions</span>
                  </div>
                </div>

                <ListSelectionToolbar
                  allVisibleSelected={auditSelection.allVisibleSelected}
                  selectedCount={auditSelection.selectedCount}
                  visibleCount={auditSelection.visibleCount}
                  onClear={auditSelection.clearSelection}
                  onSelectVisible={() => auditSelection.setVisibleSelected(true)}
                />

                <div>
                  {visibleLogs.map((log) => {
                    const relatedEntityLink = getRelatedEntityLink(log, entityAccess)
                    const actorAdminLink = getActorAdminLink(log, canReadAdminUsers)

                    return (
                      <AuditRow
                        actorAdminLink={actorAdminLink}
                        isSelected={auditSelection.isSelected(log.auditLogId)}
                        key={log.auditLogId}
                        log={log}
                        relatedEntityLink={relatedEntityLink}
                        visibleColumns={visibleColumns}
                        onInspect={() => setSelectedLog(log)}
                        onOpenActorAdmin={() => openActorAdminForLog(log)}
                        onOpenRelated={() => openRelatedEntityForLog(log)}
                        onSelect={(selectedLog, selected) =>
                          auditSelection.setItemSelected(
                            selectedLog.auditLogId,
                            selected,
                          )
                        }
                      />
                    )
                  })}
                </div>
              </div>
            </div>

            <AuditPaginationControls
              pagination={pagination}
              onPageChange={(nextPage) => {
                setPage(nextPage)
                setSelectedLog(null)
              }}
              onPageSizeChange={(nextLimit) => {
                setLimit(nextLimit)
                setPage(1)
                setSelectedLog(null)
              }}
            />
          </div>
        )}
      </main>

      {selectedLog ? (
        <AuditDetailModal
          actorAdminLink={selectedActorAdminLink}
          log={selectedLog}
          relatedEntityLink={selectedRelatedEntityLink}
          onClose={() => setSelectedLog(null)}
          onFilterActor={() => applyActorFilter(selectedLog)}
          onFilterEntity={() => applyEntityFilter(selectedLog)}
          onFilterModuleAction={() => applyModuleActionFilter(selectedLog)}
          onOpenActorAdmin={openActorAdmin}
          onOpenRelated={openRelatedEntity}
          onSearchRequest={() => applyRequestSearch(selectedLog)}
        />
      ) : null}
    </PageContainer>
  )
}
