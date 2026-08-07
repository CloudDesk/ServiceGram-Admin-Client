import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  Archive,
  Calculator,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Filter,
  FileJson,
  Image as ImageIcon,
  MapPinned,
  Plus,
  Power,
  RefreshCcw,
  Settings2,
  SlidersHorizontal,
  ToggleLeft,
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
import {
  QuickPreviewActions,
  QuickPreviewTabs,
  type QuickPreviewAction,
} from '../../../components/ui/QuickPreview'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { settingsService } from '../services/settings.service'
import {
  SettingsActionModal,
  type SettingsActionFormValues,
  type SettingsActionSelection,
} from './SettingsActionModal'
import type {
  PolicyFamily,
  PolicyRule,
  PolicyRuleResponse,
  PolicyRulesListResponse,
  PolicyRulesQueryParams,
  PolicyScopeType,
  PolicyStatus,
  PlatformSetting,
  PlatformSettingsListResponse,
  PricingPolicyPreview,
  PricingPolicyPreviewPayload,
  PricingPolicyPreviewResponse,
  CategoryImageUploadResponse,
  CreateCategoryResponse,
  ServiceCategoriesListResponse,
  ServiceCategory,
  ServiceZone,
  ServiceZonesListResponse,
  SettingsCategoriesQueryParams,
  SettingsListQueryParams,
  SettingsRecordType,
  SettingsZonesQueryParams,
  UpsertPolicyRulePayload,
  UpdateCategoryResponse,
  UpdateSettingResponse,
  UpdateZoneResponse,
} from '../types/settings.types'

type Row = PlatformSetting | ServiceCategory | ServiceZone
type SettingsWorkspaceType = SettingsRecordType | 'policies'
type SettingsListResponse =
  | PlatformSettingsListResponse
  | ServiceCategoriesListResponse
  | ServiceZonesListResponse
type SettingsMutationResponse =
  | UpdateSettingResponse
  | UpdateCategoryResponse
  | CreateCategoryResponse
  | CategoryImageUploadResponse
  | UpdateZoneResponse
type PolicyRuleAction = 'CREATE' | 'EDIT' | 'ACTIVATE' | 'ARCHIVE'
type PolicyRuleActionSelection =
  | { action: 'CREATE'; record?: undefined }
  | { action: 'EDIT' | 'ACTIVATE' | 'ARCHIVE'; record: PolicyRule }
type CatalogueAction = 'EDIT' | 'ACTIVATE' | 'DEACTIVATE'
type SettingsPreviewTab = 'summary' | 'details'
type SettingsPreviewSelection =
  | { type: SettingsRecordType; record: Row }
  | { type: 'policies'; record: PolicyRule }
  | null
type SettingsColumnId =
  | 'record'
  | 'category'
  | 'type'
  | 'state'
  | 'value'
  | 'template'
  | 'coverage'
  | 'order'
  | 'metadata'
  | 'updatedAt'
type SettingsColumnWidthId = SettingsColumnId | 'actions'
type SettingsColumnWidths = Record<SettingsColumnWidthId, number>

interface SettingsGridStyle extends CSSProperties {
  '--settings-grid-template': string
  '--settings-grid-min-width': string
}

interface SettingsColumn {
  id: SettingsColumnId
  label: string
  minWidth: number
  render: (row: Row, type: SettingsRecordType) => ReactNode
}

interface ActiveSettingsFilterChip {
  key: string
  label: string
  onClear: () => void
}

const DEFAULT_PAGE_SIZE = 10
const SETTINGS_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.settings.columnWidths.v2'
const SETTINGS_DEFAULT_COLUMN_WIDTH = 220
const SETTINGS_ACTION_COLUMN_ID = 'actions'
const SETTINGS_ACTION_COLUMN_DEFAULT_WIDTH = 292
const SETTINGS_ACTION_COLUMN_MIN_WIDTH = 284
const SETTINGS_ACTION_COLUMN_MAX_WIDTH = 320
const SETTINGS_GRID_COLUMN_GAP = 12
const SETTINGS_GRID_INLINE_PADDING = 24
const SETTINGS_FILTER_CONTROL_CLASS_NAME =
  'h-9 w-full rounded-[0.65rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

const policyFamilies: PolicyFamily[] = [
  'CUSTOMER_CATEGORY_PLACEMENT',
  'NOTIFICATION_WORKFLOW',
  'MEDIA_REEL_RULE',
  'PRICING_RULE',
  'COMMISSION_RULE',
]

const policyStatuses: PolicyStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED']
const policyScopeTypes: PolicyScopeType[] = [
  'GLOBAL',
  'CATEGORY',
  'CITY',
  'ZONE',
  'VENDOR',
]

const settingsTabs: {
  icon: ReactNode
  label: string
  type: SettingsWorkspaceType
}[] = [
  { icon: <Settings2 className="size-4" />, label: 'Platform settings', type: 'settings' },
  { icon: <ToggleLeft className="size-4" />, label: 'Categories', type: 'categories' },
  { icon: <MapPinned className="size-4" />, label: 'Zones', type: 'zones' },
  { icon: <FileJson className="size-4" />, label: 'Policy rules', type: 'policies' },
]

const settingsColumnsByType: Record<SettingsRecordType, SettingsColumn[]> = {
  settings: [
    {
      id: 'record',
      label: 'Setting',
      minWidth: 260,
      render: (row) => {
        const setting = row as PlatformSetting

        return (
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{setting.displayName}</p>
            <p className="truncate text-xs text-muted">{setting.settingKey}</p>
            {setting.description ? (
              <p className="mt-1 line-clamp-1 text-xs text-muted">
                {setting.description}
              </p>
            ) : null}
          </div>
        )
      },
    },
    {
      id: 'category',
      label: 'Category',
      minWidth: 150,
      render: (row) => (
        <Badge tone="neutral">{humanizeCode((row as PlatformSetting).category)}</Badge>
      ),
    },
    {
      id: 'type',
      label: 'Type',
      minWidth: 150,
      render: (row) => {
        const setting = row as PlatformSetting

        return (
          <div>
            <p className="font-medium text-foreground">{humanizeCode(setting.valueType)}</p>
            <p className="text-xs text-muted">
              {setting.isSensitive ? 'Sensitive' : 'Standard'}
              {setting.isValueMasked ? ' · Masked' : ''}
            </p>
          </div>
        )
      },
    },
    {
      id: 'state',
      label: 'Editable',
      minWidth: 150,
      render: (row) => {
        const setting = row as PlatformSetting

        return (
          <Badge tone={setting.isEditable ? 'success' : 'neutral'}>
            {setting.isEditable ? 'Editable' : 'Locked'}
          </Badge>
        )
      },
    },
    {
      id: 'value',
      label: 'Value',
      minWidth: 220,
      render: (row) => {
        const setting = row as PlatformSetting

        return (
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm text-foreground">
              {formatValue(setting.value)}
            </p>
            <p className="mt-1 line-clamp-1 text-xs text-muted">
              Default: {formatValue(setting.defaultValue)}
            </p>
          </div>
        )
      },
    },
    {
      id: 'updatedAt',
      label: 'Updated',
      minWidth: 180,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">
            {formatDate((row as PlatformSetting).updatedAt, true)}
          </p>
          <p className="text-xs text-muted">
            {(row as PlatformSetting).updatedByAdminId ?? 'System'}
          </p>
        </div>
      ),
    },
  ],
  categories: [
    {
      id: 'record',
      label: 'Category',
      minWidth: 250,
      render: (row) => {
        const category = row as ServiceCategory
        const iconUrl = category.iconUrl ?? category.icon?.url ?? null

        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[0.75rem] border border-border bg-surface-muted">
              {iconUrl ? (
                <img
                  alt=""
                  className="h-full w-full object-contain p-1"
                  src={iconUrl}
                />
              ) : (
                <ImageIcon className="size-5 text-muted" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <p className="truncate font-semibold text-foreground">{category.name}</p>
                <Badge tone={category.isActive ? 'success' : 'danger'}>
                  {category.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted">{category.categoryCode}</p>
              {category.description ? (
                <p className="mt-1 line-clamp-1 text-xs text-muted">
                  {category.description}
                </p>
              ) : null}
            </div>
          </div>
        )
      },
    },
    {
      id: 'template',
      label: 'Booking template',
      minWidth: 220,
      render: (row) => {
        const template = (row as ServiceCategory).bookingTemplate

        return (
          <div>
            <p className="font-medium text-foreground">
              {template?.defaultPricingMode ?? 'Not configured'}
            </p>
            <p className="text-xs text-muted">
              {template?.multiServiceEnabled ? 'Multi-service' : 'Single service'} ·{' '}
              {template?.quoteMode ?? 'Instant'}
            </p>
          </div>
        )
      },
    },
    {
      id: 'state',
      label: 'Review',
      minWidth: 180,
      render: (row) => {
        const category = row as ServiceCategory

        return (
          <div>
            <Badge tone={category.warnings.length ? 'warning' : 'success'}>
              {category.warnings.length ? `${category.warnings.length} warnings` : 'Ready'}
            </Badge>
            <p className="mt-1 text-xs text-muted">
              {category.nextRecommendedAction ?? 'No next action'}
            </p>
          </div>
        )
      },
    },
    {
      id: 'order',
      label: 'Order',
      minWidth: 120,
      render: (row) => (
        <p className="font-semibold text-foreground">
          {(row as ServiceCategory).displayOrder}
        </p>
      ),
    },
    {
      id: 'updatedAt',
      label: 'Updated',
      minWidth: 180,
      render: (row) => (
        <p className="font-medium text-foreground">
          {formatDate((row as ServiceCategory).updatedAt, true)}
        </p>
      ),
    },
  ],
  zones: [
    {
      id: 'record',
      label: 'Zone',
      minWidth: 250,
      render: (row) => {
        const zone = row as ServiceZone

        return (
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <p className="truncate font-semibold text-foreground">{zone.zoneName}</p>
              <Badge tone={zone.isActive ? 'success' : 'danger'}>
                {zone.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted">{zone.zoneId}</p>
          </div>
        )
      },
    },
    {
      id: 'category',
      label: 'City',
      minWidth: 160,
      render: (row) => <p className="font-medium text-foreground">{(row as ServiceZone).city}</p>,
    },
    {
      id: 'coverage',
      label: 'Coverage',
      minWidth: 180,
      render: (row) => {
        const zone = row as ServiceZone

        return (
          <div>
            <p className="font-semibold text-foreground">{zone.pincodeList.length} pincodes</p>
            <p className="truncate text-xs text-muted">
              {zone.pincodeList.slice(0, 3).join(', ') || 'No pincodes'}
            </p>
          </div>
        )
      },
    },
    {
      id: 'metadata',
      label: 'Metadata',
      minWidth: 220,
      render: (row) => {
        const zone = row as ServiceZone
        const keys = Object.keys(zone.metadata ?? {})

        return (
          <div>
            <Badge tone={zone.warnings.length ? 'warning' : 'success'}>
              {zone.warnings.length ? `${zone.warnings.length} warnings` : 'Ready'}
            </Badge>
            <p className="mt-1 truncate text-xs text-muted">
              {keys.length ? keys.slice(0, 3).join(', ') : 'No metadata'}
            </p>
          </div>
        )
      },
    },
    {
      id: 'updatedAt',
      label: 'Updated',
      minWidth: 180,
      render: (row) => (
        <p className="font-medium text-foreground">
          {formatDate((row as ServiceZone).updatedAt, true)}
        </p>
      ),
    },
  ],
}

const defaultSettingsColumnWidths: SettingsColumnWidths = {
  record: 260,
  category: 180,
  type: 170,
  state: 170,
  value: 240,
  template: 240,
  coverage: 200,
  order: 130,
  metadata: 230,
  updatedAt: 190,
  actions: SETTINGS_ACTION_COLUMN_DEFAULT_WIDTH,
}

function defaultVisibleColumns(type: SettingsRecordType) {
  return settingsColumnsByType[type].map((column) => column.id)
}

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

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not available'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function isSettingsRecordType(type: SettingsWorkspaceType): type is SettingsRecordType {
  return type === 'settings' || type === 'categories' || type === 'zones'
}

function readSettingsWorkspaceType(searchParams: URLSearchParams): SettingsWorkspaceType {
  const value = searchParams.get('type') ?? searchParams.get('tab')

  if (value === 'settings' || value === 'categories' || value === 'zones') {
    return value
  }

  if (value === 'policies') return 'policies'

  return 'settings'
}

function readBooleanFilter(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)

  return value === 'true' || value === 'false' ? value : ''
}

function readEnumFilter<TValue extends string>(
  searchParams: URLSearchParams,
  key: string,
  allowedValues: readonly TValue[],
) {
  const value = searchParams.get(key)

  return allowedValues.includes(value as TValue) ? (value as TValue) : ''
}

function recordLabel(type: SettingsWorkspaceType) {
  if (type === 'settings') return 'settings'
  if (type === 'categories') return 'categories'
  if (type === 'policies') return 'policy rules'
  return 'zones'
}

function getRowId(type: SettingsRecordType, row: Row) {
  if (type === 'settings') return (row as PlatformSetting).settingKey
  if (type === 'categories') return (row as ServiceCategory).categoryId
  return (row as ServiceZone).zoneId
}

function hasCatalogueAction(
  record: Pick<ServiceCategory | ServiceZone, 'availableActions'>,
  action: CatalogueAction,
) {
  return record.availableActions.includes(action)
}

function getAuditEntityType(type: SettingsRecordType) {
  if (type === 'settings') return 'platform_setting'
  if (type === 'categories') return 'service_category'
  return 'service_zone'
}

function getAuditEntityId(type: SettingsRecordType, row: Row) {
  if (type === 'settings') return (row as PlatformSetting).settingId
  if (type === 'categories') return (row as ServiceCategory).categoryId
  return (row as ServiceZone).zoneId
}

function buildSettingsAuditPath(type: SettingsRecordType, row: Row) {
  const params = new URLSearchParams({
    moduleCode: 'settings',
    entityType: getAuditEntityType(type),
    entityId: getAuditEntityId(type, row),
  })

  return `${routePaths.audit}?${params.toString()}`
}

function buildPolicyRuleAuditPath(policyRule: PolicyRule) {
  const params = new URLSearchParams({
    moduleCode: 'settings',
    entityType: 'policy_rule',
    entityId: policyRule.policyRuleId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function policyStatusTone(status: PolicyStatus) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

function getPolicyScopeLabel(rule: PolicyRule) {
  const { scope } = rule
  if (scope.scopeType === 'GLOBAL') return 'Global'
  if (scope.scopeType === 'CATEGORY') return scope.categoryId ?? 'Category scope'
  if (scope.scopeType === 'CITY') return scope.city ?? 'City scope'
  if (scope.scopeType === 'ZONE') return scope.zoneId ?? 'Zone scope'
  return scope.vendorId ?? 'Vendor scope'
}

function hasPolicyAction(rule: PolicyRule, action: 'EDIT' | 'ACTIVATE' | 'ARCHIVE') {
  return rule.availableActions.includes(action)
}

function formatPolicyDateTimeInput(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''

  return date.toISOString().slice(0, 16)
}

function normalizeDateTimeInput(value: string) {
  if (!value.trim()) return undefined
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Date values must be valid.')
  }

  return date.toISOString()
}

function parseJsonObjectValue(raw: string) {
  if (!raw.trim()) return {}
  const value = JSON.parse(raw) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('JSON values must be objects.')
  }

  return value as Record<string, unknown>
}

function formatJsonObjectValue(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

function policyPayloadFromRecord(
  record: PolicyRule,
  overrides: Partial<UpsertPolicyRulePayload>,
): UpsertPolicyRulePayload {
  return {
    family: record.family,
    ruleKey: record.ruleKey,
    displayName: record.displayName,
    description: record.description,
    status: record.status,
    priority: record.priority,
    scopeType: record.scope.scopeType,
    categoryId: record.scope.categoryId,
    city: record.scope.city,
    zoneId: record.scope.zoneId,
    vendorId: record.scope.vendorId,
    config: record.config,
    metadata: record.metadata,
    effectiveFrom: record.effectiveFrom,
    effectiveTo: record.effectiveTo,
    reason: overrides.reason ?? '',
    ...overrides,
  }
}

function formatPaise(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value / 100)
}

function normalizeSettingsColumnWidths(value: unknown): SettingsColumnWidths {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultSettingsColumnWidths
  }

  const record = value as Record<string, unknown>
  const widths = { ...defaultSettingsColumnWidths }

  Object.keys(widths).forEach((columnId) => {
    const width = record[columnId]

    if (typeof width === 'number' && Number.isFinite(width)) {
      widths[columnId as SettingsColumnWidthId] = clampSettingsColumnWidth(
        columnId as SettingsColumnWidthId,
        width,
      )
    }
  })

  return widths
}

function loadSettingsColumnWidths() {
  if (typeof window === 'undefined') return defaultSettingsColumnWidths

  try {
    return normalizeSettingsColumnWidths(
      JSON.parse(window.localStorage.getItem(SETTINGS_COLUMN_WIDTH_STORAGE_KEY) ?? 'null'),
    )
  } catch {
    return defaultSettingsColumnWidths
  }
}

function getSettingsColumnMinWidth(columnId: SettingsColumnWidthId) {
  if (columnId === SETTINGS_ACTION_COLUMN_ID) return SETTINGS_ACTION_COLUMN_MIN_WIDTH

  return (
    Object.values(settingsColumnsByType)
      .flat()
      .find((column) => column.id === columnId)?.minWidth ??
    SETTINGS_DEFAULT_COLUMN_WIDTH
  )
}

function clampSettingsColumnWidth(
  columnId: SettingsColumnWidthId,
  width: number,
) {
  const nextWidth = Math.max(
    getSettingsColumnMinWidth(columnId),
    Math.round(width),
  )

  if (columnId === SETTINGS_ACTION_COLUMN_ID) {
    return Math.min(nextWidth, SETTINGS_ACTION_COLUMN_MAX_WIDTH)
  }

  return nextWidth
}

function getSettingsColumnWidth(
  columnWidths: SettingsColumnWidths,
  columnId: SettingsColumnWidthId,
) {
  return clampSettingsColumnWidth(
    columnId,
    columnWidths[columnId] ?? SETTINGS_DEFAULT_COLUMN_WIDTH,
  )
}

function getSettingsGridTemplate(
  type: SettingsRecordType,
  visibleColumns: SettingsColumnId[],
  columnWidths: SettingsColumnWidths,
) {
  const selectedWidths = settingsColumnsByType[type]
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => `${getSettingsColumnWidth(columnWidths, column.id)}px`)

  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...selectedWidths,
    `${getSettingsColumnWidth(columnWidths, SETTINGS_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getSettingsGridMinWidth(
  type: SettingsRecordType,
  visibleColumns: SettingsColumnId[],
  columnWidths: SettingsColumnWidths,
) {
  const visibleWidth = settingsColumnsByType[type]
    .filter((column) => visibleColumns.includes(column.id))
    .reduce(
      (total, column) => total + getSettingsColumnWidth(columnWidths, column.id),
      0,
    )
  const columnCount = visibleColumns.length + 2
  const gridGapWidth = Math.max(columnCount - 1, 0) * SETTINGS_GRID_COLUMN_GAP

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    getSettingsColumnWidth(columnWidths, SETTINGS_ACTION_COLUMN_ID) +
    gridGapWidth +
    SETTINGS_GRID_INLINE_PADDING
  }px`
}

function formatRefreshTime(value: number) {
  if (!value) return 'Not refreshed yet'

  return `Last refreshed ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))}`
}

function MetricCard({
  icon,
  label,
  meta,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  value: ReactNode
}) {
  return (
    <div className="min-h-[4.35rem] rounded-[0.75rem] border border-border bg-surface p-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-normal text-foreground">
        {value}
      </div>
      <p className="mt-0.5 text-xs leading-4 text-muted">{meta}</p>
    </div>
  )
}

function ActiveSettingsFilterChips({
  chips,
  onClearAll,
}: {
  chips: ActiveSettingsFilterChip[]
  onClearAll: () => void
}) {
  if (!chips.length) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          className="inline-flex min-h-7 max-w-full items-center gap-2 rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-foreground"
          key={chip.key}
        >
          <span className="truncate">{chip.label}</span>
          <button
            aria-label={`Clear ${chip.label}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground"
            type="button"
            onClick={chip.onClear}
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <button
        className="min-h-7 rounded-full px-2.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
        type="button"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  )
}

function SettingsSummaryField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-1 min-w-0 text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </div>
    </div>
  )
}

function settingsActionLabel(action: SettingsActionSelection['action']) {
  if (action === 'UPDATE') return 'Update'
  if (action === 'EDIT') return 'Edit'
  if (action === 'ACTIVATE') return 'Activate'
  if (action === 'DEACTIVATE') return 'Deactivate'
  return 'Create'
}

function policyActionLabel(action: PolicyRuleAction) {
  if (action === 'CREATE') return 'Create'
  if (action === 'EDIT') return 'Edit'
  if (action === 'ACTIVATE') return 'Activate'
  return 'Archive'
}

function getPrimarySettingsAction({
  canUpdateSettings,
  row,
  type,
}: {
  canUpdateSettings: boolean
  row: Row
  type: SettingsRecordType
}): SettingsActionSelection | null {
  if (!canUpdateSettings) return null

  if (type === 'settings') {
    const setting = row as PlatformSetting

    return setting.isEditable
      ? { type: 'settings', action: 'UPDATE', record: setting }
      : null
  }

  if (type === 'categories') {
    const category = row as ServiceCategory

    if (hasCatalogueAction(category, 'EDIT')) {
      return { type: 'categories', action: 'EDIT', record: category }
    }

    const statusAction: CatalogueAction = category.isActive
      ? 'DEACTIVATE'
      : 'ACTIVATE'

    return hasCatalogueAction(category, statusAction)
      ? { type: 'categories', action: statusAction, record: category }
      : null
  }

  const zone = row as ServiceZone
  if (hasCatalogueAction(zone, 'EDIT')) {
    return { type: 'zones', action: 'EDIT', record: zone }
  }

  const statusAction: CatalogueAction = zone.isActive ? 'DEACTIVATE' : 'ACTIVATE'

  return hasCatalogueAction(zone, statusAction)
    ? { type: 'zones', action: statusAction, record: zone }
    : null
}

function getSecondarySettingsAction({
  canUpdateSettings,
  row,
  type,
}: {
  canUpdateSettings: boolean
  row: Row
  type: SettingsRecordType
}): SettingsActionSelection | null {
  if (!canUpdateSettings || type === 'settings') return null

  const catalogueRecord = row as ServiceCategory | ServiceZone
  const statusAction: CatalogueAction = catalogueRecord.isActive
    ? 'DEACTIVATE'
    : 'ACTIVATE'

  if (!hasCatalogueAction(catalogueRecord, statusAction)) return null

  return type === 'categories'
    ? {
        type: 'categories',
        action: statusAction,
        record: catalogueRecord as ServiceCategory,
      }
    : {
        type: 'zones',
        action: statusAction,
        record: catalogueRecord as ServiceZone,
      }
}

function getSettingsRecordStatus(type: SettingsRecordType, row: Row) {
  if (type === 'settings') {
    const setting = row as PlatformSetting

    return {
      label: setting.isEditable ? 'Editable' : 'Locked',
      tone: setting.isEditable ? 'success' : 'neutral',
    } as const
  }

  const catalogueRecord = row as ServiceCategory | ServiceZone

  return {
    label: catalogueRecord.isActive ? 'Active' : 'Inactive',
    tone: catalogueRecord.isActive ? 'success' : 'danger',
  } as const
}

function SettingsRecordPreviewPanel({
  canReadAudit,
  canUpdateSettings,
  isSubmitting,
  onClose,
  onOpenAction,
  onOpenAudit,
  onOpenDetail,
  onOpenPolicyAction,
  onOpenPolicyAudit,
  selection,
}: {
  canReadAudit: boolean
  canUpdateSettings: boolean
  isSubmitting: boolean
  onClose: () => void
  onOpenAction: (selection: SettingsActionSelection) => void
  onOpenAudit: (row: Row) => void
  onOpenDetail: (row: Row) => void
  onOpenPolicyAction: (selection: PolicyRuleActionSelection) => void
  onOpenPolicyAudit: (rule: PolicyRule) => void
  selection: Exclude<SettingsPreviewSelection, null>
}) {
  const [activeTab, setActiveTab] = useState<SettingsPreviewTab>('summary')
  const isPolicy = selection.type === 'policies'
  const previewTabs: { key: SettingsPreviewTab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'details', label: isPolicy ? 'Scope' : 'Details' },
  ]

  if (isPolicy) {
    const rule = selection.record
    const secondaryAction: PolicyRuleAction =
      rule.status === 'ACTIVE' ? 'ARCHIVE' : 'ACTIVATE'
    const canEdit = canUpdateSettings && hasPolicyAction(rule, 'EDIT')
    const canRunSecondary =
      canUpdateSettings &&
      hasPolicyAction(
        rule,
        secondaryAction === 'ARCHIVE' ? 'ARCHIVE' : 'ACTIVATE',
      )
    const policyStateAction: QuickPreviewAction = {
      disabled: isSubmitting,
      icon:
        secondaryAction === 'ARCHIVE' ? (
          <Archive className="size-4" />
        ) : (
          <Power className="size-4" />
        ),
      key: secondaryAction,
      label: policyActionLabel(secondaryAction),
      onClick: () => onOpenPolicyAction({ action: secondaryAction, record: rule }),
      variant: secondaryAction === 'ARCHIVE' ? 'danger' : 'secondary',
    }
    const policyPrimaryAction: QuickPreviewAction | null = canEdit
      ? {
          disabled: isSubmitting,
          icon: <Edit3 className="size-4" />,
          key: 'edit-policy',
          label: 'Edit policy',
          onClick: () => onOpenPolicyAction({ action: 'EDIT', record: rule }),
          variant: 'primary',
        }
      : canRunSecondary && secondaryAction === 'ACTIVATE'
        ? policyStateAction
        : null
    const policySecondaryActions: QuickPreviewAction[] = []

    if (canRunSecondary && policyPrimaryAction?.key !== secondaryAction) {
      policySecondaryActions.push(policyStateAction)
    }

    if (canReadAudit) {
      policySecondaryActions.push({
        icon: <ClipboardList className="size-4" />,
        key: 'audit',
        label: 'Open audit',
        onClick: () => onOpenPolicyAudit(rule),
        variant: 'secondary',
      })
    }

    return (
      <>
        <button
          aria-label="Close settings preview"
          className="fixed inset-0 z-40 bg-black/20 xl:hidden"
          type="button"
          onClick={onClose}
        />
        <aside className="fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:inset-x-auto xl:bottom-6 xl:right-6 xl:top-[calc(var(--spacing-topbar)+0.75rem)] xl:z-40 xl:w-96">
          <div className="shrink-0 border-b border-border p-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
                    {rule.displayName}
                  </h2>
                  <Badge tone={policyStatusTone(rule.status)}>
                    {humanizeCode(rule.status)}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted">
                  {rule.ruleKey} / v{rule.version}
                </p>
              </div>
              <button
                aria-label="Close settings preview panel"
                className="btn-icon shrink-0"
                title="Close"
                type="button"
                onClick={onClose}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <QuickPreviewTabs
            activeTab={activeTab}
            ariaLabel="Settings preview sections"
            tabs={previewTabs}
            onChange={setActiveTab}
          />

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {activeTab === 'summary' ? (
              <div className="grid grid-cols-2 gap-3 rounded-[0.75rem] border border-border p-3">
                <SettingsSummaryField label="Family" value={humanizeCode(rule.family)} />
                <SettingsSummaryField label="Scope" value={humanizeCode(rule.scope.scopeType)} />
                <SettingsSummaryField label="Priority" value={rule.priority} />
                <SettingsSummaryField label="Updated" value={formatDate(rule.updatedAt, true)} />
              </div>
            ) : null}
            {activeTab === 'details' ? (
              <div className="space-y-3">
                <div className="rounded-[0.75rem] border border-border p-3">
                  <SettingsSummaryField
                    label="Scope value"
                    value={getPolicyScopeLabel(rule)}
                  />
                </div>
                <div className="rounded-[0.75rem] border border-border p-3">
                  <SettingsSummaryField
                    label="Effective"
                    value={`${formatDate(rule.effectiveFrom, true)} - ${
                      rule.effectiveTo
                        ? formatDate(rule.effectiveTo, true)
                        : 'No end date'
                    }`}
                  />
                </div>
                <div className="rounded-[0.75rem] border border-border p-3">
                  <SettingsSummaryField
                    label="Config keys"
                    value={
                      Object.keys(rule.config ?? {}).slice(0, 5).join(', ') ||
                      'No config keys'
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
          <QuickPreviewActions
            primaryAction={policyPrimaryAction}
            secondaryActions={policySecondaryActions}
          />
        </aside>
      </>
    )
  }

  const row = selection.record
  const type = selection.type
  const primaryAction = getPrimarySettingsAction({
    canUpdateSettings,
    row,
    type,
  })
  const secondaryAction = getSecondarySettingsAction({
    canUpdateSettings,
    row,
    type,
  })
  const status = getSettingsRecordStatus(type, row)
  const title =
    type === 'settings'
      ? (row as PlatformSetting).displayName
      : type === 'categories'
        ? (row as ServiceCategory).name
        : (row as ServiceZone).zoneName
  const identifier = getRowId(type, row)
  const warnings =
    type === 'settings'
      ? []
      : ((row as ServiceCategory | ServiceZone).warnings ?? [])
  const previewPrimaryAction: QuickPreviewAction | null = primaryAction
    ? {
        disabled: isSubmitting,
        icon: <Edit3 className="size-4" />,
        key: primaryAction.action,
        label: settingsActionLabel(primaryAction.action),
        onClick: () => onOpenAction(primaryAction),
        variant: 'primary',
      }
    : null
  const detailAction: QuickPreviewAction = {
    icon: <ArrowUpRight className="size-4" />,
    key: 'details',
    label: previewPrimaryAction ? 'Detail' : 'Open detail',
    onClick: () => onOpenDetail(row),
  }
  const previewSecondaryActions: QuickPreviewAction[] = []

  if (secondaryAction && secondaryAction.action !== primaryAction?.action) {
    previewSecondaryActions.push({
      disabled: isSubmitting,
      icon: <Power className="size-4" />,
      key: secondaryAction.action,
      label: settingsActionLabel(secondaryAction.action),
      onClick: () => onOpenAction(secondaryAction),
      variant: secondaryAction.action === 'DEACTIVATE' ? 'danger' : 'secondary',
    })
  }

  if (canReadAudit) {
    previewSecondaryActions.push({
      icon: <ClipboardList className="size-4" />,
      key: 'audit',
      label: 'Open audit',
      onClick: () => onOpenAudit(row),
      variant: 'secondary',
    })
  }

  return (
    <>
      <button
        aria-label="Close settings preview"
        className="fixed inset-0 z-40 bg-black/20 xl:hidden"
        type="button"
        onClick={onClose}
      />
      <aside className="fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:inset-x-auto xl:bottom-6 xl:right-6 xl:top-[calc(var(--spacing-topbar)+0.75rem)] xl:z-40 xl:w-96">
        <div className="shrink-0 border-b border-border p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
                  {title}
                </h2>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {identifier} / {humanizeCode(type)}
              </p>
            </div>
            <button
              aria-label="Close settings preview panel"
              className="btn-icon shrink-0"
              title="Close"
              type="button"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <QuickPreviewTabs
          activeTab={activeTab}
          ariaLabel="Settings preview sections"
          tabs={previewTabs}
          onChange={setActiveTab}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'summary' ? (
            <div className="space-y-3">
              {type === 'categories' ? (
                <div className="flex h-32 items-center justify-center overflow-hidden rounded-[0.75rem] border border-border bg-surface-muted">
                  {(row as ServiceCategory).iconUrl || (row as ServiceCategory).icon?.url ? (
                    <img
                      alt=""
                      className="h-full w-full object-contain p-3"
                      src={
                        (row as ServiceCategory).iconUrl ??
                        (row as ServiceCategory).icon?.url ??
                        ''
                      }
                    />
                  ) : (
                    <ImageIcon className="size-8 text-muted" />
                  )}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3 rounded-[0.75rem] border border-border p-3">
                <SettingsSummaryField
                  label={type === 'zones' ? 'City' : 'Category'}
                  value={
                    type === 'settings'
                      ? humanizeCode((row as PlatformSetting).category)
                      : type === 'zones'
                        ? (row as ServiceZone).city
                        : (row as ServiceCategory).categoryCode
                  }
                />
                <SettingsSummaryField
                  label="Updated"
                  value={formatDate(row.updatedAt, true)}
                />
                <SettingsSummaryField
                  label={type === 'settings' ? 'Type' : 'Warnings'}
                  value={
                    type === 'settings'
                      ? humanizeCode((row as PlatformSetting).valueType)
                      : warnings.length
                  }
                />
                <SettingsSummaryField
                  label={type === 'zones' ? 'Pincodes' : 'State'}
                  value={
                    type === 'zones'
                      ? (row as ServiceZone).pincodeList.length
                      : status.label
                  }
                />
              </div>
            </div>
          ) : null}
          {activeTab === 'details' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <SettingsSummaryField
                  label={
                    type === 'settings'
                      ? 'Current value'
                      : type === 'categories'
                        ? 'Booking template'
                        : 'Coverage'
                  }
                  value={
                    type === 'settings' ? (
                      <p className="line-clamp-4 break-words">
                        {formatValue((row as PlatformSetting).value)}
                      </p>
                    ) : type === 'categories' ? (
                      `${
                        (row as ServiceCategory).bookingTemplate?.defaultPricingMode ??
                        'Not configured'
                      } / ${
                        (row as ServiceCategory).bookingTemplate?.quoteMode ??
                        'Instant'
                      }`
                    ) : (
                      (row as ServiceZone).pincodeList.slice(0, 8).join(', ') ||
                      'No pincodes'
                    )
                  }
                />
              </div>
              {type !== 'settings' && warnings.length ? (
                <div className="rounded-[0.75rem] border border-warning/25 bg-warning/10 p-3">
                  <SettingsSummaryField
                    label="Warnings"
                    value={warnings.map(humanizeCode).join(', ')}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <QuickPreviewActions
          detailAction={detailAction}
          primaryAction={previewPrimaryAction}
          secondaryActions={previewSecondaryActions}
        />
      </aside>
    </>
  )
}

function SettingsRowsSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="h-16 w-full border-b border-border" key={index} />
      ))}
    </div>
  )
}

function SettingsPagination({
  onPageChange,
  onPageSizeChange,
  pagination,
}: {
  onPageChange: (page: number) => void
  onPageSizeChange: (limit: number) => void
  pagination?: SettingsListResponse['pagination']
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

function SettingsRow({
  canReadAudit,
  canUpdateSettings,
  isPreviewed,
  isSelected,
  isSubmitting,
  onOpenAction,
  onOpenAudit,
  onOpenDetail,
  onPreview,
  onSelect,
  row,
  type,
  visibleColumns,
}: {
  canReadAudit: boolean
  canUpdateSettings: boolean
  isPreviewed: boolean
  isSelected: boolean
  isSubmitting: boolean
  onOpenAction: (selection: SettingsActionSelection) => void
  onOpenAudit: (row: Row) => void
  onOpenDetail: (row: Row) => void
  onPreview: (row: Row) => void
  onSelect: (row: Row, selected: boolean) => void
  row: Row
  type: SettingsRecordType
  visibleColumns: SettingsColumnId[]
}) {
  const visibleColumnDefinitions = settingsColumnsByType[type].filter((column) =>
    visibleColumns.includes(column.id),
  )
  const primaryAction = getPrimarySettingsAction({
    canUpdateSettings,
    row,
    type,
  })
  const secondaryAction = getSecondarySettingsAction({
    canUpdateSettings,
    row,
    type,
  })

  const openAction = (
    event: MouseEvent<HTMLButtonElement>,
    selection: SettingsActionSelection,
  ) => {
    event.stopPropagation()
    onOpenAction(selection)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onPreview(row)
    }
  }

  return (
    <div
      aria-selected={isSelected || isPreviewed}
      className={cn(
        'workbench-grid-row grid min-w-0 cursor-pointer gap-3 border-b border-border bg-surface px-3 py-2.5 text-left transition last:border-b-0 hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--settings-grid-template)] xl:items-center',
        isSelected && 'bg-primary/5 hover:bg-primary/10',
        isPreviewed &&
          'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onPreview(row)}
      onKeyDown={handleKeyDown}
    >
      <div className="flex min-w-0 items-start xl:items-center">
        <ListSelectionCheckbox
          checked={isSelected}
          label={`Select ${getRowId(type, row)}`}
          onChange={(selected) => onSelect(row, selected)}
        />
      </div>
      {visibleColumnDefinitions.map((column) => (
        <div className="min-w-0" key={column.id}>
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-normal text-muted xl:hidden">
            {column.label}
          </p>
          {column.render(row, type)}
        </div>
      ))}
      <div className="workbench-sticky-action-cell flex min-w-0 flex-nowrap items-center justify-start gap-1.5 pl-2 xl:justify-end">
        {primaryAction ? (
          <Button
            className="w-[7.75rem] shrink-0 overflow-hidden px-2.5"
            disabled={isSubmitting}
            size="sm"
            title={settingsActionLabel(primaryAction.action)}
            type="button"
            variant="secondary"
            onClick={(event) => openAction(event, primaryAction)}
          >
            {primaryAction.action === 'UPDATE' || primaryAction.action === 'EDIT' ? (
              <Edit3 className="mr-2 size-4 shrink-0" />
            ) : (
              <Power className="mr-2 size-4 shrink-0" />
            )}
            <span className="min-w-0 truncate">
              {settingsActionLabel(primaryAction.action)}
            </span>
          </Button>
        ) : null}
        {secondaryAction && secondaryAction.action !== primaryAction?.action ? (
          <Button
            aria-label={settingsActionLabel(secondaryAction.action)}
            className="size-9 shrink-0 px-0"
            disabled={isSubmitting}
            size="sm"
            title={settingsActionLabel(secondaryAction.action)}
            type="button"
            variant={
              secondaryAction.action === 'DEACTIVATE' ? 'danger' : 'secondary'
            }
            onClick={(event) => openAction(event, secondaryAction)}
          >
            <Power className="size-4 shrink-0" />
            <span className="sr-only">{settingsActionLabel(secondaryAction.action)}</span>
          </Button>
        ) : null}
        <button
          aria-label={`Open ${getRowId(type, row)} detail`}
          className="btn-icon shrink-0"
          title="Open detail"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpenDetail(row)
          }}
        >
          <ArrowUpRight className="size-4" />
        </button>
        {canReadAudit ? (
          <button
            aria-label={`Open audit history for ${getRowId(type, row)}`}
            className="btn-icon shrink-0"
            title="Open audit history"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAudit(row)
            }}
          >
            <ClipboardList className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function PolicyRuleActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  action: PolicyRuleActionSelection | null
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (payload: UpsertPolicyRulePayload) => void
}) {
  if (!action) return null

  const actionKey =
    action.action === 'CREATE'
      ? 'policy-rule:create'
      : `policy-rule:${action.record.policyRuleId}:${action.action}`

  return (
    <PolicyRuleActionModalContent
      action={action}
      error={error}
      isSubmitting={isSubmitting}
      key={actionKey}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

function PolicyRuleActionModalContent({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  action: PolicyRuleActionSelection
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (payload: UpsertPolicyRulePayload) => void
}) {
  const record = action.action === 'CREATE' ? null : action.record
  const isStatusOnly = action.action === 'ACTIVATE' || action.action === 'ARCHIVE'
  const [categoryId, setCategoryId] = useState(record?.scope.categoryId ?? '')
  const [cityScope, setCityScope] = useState(record?.scope.city ?? '')
  const [configJson, setConfigJson] = useState(
    formatJsonObjectValue(record?.config ?? {}),
  )
  const [description, setDescription] = useState(record?.description ?? '')
  const [displayName, setDisplayName] = useState(record?.displayName ?? '')
  const [effectiveFrom, setEffectiveFrom] = useState(
    formatPolicyDateTimeInput(record?.effectiveFrom),
  )
  const [effectiveTo, setEffectiveTo] = useState(
    formatPolicyDateTimeInput(record?.effectiveTo),
  )
  const [family, setFamily] = useState<PolicyFamily>(
    record?.family ?? 'PRICING_RULE',
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [metadataJson, setMetadataJson] = useState(
    formatJsonObjectValue(record?.metadata ?? {}),
  )
  const [priority, setPriority] = useState(String(record?.priority ?? 100))
  const [reason, setReason] = useState('')
  const [ruleKey, setRuleKey] = useState(record?.ruleKey ?? '')
  const [scopeType, setScopeType] = useState<PolicyScopeType>(
    record?.scope.scopeType ?? 'GLOBAL',
  )
  const [status, setStatus] = useState<PolicyStatus>(record?.status ?? 'DRAFT')
  const [vendorId, setVendorId] = useState(record?.scope.vendorId ?? '')
  const [zoneId, setZoneId] = useState(record?.scope.zoneId ?? '')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedReason = reason.trim()
    if (trimmedReason.length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }

    try {
      if (isStatusOnly && record) {
        onSubmit(
          policyPayloadFromRecord(record, {
            reason: trimmedReason,
            status: action.action === 'ACTIVATE' ? 'ACTIVE' : 'ARCHIVED',
          }),
        )
        return
      }

      const trimmedRuleKey = ruleKey.trim()
      const trimmedDisplayName = displayName.trim()
      const nextPriority = Number(priority)

      if (trimmedRuleKey.length < 3 || trimmedDisplayName.length < 3) {
        setFormError('Rule key and display name must be at least 3 characters.')
        return
      }

      if (!Number.isInteger(nextPriority) || nextPriority < 0) {
        setFormError('Priority must be a non-negative integer.')
        return
      }

      const nextCategoryId = scopeType === 'CATEGORY' ? categoryId.trim() : ''
      const nextCity = scopeType === 'CITY' ? cityScope.trim() : ''
      const nextZoneId = scopeType === 'ZONE' ? zoneId.trim() : ''
      const nextVendorId = scopeType === 'VENDOR' ? vendorId.trim() : ''

      if (
        (scopeType === 'CATEGORY' && !nextCategoryId) ||
        (scopeType === 'CITY' && !nextCity) ||
        (scopeType === 'ZONE' && !nextZoneId) ||
        (scopeType === 'VENDOR' && !nextVendorId)
      ) {
        setFormError(`${humanizeCode(scopeType)} scope requires its matching id/value.`)
        return
      }

      onSubmit({
        family,
        ruleKey: trimmedRuleKey,
        displayName: trimmedDisplayName,
        description: description.trim() || null,
        status,
        priority: nextPriority,
        scopeType,
        categoryId: nextCategoryId || null,
        city: nextCity || null,
        zoneId: nextZoneId || null,
        vendorId: nextVendorId || null,
        config: parseJsonObjectValue(configJson),
        metadata: parseJsonObjectValue(metadataJson),
        effectiveFrom: normalizeDateTimeInput(effectiveFrom),
        effectiveTo: effectiveTo.trim() ? normalizeDateTimeInput(effectiveTo) : null,
        reason: trimmedReason,
      })
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Policy payload must match the expected shape.',
      )
    }
  }

  return (
    <div className="premium-overlay flex items-start justify-center overflow-y-auto p-3 sm:p-6">
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[calc(100vh-3rem)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {action.action === 'CREATE'
                ? 'Create policy rule'
                : `${humanizeCode(action.action)} policy rule`}
            </h2>
            {record ? (
              <p className="mt-1 text-sm text-muted">{record.ruleKey}</p>
            ) : null}
          </div>
          <button
            aria-label="Close policy modal"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="min-h-0 flex-1 overflow-y-auto" onSubmit={handleSubmit}>
          <div className="space-y-4 p-5 sm:p-6">
            {isStatusOnly && record ? (
              <div className="rounded-[0.875rem] border border-border bg-surface-muted p-4">
                <p className="text-sm font-semibold text-foreground">
                  {action.action === 'ACTIVATE'
                    ? 'Activate this policy rule'
                    : 'Archive this policy rule'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  The existing rule payload will be preserved and only the status will
                  change after backend validation.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={policyStatusTone(record.status)}>
                    {humanizeCode(record.status)}
                  </Badge>
                  <Badge tone="info">{humanizeCode(record.family)}</Badge>
                  <Badge tone="neutral">{humanizeCode(record.scope.scopeType)}</Badge>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">Family</span>
                    <select
                      className="form-input"
                      disabled={Boolean(record)}
                      value={family}
                      onChange={(event) => setFamily(event.target.value as PolicyFamily)}
                    >
                      {policyFamilies.map((option) => (
                        <option key={option} value={option}>
                          {humanizeCode(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">Status</span>
                    <select
                      className="form-input"
                      value={status}
                      onChange={(event) => setStatus(event.target.value as PolicyStatus)}
                    >
                      {policyStatuses.map((option) => (
                        <option key={option} value={option}>
                          {humanizeCode(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">Rule key</span>
                    <Input
                      disabled={Boolean(record)}
                      placeholder="pricing.global.phase1"
                      value={ruleKey}
                      onChange={(event) => setRuleKey(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">
                      Display name
                    </span>
                    <Input
                      placeholder="Phase 1 global pricing"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">Priority</span>
                    <Input
                      inputMode="numeric"
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">Scope</span>
                    <select
                      className="form-input"
                      value={scopeType}
                      onChange={(event) =>
                        setScopeType(event.target.value as PolicyScopeType)
                      }
                    >
                      {policyScopeTypes.map((option) => (
                        <option key={option} value={option}>
                          {humanizeCode(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-muted">Description</span>
                  <textarea
                    className="form-input min-h-20"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  {scopeType === 'CATEGORY' ? (
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        Category id
                      </span>
                      <Input
                        placeholder="uuid"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                      />
                    </label>
                  ) : null}
                  {scopeType === 'CITY' ? (
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">City</span>
                      <Input
                        placeholder="Bengaluru"
                        value={cityScope}
                        onChange={(event) => setCityScope(event.target.value)}
                      />
                    </label>
                  ) : null}
                  {scopeType === 'ZONE' ? (
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">Zone id</span>
                      <Input
                        placeholder="uuid"
                        value={zoneId}
                        onChange={(event) => setZoneId(event.target.value)}
                      />
                    </label>
                  ) : null}
                  {scopeType === 'VENDOR' ? (
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        Vendor id
                      </span>
                      <Input
                        placeholder="uuid"
                        value={vendorId}
                        onChange={(event) => setVendorId(event.target.value)}
                      />
                    </label>
                  ) : null}
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">
                      Effective from
                    </span>
                    <Input
                      type="datetime-local"
                      value={effectiveFrom}
                      onChange={(event) => setEffectiveFrom(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">
                      Effective to
                    </span>
                    <Input
                      type="datetime-local"
                      value={effectiveTo}
                      onChange={(event) => setEffectiveTo(event.target.value)}
                    />
                  </label>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">
                      Config JSON
                    </span>
                    <textarea
                      className="form-input min-h-52 font-mono text-xs"
                      value={configJson}
                      onChange={(event) => setConfigJson(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">
                      Metadata JSON
                    </span>
                    <textarea
                      className="form-input min-h-52 font-mono text-xs"
                      value={metadataJson}
                      onChange={(event) => setMetadataJson(event.target.value)}
                    />
                  </label>
                </div>
              </>
            )}

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted">Reason</span>
              <textarea
                className="form-input min-h-20"
                placeholder="Why this policy change is needed"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>

            {formError || error ? (
              <div className="rounded-[0.75rem] border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
                {formError ?? error}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface px-5 py-4 sm:px-6">
            <Button
              disabled={isSubmitting}
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button isLoading={isSubmitting} type="submit">
              Save policy
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PricingPreviewModal({
  onClose,
}: {
  onClose: () => void
}) {
  const [categoryId, setCategoryId] = useState('')
  const [city, setCity] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [subtotalPaise, setSubtotalPaise] = useState('60000')
  const [vendorId, setVendorId] = useState('')
  const [zoneId, setZoneId] = useState('')

  const previewMutation = useMutation<
    PricingPolicyPreviewResponse,
    Error,
    PricingPolicyPreviewPayload
  >({
    mutationFn: (payload) => settingsService.previewPricingPolicy(payload),
  })
  const preview = previewMutation.data?.data
  const previewError = formError ?? previewMutation.error?.message ?? null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const subtotal = Number(subtotalPaise)
    if (!Number.isInteger(subtotal) || subtotal < 0) {
      setFormError('Subtotal must be a non-negative integer in paise.')
      return
    }

    previewMutation.mutate({
      categoryId: categoryId.trim() || undefined,
      city: city.trim() || undefined,
      zoneId: zoneId.trim() || undefined,
      vendorId: vendorId.trim() || undefined,
      subtotalPaise: subtotal,
    })
  }

  return (
    <div className="premium-overlay flex items-start justify-center overflow-y-auto p-3 sm:p-6">
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[calc(100vh-3rem)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Pricing preview
            </h2>
            <p className="mt-1 text-sm text-muted">
              Simulate pricing and commission rules without changing data.
            </p>
          </div>
          <button
            aria-label="Close pricing preview"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={previewMutation.isPending}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="min-h-0 flex-1 overflow-y-auto" onSubmit={handleSubmit}>
          <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:p-6">
            <div className="space-y-3">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted">
                  Subtotal paise
                </span>
                <Input
                  inputMode="numeric"
                  value={subtotalPaise}
                  onChange={(event) => setSubtotalPaise(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted">Category id</span>
                <Input
                  placeholder="uuid"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted">City</span>
                <Input
                  placeholder="Bengaluru"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted">Zone id</span>
                <Input
                  placeholder="uuid"
                  value={zoneId}
                  onChange={(event) => setZoneId(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted">Vendor id</span>
                <Input
                  placeholder="uuid"
                  value={vendorId}
                  onChange={(event) => setVendorId(event.target.value)}
                />
              </label>
              {previewError ? (
                <div className="rounded-[0.75rem] border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {previewError}
                </div>
              ) : null}
            </div>

            <div className="rounded-[0.875rem] border border-border bg-surface-muted p-4">
              {preview ? (
                <PricingPreviewResult preview={preview} />
              ) : (
                <div className="flex min-h-64 items-center justify-center text-center text-sm text-muted">
                  Run a preview to see payable amount, fees, commission, vendor net,
                  and applied policy rules.
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface px-5 py-4 sm:px-6">
            <Button
              disabled={previewMutation.isPending}
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Close
            </Button>
            <Button isLoading={previewMutation.isPending} type="submit">
              Preview
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PricingPreviewResult({ preview }: { preview: PricingPolicyPreview }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <MetricCard
          icon={<Calculator className="size-4 text-primary" />}
          label="Customer payable"
          meta="After fees, tax, discount"
          value={formatPaise(preview.customerPayablePaise)}
        />
        <MetricCard
          icon={<CheckCircle2 className="size-4 text-success" />}
          label="Vendor net"
          meta="After commission"
          value={formatPaise(preview.vendorNetPayablePaise)}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-[0.75rem] border border-border bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Fees
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-medium text-foreground">
                {formatPaise(preview.subtotalPaise)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Platform</dt>
              <dd className="font-medium text-foreground">
                {formatPaise(preview.fees.platformFeePaise)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Pickup</dt>
              <dd className="font-medium text-foreground">
                {formatPaise(preview.fees.pickupFeePaise)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Delivery</dt>
              <dd className="font-medium text-foreground">
                {formatPaise(preview.fees.deliveryFeePaise)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Tax</dt>
              <dd className="font-medium text-foreground">
                {formatPaise(preview.fees.taxPaise)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Discount</dt>
              <dd className="font-medium text-foreground">
                {formatPaise(preview.fees.discountPaise)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-[0.75rem] border border-border bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Applied rules
          </p>
          <div className="mt-2 space-y-2 text-sm">
            <div>
              <p className="font-semibold text-foreground">Pricing</p>
              <p className="break-all text-muted">
                {preview.appliedRules.pricing.ruleKey} · v
                {preview.appliedRules.pricing.version}
              </p>
              <Badge tone="info">
                {humanizeCode(preview.appliedRules.pricing.providerStatus)}
              </Badge>
            </div>
            <div>
              <p className="font-semibold text-foreground">Commission</p>
              <p className="break-all text-muted">
                {preview.appliedRules.commission.ruleKey} · v
                {preview.appliedRules.commission.version}
              </p>
              <Badge tone="info">
                {humanizeCode(preview.appliedRules.commission.providerStatus)}
              </Badge>
            </div>
          </div>
        </div>
      </div>
      {preview.warnings.length ? (
        <div className="rounded-[0.75rem] border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
          {preview.warnings.map(humanizeCode).join(', ')}
        </div>
      ) : null}
    </div>
  )
}

function PolicyRulesWorkspace({
  canReadAudit,
  canReadVendors,
  canUpdateSettings,
  isError,
  isInitialLoading,
  isRefreshing,
  onCreate,
  onOpenAudit,
  onOpenCategory,
  onOpenVendor,
  onOpenZone,
  onPreview,
  onPreviewPricing,
  onRefresh,
  onSelectAction,
  rows,
  selectedPolicyRuleId,
}: {
  canReadAudit: boolean
  canReadVendors: boolean
  canUpdateSettings: boolean
  isError: boolean
  isInitialLoading: boolean
  isRefreshing: boolean
  onCreate: () => void
  onOpenAudit: (row: PolicyRule) => void
  onOpenCategory: (categoryId: string) => void
  onOpenVendor: (vendorId: string) => void
  onOpenZone: (zoneId: string) => void
  onPreview: (row: PolicyRule) => void
  onPreviewPricing: () => void
  onRefresh: () => void
  onSelectAction: (action: PolicyRuleActionSelection) => void
  rows: PolicyRule[]
  selectedPolicyRuleId?: string | null
}) {
  if (isError) {
    return (
      <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        <ErrorState
          description="We could not load policy rules."
          title="Policy rules unavailable"
          onRetry={onRefresh}
        />
      </div>
    )
  }

  if (isInitialLoading) {
    return (
      <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        <SettingsRowsSkeleton />
      </div>
    )
  }

  return (
    <div className="flex flex-col xl:min-h-0 xl:flex-1">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/40 px-3 py-2.5">
        <p className="text-sm text-muted">
          {rows.length} policy rules from backend filters
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" type="button" variant="secondary" onClick={onPreviewPricing}>
            <Calculator className="mr-2 size-4" />
            Preview pricing
          </Button>
          <Button
            disabled={!canUpdateSettings}
            size="sm"
            title={
              canUpdateSettings
                ? 'Create policy rule'
                : 'Requires settings:update'
            }
            type="button"
            variant="secondary"
            onClick={onCreate}
          >
            <Plus className="mr-2 size-4" />
            Policy rule
          </Button>
          <Button size="sm" type="button" variant="secondary" onClick={onRefresh}>
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

      {rows.length === 0 ? (
        <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
          <EmptyState
            description="No policy rules matched the current backend filters."
            title="No policy rules found"
          />
        </div>
      ) : (
        <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
          <div className="min-w-[78rem]">
            <div className="sticky top-0 z-30 grid grid-cols-[minmax(17rem,1.4fr)_8rem_minmax(12rem,0.9fr)_8rem_minmax(13rem,0.9fr)_15rem] gap-3 border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted shadow-[0_1px_0_var(--adaptive-border)]">
              <div>Rule</div>
              <div>Status</div>
              <div>Scope</div>
              <div>Priority</div>
              <div>Effective</div>
              <div className="workbench-sticky-action-head flex min-w-0 pr-3">
                <span className="truncate">Actions</span>
              </div>
            </div>
            <div>
              {rows.map((rule) => (
                <PolicyRuleRow
                  canReadAudit={canReadAudit}
                  canReadVendors={canReadVendors}
                  canUpdateSettings={canUpdateSettings}
                  isPreviewed={selectedPolicyRuleId === rule.policyRuleId}
                  key={rule.policyRuleId}
                  rule={rule}
                  onOpenAudit={onOpenAudit}
                  onOpenCategory={onOpenCategory}
                  onOpenVendor={onOpenVendor}
                  onOpenZone={onOpenZone}
                  onPreview={onPreview}
                  onSelectAction={onSelectAction}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PolicyRuleRow({
  canReadAudit,
  canReadVendors,
  canUpdateSettings,
  isPreviewed,
  onOpenAudit,
  onOpenCategory,
  onOpenVendor,
  onOpenZone,
  onPreview,
  onSelectAction,
  rule,
}: {
  canReadAudit: boolean
  canReadVendors: boolean
  canUpdateSettings: boolean
  isPreviewed: boolean
  onOpenAudit: (row: PolicyRule) => void
  onOpenCategory: (categoryId: string) => void
  onOpenVendor: (vendorId: string) => void
  onOpenZone: (zoneId: string) => void
  onPreview: (row: PolicyRule) => void
  onSelectAction: (action: PolicyRuleActionSelection) => void
  rule: PolicyRule
}) {
  const secondaryAction: PolicyRuleAction =
    rule.status === 'ACTIVE' ? 'ARCHIVE' : 'ACTIVATE'
  const canEdit = canUpdateSettings && hasPolicyAction(rule, 'EDIT')
  const canRunSecondary =
    canUpdateSettings &&
    hasPolicyAction(rule, secondaryAction === 'ARCHIVE' ? 'ARCHIVE' : 'ACTIVATE')

  return (
    <div
      aria-label={`Preview policy rule ${rule.displayName}`}
      aria-selected={isPreviewed}
      className={cn(
        'workbench-grid-row grid cursor-pointer grid-cols-[minmax(17rem,1.4fr)_8rem_minmax(12rem,0.9fr)_8rem_minmax(13rem,0.9fr)_15rem] gap-3 border-b border-border bg-surface px-3 py-2.5 transition last:border-b-0 hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        isPreviewed &&
          'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onPreview(rule)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPreview(rule)
        }
      }}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{rule.displayName}</p>
        <p className="truncate text-xs text-muted">{rule.ruleKey}</p>
        <p className="mt-1 text-xs text-muted">{humanizeCode(rule.family)}</p>
      </div>
      <div>
        <Badge tone={policyStatusTone(rule.status)}>
          {humanizeCode(rule.status)}
        </Badge>
        <p className="mt-1 text-xs text-muted">v{rule.version}</p>
      </div>
      <div className="min-w-0">
        <p className="font-medium text-foreground">
          {humanizeCode(rule.scope.scopeType)}
        </p>
        <p className="break-all text-xs text-muted">{getPolicyScopeLabel(rule)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {rule.scope.categoryId ? (
            <button
              className="text-xs font-semibold text-primary hover:underline"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenCategory(rule.scope.categoryId as string)
              }}
            >
              Category
            </button>
          ) : null}
          {rule.scope.zoneId ? (
            <button
              className="text-xs font-semibold text-primary hover:underline"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenZone(rule.scope.zoneId as string)
              }}
            >
              Zone
            </button>
          ) : null}
          {rule.scope.vendorId && canReadVendors ? (
            <button
              className="text-xs font-semibold text-primary hover:underline"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenVendor(rule.scope.vendorId as string)
              }}
            >
              Vendor
            </button>
          ) : null}
        </div>
      </div>
      <div>
        <p className="font-semibold text-foreground">{rule.priority}</p>
        <p className="text-xs text-muted">Lower wins</p>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          {formatDate(rule.effectiveFrom, true)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {rule.effectiveTo ? formatDate(rule.effectiveTo, true) : 'No end date'}
        </p>
      </div>
      <div className="workbench-sticky-action-cell flex min-w-0 flex-nowrap items-center justify-end gap-1.5 pl-2 pr-3">
        <Button
          className="w-[7.75rem] shrink-0 overflow-hidden px-2.5"
          disabled={!canEdit}
          size="sm"
          title={
            canEdit
              ? 'Edit policy rule'
              : canUpdateSettings
                ? 'Edit unavailable from backend actions'
                : 'Requires settings:update'
          }
          type="button"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation()
            onSelectAction({ action: 'EDIT', record: rule })
          }}
        >
          <Edit3 className="mr-2 size-4 shrink-0" />
          <span className="min-w-0 truncate">Edit</span>
        </Button>
        <Button
          aria-label={policyActionLabel(secondaryAction)}
          className="size-9 shrink-0 px-0"
          disabled={!canRunSecondary}
          size="sm"
          title={
            canRunSecondary
              ? `${humanizeCode(secondaryAction)} policy rule`
              : canUpdateSettings
                ? 'State change unavailable from backend actions'
                : 'Requires settings:update'
          }
          type="button"
          variant={secondaryAction === 'ARCHIVE' ? 'danger' : 'secondary'}
          onClick={(event) => {
            event.stopPropagation()
            onSelectAction({ action: secondaryAction, record: rule })
          }}
        >
          {secondaryAction === 'ARCHIVE' ? (
            <Archive className="size-4 shrink-0" />
          ) : (
            <Power className="size-4 shrink-0" />
          )}
          <span className="sr-only">{policyActionLabel(secondaryAction)}</span>
        </Button>
        {canReadAudit ? (
          <button
            className="btn-icon shrink-0"
            title="Open audit history"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAudit(rule)
            }}
          >
            <ClipboardList className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canUpdateSettings = usePermission('settings:update')
  const canReadAudit = usePermission('audit:read')
  const canReadVendors = usePermission('vendors:read')
  const [type, setType] = useState<SettingsWorkspaceType>(() =>
    readSettingsWorkspaceType(searchParams),
  )
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [category, setCategory] = useState(() => searchParams.get('category') ?? '')
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [isEditable, setIsEditable] = useState(() =>
    readBooleanFilter(searchParams, 'isEditable'),
  )
  const [isActive, setIsActive] = useState(() =>
    readBooleanFilter(searchParams, 'isActive'),
  )
  const [policyFamily, setPolicyFamily] = useState(() =>
    readEnumFilter(
      searchParams,
      searchParams.has('family') ? 'family' : 'policyFamily',
      policyFamilies,
    ),
  )
  const [policyScopeType, setPolicyScopeType] = useState(() =>
    readEnumFilter(
      searchParams,
      searchParams.has('scopeType') ? 'scopeType' : 'policyScopeType',
      policyScopeTypes,
    ),
  )
  const [policyStatus, setPolicyStatus] = useState(() =>
    readEnumFilter(
      searchParams,
      searchParams.has('status') ? 'status' : 'policyStatus',
      policyStatuses,
    ),
  )
  const [pricingPreviewOpen, setPricingPreviewOpen] = useState(false)
  const [selectedPolicyAction, setSelectedPolicyAction] =
    useState<PolicyRuleActionSelection | null>(null)
  const [selectedAction, setSelectedAction] =
    useState<SettingsActionSelection | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [previewSelection, setPreviewSelection] =
    useState<SettingsPreviewSelection>(null)
  const [visibleColumns, setVisibleColumns] = useState<SettingsColumnId[]>(
    defaultVisibleColumns(isSettingsRecordType(type) ? type : 'settings'),
  )
  const [columnWidths, setColumnWidths] =
    useState<SettingsColumnWidths>(loadSettingsColumnWidths)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SETTINGS_COLUMN_WIDTH_STORAGE_KEY,
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

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
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

  const resetToFirstPage = () => setPage(1)
  const hasActiveFilters = Boolean(
    search ||
      category ||
      city ||
      isEditable ||
      isActive ||
      policyFamily ||
      policyScopeType ||
      policyStatus,
  )

  const clearSeededSettingsParams = () => {
    const seededKeys = [
      'category',
      'city',
      'family',
      'isActive',
      'isEditable',
      'policyFamily',
      'policyScopeType',
      'policyStatus',
      'scopeType',
      'search',
      'status',
      'tab',
      'type',
    ]

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const switchType = (nextType: SettingsWorkspaceType) => {
    clearSeededSettingsParams()
    setType(nextType)
    setPage(1)
    setSearch('')
    setCategory('')
    setCity('')
    setIsEditable('')
    setIsActive('')
    setPolicyFamily('')
    setPolicyScopeType('')
    setPolicyStatus('')
    setPricingPreviewOpen(false)
    setSelectedPolicyAction(null)
    setSelectedAction(null)
    setColumnsOpen(false)
    setPreviewSelection(null)
    if (isSettingsRecordType(nextType)) {
      setVisibleColumns(defaultVisibleColumns(nextType))
    }
  }

  const query = useMemo(() => {
    const base = {
      page,
      limit,
      search: search.trim() || undefined,
    }

    if (!isSettingsRecordType(type)) {
      return base satisfies SettingsListQueryParams
    }

    if (type === 'settings') {
      return {
        ...base,
        category: category.trim() || undefined,
        isEditable: isEditable === '' ? undefined : isEditable === 'true',
      } satisfies SettingsListQueryParams
    }

    if (type === 'zones') {
      return {
        ...base,
        city: city.trim() || undefined,
        isActive: isActive === '' ? undefined : isActive === 'true',
      } satisfies SettingsZonesQueryParams
    }

    return {
      ...base,
      isActive: isActive === '' ? undefined : isActive === 'true',
    } satisfies SettingsCategoriesQueryParams
  }, [category, city, isActive, isEditable, limit, page, search, type])

  const policyQuery = useMemo(
    () =>
      ({
        family: policyFamily ? (policyFamily as PolicyFamily) : undefined,
        scopeType: policyScopeType
          ? (policyScopeType as PolicyScopeType)
          : undefined,
        status: policyStatus ? (policyStatus as PolicyStatus) : undefined,
      }) satisfies PolicyRulesQueryParams,
    [policyFamily, policyScopeType, policyStatus],
  )

  const result = useQuery<SettingsListResponse>({
    queryKey: ['settings-console', type, query],
    queryFn: () => {
      if (!isSettingsRecordType(type)) {
        throw new Error('Settings list query is not available for policies.')
      }

      if (type === 'settings') {
        return settingsService.getSettings(query as SettingsListQueryParams)
      }
      if (type === 'categories') {
        return settingsService.getCategories(query as SettingsCategoriesQueryParams)
      }
      return settingsService.getZones(query as SettingsZonesQueryParams)
    },
    enabled: isSettingsRecordType(type),
  })

  const policyResult = useQuery<PolicyRulesListResponse>({
    queryKey: ['settings-policy-rules', policyQuery],
    queryFn: () => settingsService.getPolicyRules(policyQuery),
    enabled: type === 'policies',
  })

  const mutation = useMutation<SettingsMutationResponse | unknown, Error, SettingsActionFormValues>({
    mutationFn: async (values: SettingsActionFormValues) => {
      if (!selectedAction) throw new Error('No action selected.')

      if (selectedAction.type === 'settings') {
        return settingsService.updateSetting(selectedAction.record.settingKey, {
          value: values.value,
          reason: values.reason,
        })
      }

      if (
        selectedAction.type === 'zones' &&
        selectedAction.action === 'CREATE'
      ) {
        if (!values.city || !values.zoneName) {
          throw new Error('City and zone name are required.')
        }

        return settingsService.createZone({
          city: values.city,
          zoneName: values.zoneName,
          pincodeList: values.pincodeList,
          isActive: values.isActive,
          reason: values.reason,
        })
      }

      if (selectedAction.type === 'categories') {
        const {
          categoryCode,
          categoryImageFile,
          name,
          description,
          bookingTemplate,
          displayOrder,
          isActive,
          reason,
        } = values

        if (!reason) {
          throw new Error('Reason is required.')
        }

        if (selectedAction.action === 'CREATE') {
          if (!name) {
            throw new Error('Category name is required.')
          }

          const created = await settingsService.createCategory({
            categoryCode,
            name,
            description,
            bookingTemplate,
            displayOrder,
            isActive,
            reason,
          })

          if (categoryImageFile) {
            return settingsService.uploadCategoryImage(
              created.data.categoryId,
              categoryImageFile,
              reason,
            )
          }

          return created
        }

        const updated = await settingsService.updateCategory(
          selectedAction.record.categoryId,
          {
            name,
            description,
            bookingTemplate,
            displayOrder,
            isActive,
            reason,
          },
        )

        if (categoryImageFile) {
          return settingsService.uploadCategoryImage(
            selectedAction.record.categoryId,
            categoryImageFile,
            reason,
          )
        }

        return updated
      }

      if (selectedAction.type === 'serviceTypes') {
        throw new Error('Service type actions are available from category detail.')
      }

      return settingsService.updateZone(selectedAction.record.zoneId, values)
    },
    onSuccess: () => {
      const action = selectedAction
      setSelectedAction(null)
      void result.refetch()
      void queryClient.invalidateQueries({ queryKey: ['settings-console'] })

      if (action?.type === 'settings') {
        void queryClient.invalidateQueries({
          queryKey: ['settings-detail', 'settings', action.record.settingKey],
        })
      }

      if (action?.type === 'categories' && action.action !== 'CREATE') {
        void queryClient.invalidateQueries({
          queryKey: ['settings-detail', 'categories', action.record.categoryId],
        })
      }

      if (action?.type === 'zones' && action.action !== 'CREATE') {
        void queryClient.invalidateQueries({
          queryKey: ['settings-detail', 'zones', action.record.zoneId],
        })
      }
    },
  })

  const policyMutation = useMutation<
    PolicyRuleResponse,
    Error,
    UpsertPolicyRulePayload
  >({
    mutationFn: (payload) => settingsService.upsertPolicyRule(payload),
    onSuccess: () => {
      setSelectedPolicyAction(null)
      void policyResult.refetch()
      void queryClient.invalidateQueries({ queryKey: ['settings-policy-rules'] })
    },
  })

  const activeSettingsType = isSettingsRecordType(type) ? type : 'settings'
  const rows = isSettingsRecordType(type)
    ? ((result.data?.data ?? []) as Row[])
    : []
  const policyRows = policyResult.data?.data ?? []
  const pagination = isSettingsRecordType(type) ? result.data?.pagination : undefined
  const columns = settingsColumnsByType[activeSettingsType]
  const settingsSelection = useListSelection(rows, (row) =>
    getRowId(activeSettingsType, row),
  )
  const isInitialLoading =
    type === 'policies'
      ? policyResult.isLoading && policyRows.length === 0
      : result.isLoading && rows.length === 0
  const isRefreshing =
    type === 'policies'
      ? policyResult.isFetching && !isInitialLoading
      : result.isFetching && !isInitialLoading
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing'
    : formatRefreshTime(
        type === 'policies' ? policyResult.dataUpdatedAt : result.dataUpdatedAt,
      )
  const settingsGridStyle = useMemo<SettingsGridStyle>(
    () => ({
      '--settings-grid-template': getSettingsGridTemplate(
        activeSettingsType,
        visibleColumns,
        columnWidths,
      ),
      '--settings-grid-min-width': getSettingsGridMinWidth(
        activeSettingsType,
        visibleColumns,
        columnWidths,
      ),
    }),
    [activeSettingsType, columnWidths, visibleColumns],
  )

  const startColumnResize = (
    columnId: SettingsColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getSettingsColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: clampSettingsColumnWidth(columnId, nextWidth),
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

  const adjustColumnWidth = (columnId: SettingsColumnWidthId, delta: number) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: clampSettingsColumnWidth(
        columnId,
        getSettingsColumnWidth(currentWidths, columnId) + delta,
      ),
    }))
  }

  const resetColumnWidth = (columnId: SettingsColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: defaultSettingsColumnWidths[columnId],
    }))
  }

  const toggleColumn = (columnId: SettingsColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        return currentColumns.length === 1
          ? currentColumns
          : currentColumns.filter((item) => item !== columnId)
      }

      return columns
        .map((column) => column.id)
        .filter((item) => currentColumns.includes(item) || item === columnId)
    })
  }

  const clearFilters = () => {
    clearSeededSettingsParams()
    setSearch('')
    setCategory('')
    setCity('')
    setIsEditable('')
    setIsActive('')
    setPolicyFamily('')
    setPolicyScopeType('')
    setPolicyStatus('')
    setPage(1)
  }

  const activeFilterChips: ActiveSettingsFilterChip[] = []
  const addActiveFilterChip = (
    condition: boolean,
    key: string,
    label: string,
    onClear: () => void,
  ) => {
    if (condition) activeFilterChips.push({ key, label, onClear })
  }

  addActiveFilterChip(Boolean(search.trim()), 'search', `Search: ${search.trim()}`, () => {
    clearSeededSettingsParams()
    setSearch('')
    resetToFirstPage()
  })
  addActiveFilterChip(Boolean(category.trim()), 'category', `Category: ${category.trim()}`, () => {
    clearSeededSettingsParams()
    setCategory('')
    resetToFirstPage()
  })
  addActiveFilterChip(Boolean(city.trim()), 'city', `City: ${city.trim()}`, () => {
    clearSeededSettingsParams()
    setCity('')
    resetToFirstPage()
  })
  addActiveFilterChip(Boolean(isEditable), 'editable', `Editable: ${humanizeCode(isEditable)}`, () => {
    clearSeededSettingsParams()
    setIsEditable('')
    resetToFirstPage()
  })
  addActiveFilterChip(Boolean(isActive), 'active', `Active: ${humanizeCode(isActive)}`, () => {
    clearSeededSettingsParams()
    setIsActive('')
    resetToFirstPage()
  })
  addActiveFilterChip(
    Boolean(policyFamily),
    'policy-family',
    `Family: ${humanizeCode(policyFamily)}`,
    () => {
      clearSeededSettingsParams()
      setPolicyFamily('')
    },
  )
  addActiveFilterChip(
    Boolean(policyStatus),
    'policy-status',
    `Status: ${humanizeCode(policyStatus)}`,
    () => {
      clearSeededSettingsParams()
      setPolicyStatus('')
    },
  )
  addActiveFilterChip(
    Boolean(policyScopeType),
    'policy-scope',
    `Scope: ${humanizeCode(policyScopeType)}`,
    () => {
      clearSeededSettingsParams()
      setPolicyScopeType('')
    },
  )

  const openDetail = (row: Row) => {
    navigate(
      `${routePaths.settings}/${activeSettingsType}/${encodeURIComponent(
        getRowId(activeSettingsType, row),
      )}`,
    )
  }

  const openAudit = (row: Row) => {
    navigate(buildSettingsAuditPath(activeSettingsType, row))
  }

  const openPolicyAudit = (row: PolicyRule) => {
    navigate(buildPolicyRuleAuditPath(row))
  }

  const openPolicyCategory = (categoryId: string) => {
    navigate(`${routePaths.settings}/categories/${encodeURIComponent(categoryId)}`)
  }

  const openPolicyZone = (zoneId: string) => {
    navigate(`${routePaths.settings}/zones/${encodeURIComponent(zoneId)}`)
  }

  const openPolicyVendor = (vendorId: string) => {
    navigate(`${routePaths.vendors}/${encodeURIComponent(vendorId)}`)
  }

  return (
    <PageContainer className="flex min-h-full flex-col space-y-3 !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader layout="workspace" placement="topbar" title="Settings" />

      <section className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1">
        <main
          className="flex min-w-0 flex-col self-stretch overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1"
          id={type === 'policies' ? 'settings-policy-rules' : 'settings-records'}
        >
          <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(11rem,0.32fr)_minmax(18rem,1fr)_auto] xl:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="text-base font-semibold text-foreground">Settings</h1>
                <span
                  className={cn(
                    'rounded-full bg-surface-muted px-2 py-1 text-xs font-semibold',
                    isRefreshing ? 'text-primary' : 'text-muted',
                  )}
                >
                  {refreshStatusLabel}
                </span>
              </div>

              {type !== 'policies' ? (
                <ListHeaderSearch
                  ariaLabel="Search settings records"
                  className="w-full min-w-0"
                  placeholder={`Search ${recordLabel(type)}...`}
                  value={search}
                  onChange={(nextSearch) => {
                    clearSeededSettingsParams()
                    setSearch(nextSearch)
                    resetToFirstPage()
                  }}
                />
              ) : (
                <div className="min-h-10 rounded-[0.75rem] border border-dashed border-border bg-surface-muted/40 px-3 py-2 text-sm text-muted">
                  Policy rules are filtered by family, status, and scope.
                </div>
              )}

              <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 xl:justify-end">
                <Button
                  aria-expanded={filtersOpen}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setFiltersOpen((current) => !current)}
                >
                  <Filter className="mr-2 size-4" />
                  Filters
                  {activeFilterChips.length ? (
                    <span className="ml-1 size-2 rounded-full bg-primary" />
                  ) : null}
                </Button>

                {type === 'categories' ? (
                  <Button
                    disabled={!canUpdateSettings}
                    size="sm"
                    title={
                      canUpdateSettings
                        ? 'Create category'
                        : 'Requires settings:update'
                    }
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setSelectedAction({ type: 'categories', action: 'CREATE' })
                    }
                  >
                    <Plus className="mr-2 size-4" />
                    Category
                  </Button>
                ) : null}

                {type === 'zones' ? (
                  <Button
                    disabled={!canUpdateSettings}
                    size="sm"
                    title={
                      canUpdateSettings ? 'Create zone' : 'Requires settings:update'
                    }
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedAction({ type: 'zones', action: 'CREATE' })}
                  >
                    <Plus className="mr-2 size-4" />
                    Zone
                  </Button>
                ) : null}

                {type === 'policies' ? (
                  <>
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => setPricingPreviewOpen(true)}
                    >
                      <Calculator className="mr-2 size-4" />
                      Preview
                    </Button>
                    <Button
                      disabled={!canUpdateSettings}
                      size="sm"
                      title={
                        canUpdateSettings
                          ? 'Create policy rule'
                          : 'Requires settings:update'
                      }
                      type="button"
                      variant="secondary"
                      onClick={() => setSelectedPolicyAction({ action: 'CREATE' })}
                    >
                      <Plus className="mr-2 size-4" />
                      Rule
                    </Button>
                  </>
                ) : null}

                {type !== 'policies' ? (
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
                        className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-60 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
                        role="menu"
                      >
                        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-normal text-muted">
                          Visible columns
                        </p>
                        {columns.map((column) => {
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
                ) : null}

                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    type === 'policies'
                      ? void policyResult.refetch()
                      : void result.refetch()
                  }
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

            <div className="mt-3 flex gap-2 overflow-x-auto rounded-[0.875rem] border border-border bg-surface-muted/45 p-1">
              {settingsTabs.map((tab) => {
                const isActiveTab = type === tab.type
                const count =
                  tab.type === type
                    ? tab.type === 'policies'
                      ? policyRows.length
                      : pagination?.totalItems
                    : undefined

                return (
                  <button
                    className={cn(
                      'inline-flex min-h-9 min-w-max flex-1 items-center justify-center gap-2 rounded-[0.65rem] px-3 text-sm font-semibold transition',
                      isActiveTab
                        ? 'bg-surface text-primary shadow-sm ring-1 ring-primary/25'
                        : 'text-muted hover:bg-surface/75 hover:text-foreground',
                    )}
                    key={tab.type}
                    type="button"
                    onClick={() => switchType(tab.type)}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {typeof count !== 'undefined' ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          isActiveTab
                            ? 'bg-primary/10 text-primary'
                            : 'bg-surface text-muted',
                        )}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            <ActiveSettingsFilterChips
              chips={activeFilterChips}
              onClearAll={clearFilters}
            />

            {filtersOpen ? (
              <div className="mt-3 rounded-[0.875rem] border border-border bg-surface-muted/35 p-3">
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(10rem,1fr))_auto] xl:items-end">
                  {type === 'settings' ? (
                    <>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">Category</span>
                        <Input
                          className={SETTINGS_FILTER_CONTROL_CLASS_NAME}
                          placeholder="orders, payouts"
                          value={category}
                          onChange={(event) => {
                            clearSeededSettingsParams()
                            setCategory(event.target.value)
                            resetToFirstPage()
                          }}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">Editable</span>
                        <select
                          className={SETTINGS_FILTER_CONTROL_CLASS_NAME}
                          value={isEditable}
                          onChange={(event) => {
                            clearSeededSettingsParams()
                            setIsEditable(event.target.value)
                            resetToFirstPage()
                          }}
                        >
                          <option value="">All</option>
                          <option value="true">Editable</option>
                          <option value="false">Locked</option>
                        </select>
                      </label>
                    </>
                  ) : null}

                  {type === 'zones' ? (
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">City</span>
                      <Input
                        className={SETTINGS_FILTER_CONTROL_CLASS_NAME}
                        placeholder="Chennai"
                        value={city}
                        onChange={(event) => {
                          clearSeededSettingsParams()
                          setCity(event.target.value)
                          resetToFirstPage()
                        }}
                      />
                    </label>
                  ) : null}

                  {type === 'policies' ? (
                    <>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">Family</span>
                        <select
                          className={SETTINGS_FILTER_CONTROL_CLASS_NAME}
                          value={policyFamily}
                          onChange={(event) => {
                            clearSeededSettingsParams()
                            setPolicyFamily(event.target.value)
                          }}
                        >
                          <option value="">All</option>
                          {policyFamilies.map((option) => (
                            <option key={option} value={option}>
                              {humanizeCode(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">Status</span>
                        <select
                          className={SETTINGS_FILTER_CONTROL_CLASS_NAME}
                          value={policyStatus}
                          onChange={(event) => {
                            clearSeededSettingsParams()
                            setPolicyStatus(event.target.value)
                          }}
                        >
                          <option value="">All</option>
                          {policyStatuses.map((option) => (
                            <option key={option} value={option}>
                              {humanizeCode(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">Scope</span>
                        <select
                          className={SETTINGS_FILTER_CONTROL_CLASS_NAME}
                          value={policyScopeType}
                          onChange={(event) => {
                            clearSeededSettingsParams()
                            setPolicyScopeType(event.target.value)
                          }}
                        >
                          <option value="">All</option>
                          {policyScopeTypes.map((option) => (
                            <option key={option} value={option}>
                              {humanizeCode(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}

                  {(type === 'categories' || type === 'zones') ? (
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">Active</span>
                      <select
                        className={SETTINGS_FILTER_CONTROL_CLASS_NAME}
                        value={isActive}
                        onChange={(event) => {
                          clearSeededSettingsParams()
                          setIsActive(event.target.value)
                          resetToFirstPage()
                        }}
                      >
                        <option value="">All</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </label>
                  ) : null}

                  <Button
                    className="h-10 w-full"
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

          {type === 'policies' ? (
            <div
              className={cn(
                'min-h-0 xl:flex-1',
                previewSelection?.type === 'policies'
                  ? 'grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-3 xl:p-3'
                  : 'flex flex-col',
              )}
            >
              <PolicyRulesWorkspace
                canReadAudit={canReadAudit}
                canReadVendors={canReadVendors}
                canUpdateSettings={canUpdateSettings}
                isError={policyResult.isError}
                isInitialLoading={isInitialLoading}
                isRefreshing={isRefreshing}
                rows={policyRows}
                selectedPolicyRuleId={
                  previewSelection?.type === 'policies'
                    ? previewSelection.record.policyRuleId
                    : null
                }
                onCreate={() => setSelectedPolicyAction({ action: 'CREATE' })}
                onOpenAudit={openPolicyAudit}
                onOpenCategory={openPolicyCategory}
                onOpenVendor={openPolicyVendor}
                onOpenZone={openPolicyZone}
                onPreview={(rule) => setPreviewSelection({ type: 'policies', record: rule })}
                onPreviewPricing={() => setPricingPreviewOpen(true)}
                onRefresh={() => void policyResult.refetch()}
                onSelectAction={setSelectedPolicyAction}
              />
              {previewSelection?.type === 'policies' ? (
                <SettingsRecordPreviewPanel
                  canReadAudit={canReadAudit}
                  canUpdateSettings={canUpdateSettings}
                  isSubmitting={policyMutation.isPending}
                  selection={previewSelection}
                  onClose={() => setPreviewSelection(null)}
                  onOpenAction={setSelectedAction}
                  onOpenAudit={openAudit}
                  onOpenDetail={openDetail}
                  onOpenPolicyAction={setSelectedPolicyAction}
                  onOpenPolicyAudit={openPolicyAudit}
                />
              ) : null}
            </div>
          ) : result.isError ? (
            <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <ErrorState
                description="We could not load settings data."
                title="Settings unavailable"
                onRetry={() => void result.refetch()}
              />
            </div>
          ) : isInitialLoading ? (
            <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <SettingsRowsSkeleton />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <EmptyState
                actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
                description={
                  hasActiveFilters
                    ? 'No records match the current filters.'
                    : 'No settings records were returned.'
                }
                title="No records"
                onAction={hasActiveFilters ? clearFilters : undefined}
              />
            </div>
          ) : (
            <div
              className={cn(
                'min-h-0 xl:flex-1',
                previewSelection?.type === activeSettingsType
                  ? 'grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-3 xl:p-3'
                  : 'flex flex-col',
              )}
            >
              <div className="flex min-w-0 flex-col overflow-hidden xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--settings-grid-min-width)]"
                    style={settingsGridStyle}
                  >
                    <div className="sticky top-0 z-30 hidden gap-3 grid-cols-[var(--settings-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted shadow-[0_1px_0_var(--adaptive-border)] xl:grid">
                      <div className="flex min-w-0 items-center">
                        <ListSelectionCheckbox
                          checked={settingsSelection.allVisibleSelected}
                          indeterminate={settingsSelection.someVisibleSelected}
                          label="Select visible settings records"
                          onChange={settingsSelection.setVisibleSelected}
                        />
                      </div>
                      {columns
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
                              onPointerDown={(event) =>
                                startColumnResize(column.id, event)
                              }
                            >
                              <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                            </button>
                          </div>
                        ))}
                      <div className="workbench-sticky-action-head relative flex min-w-0 pr-3">
                        <span className="truncate">Actions</span>
                        <button
                          aria-label="Resize actions column"
                          className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title="Drag to resize"
                          type="button"
                          onDoubleClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            resetColumnWidth(SETTINGS_ACTION_COLUMN_ID)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'ArrowLeft') {
                              event.preventDefault()
                              adjustColumnWidth(SETTINGS_ACTION_COLUMN_ID, -16)
                            }

                            if (event.key === 'ArrowRight') {
                              event.preventDefault()
                              adjustColumnWidth(SETTINGS_ACTION_COLUMN_ID, 16)
                            }
                          }}
                          onPointerDown={(event) =>
                            startColumnResize(SETTINGS_ACTION_COLUMN_ID, event)
                          }
                        >
                          <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                        </button>
                      </div>
                    </div>
                    <ListSelectionToolbar
                      allVisibleSelected={settingsSelection.allVisibleSelected}
                      selectedCount={settingsSelection.selectedCount}
                      visibleCount={settingsSelection.visibleCount}
                      onClear={settingsSelection.clearSelection}
                      onSelectVisible={() => settingsSelection.setVisibleSelected(true)}
                    />

                    <div>
                      {rows.map((row) => {
                        const rowId = getRowId(activeSettingsType, row)
                        const isPreviewed =
                          previewSelection?.type === activeSettingsType &&
                          getRowId(activeSettingsType, previewSelection.record) === rowId

                        return (
                          <SettingsRow
                            canReadAudit={canReadAudit}
                            canUpdateSettings={canUpdateSettings}
                            isPreviewed={isPreviewed}
                            isSelected={settingsSelection.isSelected(rowId)}
                            isSubmitting={mutation.isPending}
                            key={rowId}
                            row={row}
                            type={activeSettingsType}
                            visibleColumns={visibleColumns}
                            onOpenAction={setSelectedAction}
                            onOpenAudit={openAudit}
                            onOpenDetail={openDetail}
                            onPreview={(selectedRow) =>
                              setPreviewSelection({
                                type: activeSettingsType,
                                record: selectedRow,
                              })
                            }
                            onSelect={(selectedRow, selected) =>
                              settingsSelection.setItemSelected(
                                getRowId(activeSettingsType, selectedRow),
                                selected,
                              )
                            }
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>

                <SettingsPagination
                  pagination={pagination}
                  onPageChange={setPage}
                  onPageSizeChange={(nextLimit) => {
                    setLimit(nextLimit)
                    setPage(1)
                  }}
                />
              </div>

              {previewSelection?.type === activeSettingsType ? (
                <SettingsRecordPreviewPanel
                  canReadAudit={canReadAudit}
                  canUpdateSettings={canUpdateSettings}
                  isSubmitting={mutation.isPending}
                  selection={previewSelection}
                  onClose={() => setPreviewSelection(null)}
                  onOpenAction={setSelectedAction}
                  onOpenAudit={openAudit}
                  onOpenDetail={openDetail}
                  onOpenPolicyAction={setSelectedPolicyAction}
                  onOpenPolicyAudit={openPolicyAudit}
                />
              ) : null}
            </div>
          )}
        </main>
      </section>

      <SettingsActionModal
        action={selectedAction}
        error={mutation.error instanceof Error ? mutation.error.message : null}
        isSubmitting={mutation.isPending}
        onClose={() => {
          if (!mutation.isPending) {
            setSelectedAction(null)
          }
        }}
        onSubmit={(values) => mutation.mutate(values)}
      />
      <PolicyRuleActionModal
        action={selectedPolicyAction}
        error={
          policyMutation.error instanceof Error ? policyMutation.error.message : null
        }
        isSubmitting={policyMutation.isPending}
        onClose={() => {
          if (!policyMutation.isPending) {
            setSelectedPolicyAction(null)
          }
        }}
        onSubmit={(payload) => policyMutation.mutate(payload)}
      />
      {pricingPreviewOpen ? (
        <PricingPreviewModal onClose={() => setPricingPreviewOpen(false)} />
      ) : null}
    </PageContainer>
  )
}
