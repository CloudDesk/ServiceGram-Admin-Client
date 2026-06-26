import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  MapPinned,
  Plus,
  Power,
  RefreshCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  ToggleLeft,
} from 'lucide-react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { ListHeaderSearch } from '../../../components/ui/ListHeaderSearch'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { settingsService } from '../services/settings.service'
import {
  SettingsActionModal,
  type SettingsActionFormValues,
  type SettingsActionSelection,
} from './SettingsActionModal'
import type {
  PlatformSetting,
  PlatformSettingsListResponse,
  ServiceCategoriesListResponse,
  ServiceCategory,
  ServiceZone,
  ServiceZonesListResponse,
  SettingsCategoriesQueryParams,
  SettingsListQueryParams,
  SettingsRecordType,
  SettingsZonesQueryParams,
  UpdateCategoryResponse,
  UpdateSettingResponse,
  UpdateZoneResponse,
} from '../types/settings.types'

type Row = PlatformSetting | ServiceCategory | ServiceZone
type SettingsListResponse =
  | PlatformSettingsListResponse
  | ServiceCategoriesListResponse
  | ServiceZonesListResponse
type SettingsMutationResponse =
  | UpdateSettingResponse
  | UpdateCategoryResponse
  | UpdateZoneResponse
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

const DEFAULT_PAGE_SIZE = 10
const SETTINGS_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.settings.columnWidths.v1'
const SETTINGS_DEFAULT_COLUMN_WIDTH = 220
const SETTINGS_ACTION_COLUMN_ID = 'actions'
const SETTINGS_ACTION_COLUMN_MIN_WIDTH = 210
const SETTINGS_GRID_COLUMN_GAP = 12
const SETTINGS_GRID_INLINE_PADDING = 24

const settingsTabs: {
  icon: ReactNode
  label: string
  type: SettingsRecordType
}[] = [
  { icon: <Settings2 className="size-4" />, label: 'Platform settings', type: 'settings' },
  { icon: <ToggleLeft className="size-4" />, label: 'Categories', type: 'categories' },
  { icon: <MapPinned className="size-4" />, label: 'Zones', type: 'zones' },
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

        return (
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
  actions: 220,
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

function recordLabel(type: SettingsRecordType) {
  if (type === 'settings') return 'settings'
  if (type === 'categories') return 'categories'
  return 'zones'
}

function getRowId(type: SettingsRecordType, row: Row) {
  if (type === 'settings') return (row as PlatformSetting).settingKey
  if (type === 'categories') return (row as ServiceCategory).categoryId
  return (row as ServiceZone).zoneId
}

function latestUpdated(rows: Row[]) {
  const timestamps = rows
    .map((row) => new Date(row.updatedAt).getTime())
    .filter((value) => Number.isFinite(value))

  if (!timestamps.length) return null

  return new Date(Math.max(...timestamps)).toISOString()
}

function countWarnings(type: SettingsRecordType, rows: Row[]) {
  if (type === 'settings') {
    return rows.filter((row) => (row as PlatformSetting).isSensitive).length
  }

  return rows.reduce(
    (total, row) =>
      total + ((row as ServiceCategory | ServiceZone).warnings?.length ?? 0),
    0,
  )
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
      widths[columnId as SettingsColumnWidthId] = Math.max(
        getSettingsColumnMinWidth(columnId as SettingsColumnWidthId),
        Math.round(width),
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

function getSettingsColumnWidth(
  columnWidths: SettingsColumnWidths,
  columnId: SettingsColumnWidthId,
) {
  return Math.max(
    getSettingsColumnMinWidth(columnId),
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
  const columnCount = visibleColumns.length + 1
  const gridGapWidth = Math.max(columnCount - 1, 0) * SETTINGS_GRID_COLUMN_GAP

  return `${
    visibleWidth +
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

function SettingsRowsSkeleton() {
  return (
    <div className="space-y-2.5 p-3">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="h-20 w-full rounded-[1rem]" key={index} />
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
            className="form-input h-9 w-20 py-1"
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
      <div className="flex items-center justify-end gap-2 text-foreground">
        <button
          aria-label="Previous page"
          className="btn-icon"
          disabled={!pagination.hasPreviousPage}
          type="button"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-24 text-center text-sm font-medium">
          Page {pagination.page} of {pagination.totalPages}
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
  isSubmitting,
  onOpenAction,
  onOpenDetail,
  row,
  type,
  visibleColumns,
}: {
  isSubmitting: boolean
  onOpenAction: (selection: SettingsActionSelection) => void
  onOpenDetail: (row: Row) => void
  row: Row
  type: SettingsRecordType
  visibleColumns: SettingsColumnId[]
}) {
  const visibleColumnDefinitions = settingsColumnsByType[type].filter((column) =>
    visibleColumns.includes(column.id),
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenDetail(row)
    }
  }

  return (
    <div
      className="grid min-w-0 cursor-pointer gap-3 border-b border-border bg-surface px-3 py-3 text-left transition last:border-b-0 hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--settings-grid-template)] xl:items-center"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(row)}
      onKeyDown={handleKeyDown}
    >
      {visibleColumnDefinitions.map((column) => (
        <div className="min-w-0" key={column.id}>
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-normal text-muted xl:hidden">
            {column.label}
          </p>
          {column.render(row, type)}
        </div>
      ))}
      <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
        {type === 'settings' ? (
          <Button
            disabled={isSubmitting || !(row as PlatformSetting).isEditable}
            size="sm"
            type="button"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction({
                type: 'settings',
                action: 'UPDATE',
                record: row as PlatformSetting,
              })
            }}
          >
            <Edit3 className="mr-2 size-4" />
            Update
          </Button>
        ) : type === 'categories' ? (
          <>
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation()
                onOpenAction({
                  type: 'categories',
                  action: 'EDIT',
                  record: row as ServiceCategory,
                })
              }}
            >
              <Edit3 className="mr-2 size-4" />
              Edit
            </Button>
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation()
                onOpenAction({
                  type: 'categories',
                  action: (row as ServiceCategory).isActive
                    ? 'DEACTIVATE'
                    : 'ACTIVATE',
                  record: row as ServiceCategory,
                })
              }}
            >
              <Power className="mr-2 size-4" />
              {(row as ServiceCategory).isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation()
                onOpenAction({
                  type: 'zones',
                  action: 'EDIT',
                  record: row as ServiceZone,
                })
              }}
            >
              <Edit3 className="mr-2 size-4" />
              Edit
            </Button>
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation()
                onOpenAction({
                  type: 'zones',
                  action: (row as ServiceZone).isActive ? 'DEACTIVATE' : 'ACTIVATE',
                  record: row as ServiceZone,
                })
              }}
            >
              <Power className="mr-2 size-4" />
              {(row as ServiceZone).isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const [type, setType] = useState<SettingsRecordType>('settings')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [isEditable, setIsEditable] = useState('')
  const [isActive, setIsActive] = useState('')
  const [selectedAction, setSelectedAction] =
    useState<SettingsActionSelection | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<SettingsColumnId[]>(
    defaultVisibleColumns('settings'),
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
  const hasActiveFilters = Boolean(search || category || city || isEditable || isActive)

  const switchType = (nextType: SettingsRecordType) => {
    setType(nextType)
    setPage(1)
    setSearch('')
    setCategory('')
    setCity('')
    setIsEditable('')
    setIsActive('')
    setSelectedAction(null)
    setColumnsOpen(false)
    setVisibleColumns(defaultVisibleColumns(nextType))
  }

  const query = useMemo(() => {
    const base = {
      page,
      limit,
      search: search.trim() || undefined,
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

  const result = useQuery<SettingsListResponse>({
    queryKey: ['settings-console', type, query],
    queryFn: () => {
      if (type === 'settings') {
        return settingsService.getSettings(query as SettingsListQueryParams)
      }
      if (type === 'categories') {
        return settingsService.getCategories(query as SettingsCategoriesQueryParams)
      }
      return settingsService.getZones(query as SettingsZonesQueryParams)
    },
  })

  const mutation = useMutation<SettingsMutationResponse | unknown, Error, SettingsActionFormValues>({
    mutationFn: (values: SettingsActionFormValues) => {
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
        return settingsService.updateCategory(
          selectedAction.record.categoryId,
          values,
        )
      }

      return settingsService.updateZone(selectedAction.record.zoneId, values)
    },
    onSuccess: () => {
      setSelectedAction(null)
      void result.refetch()
    },
  })

  const rows = (result.data?.data ?? []) as Row[]
  const pagination = result.data?.pagination
  const columns = settingsColumnsByType[type]
  const warningCount = countWarnings(type, rows)
  const latest = latestUpdated(rows)
  const isInitialLoading = result.isLoading && rows.length === 0
  const isRefreshing = result.isFetching && !isInitialLoading
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing...'
    : formatRefreshTime(result.dataUpdatedAt)
  const settingsGridStyle = useMemo<SettingsGridStyle>(
    () => ({
      '--settings-grid-template': getSettingsGridTemplate(
        type,
        visibleColumns,
        columnWidths,
      ),
      '--settings-grid-min-width': getSettingsGridMinWidth(
        type,
        visibleColumns,
        columnWidths,
      ),
    }),
    [columnWidths, type, visibleColumns],
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
        [columnId]: Math.max(
          getSettingsColumnMinWidth(columnId),
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

  const adjustColumnWidth = (columnId: SettingsColumnWidthId, delta: number) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: Math.max(
        getSettingsColumnMinWidth(columnId),
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
    setSearch('')
    setCategory('')
    setCity('')
    setIsEditable('')
    setIsActive('')
    setPage(1)
  }

  const openDetail = (row: Row) => {
    navigate(
      `${routePaths.settings}/${type}/${encodeURIComponent(getRowId(type, row))}`,
    )
  }

  return (
    <PageContainer>
      <PageContextHeader
        description="Manage platform settings, category behavior, and service zones."
        placement="topbar"
        title="Settings"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <section className="grid shrink-0 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Settings2 className="size-4 text-primary" />}
            label="Total records"
            meta={recordLabel(type)}
            value={pagination?.totalItems ?? 0}
          />
          <MetricCard
            icon={<Search className="size-4 text-info" />}
            label="Loaded rows"
            meta="Current page"
            value={rows.length}
          />
          <MetricCard
            icon={<ToggleLeft className="size-4 text-warning" />}
            label={type === 'settings' ? 'Sensitive' : 'Warnings'}
            meta={type === 'settings' ? 'Loaded page' : 'Backend warnings'}
            value={warningCount}
          />
          <MetricCard
            icon={<RefreshCcw className="size-4 text-success" />}
            label="Latest update"
            meta={latest ? recordLabel(type) : 'No rows loaded'}
            value={latest ? formatDate(latest, true) : 'None'}
          />
        </section>

        <section
          className={cn(
            'grid min-h-[calc(100vh-15rem)] flex-1 gap-3 transition-[grid-template-columns] xl:min-h-0',
            filtersCollapsed
              ? 'xl:grid-cols-[3rem_minmax(0,1fr)]'
              : 'xl:grid-cols-[18rem_minmax(0,1fr)]',
          )}
        >
          <aside
            className={cn(
              'flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface',
              filtersCollapsed && 'items-center',
            )}
          >
            {filtersCollapsed ? (
              <button
                aria-label="Expand settings filters"
                className="mt-3 inline-flex size-9 items-center justify-center rounded-[0.65rem] text-muted transition hover:bg-surface-muted hover:text-foreground"
                title="Expand filters"
                type="button"
                onClick={() => setFiltersCollapsed(false)}
              >
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Settings workspace
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      Switch record types and stack filters.
                    </p>
                  </div>
                  <button
                    aria-label="Collapse settings filters"
                    className="btn-icon"
                    title="Collapse filters"
                    type="button"
                    onClick={() => setFiltersCollapsed(true)}
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {settingsTabs.map((tab) => (
                    <button
                      className={cn(
                        'flex min-h-10 w-full items-center justify-between rounded-[0.75rem] border px-3 text-left text-sm transition',
                        type === tab.type
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-surface-muted/50 text-foreground hover:border-primary/35',
                      )}
                      key={tab.type}
                      type="button"
                      onClick={() => switchType(tab.type)}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {tab.icon}
                        {tab.label}
                      </span>
                      <span className="text-xs font-semibold">
                        {type === tab.type ? (pagination?.totalItems ?? '...') : ''}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Filter stack
                    </h3>
                    {hasActiveFilters ? (
                      <button
                        className="text-xs font-semibold text-primary"
                        type="button"
                        onClick={clearFilters}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-3">
                    {type === 'settings' ? (
                      <>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold text-muted">
                            Category
                          </span>
                          <Input
                            className="min-h-10"
                            placeholder="orders, payouts"
                            value={category}
                            onChange={(event) => {
                              setCategory(event.target.value)
                              resetToFirstPage()
                            }}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold text-muted">
                            Editable
                          </span>
                          <select
                            className="form-input"
                            value={isEditable}
                            onChange={(event) => {
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
                        <span className="text-xs font-semibold text-muted">
                          City
                        </span>
                        <Input
                          className="min-h-10"
                          placeholder="Chennai"
                          value={city}
                          onChange={(event) => {
                            setCity(event.target.value)
                            resetToFirstPage()
                          }}
                        />
                      </label>
                    ) : null}
                    {type !== 'settings' ? (
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-muted">
                          Active
                        </span>
                        <select
                          className="form-input"
                          value={isActive}
                          onChange={(event) => {
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
                  </div>
                </div>
              </div>
            )}
          </aside>

          <main className="flex min-w-0 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {settingsTabs.find((tab) => tab.type === type)?.label}
                </h2>
                <p className="text-sm text-muted">
                  {pagination
                    ? `${pagination.totalItems} ${recordLabel(type)} · ${rows.length} loaded`
                    : 'Search, filter, and update settings records from backend data.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  className="w-full sm:w-72 lg:w-80"
                  placeholder={`Search ${recordLabel(type)}`}
                  value={search}
                  onChange={(nextSearch) => {
                    setSearch(nextSearch)
                    resetToFirstPage()
                  }}
                />
                {type === 'zones' ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedAction({ type: 'zones', action: 'CREATE' })}
                  >
                    <Plus className="mr-2 size-4" />
                    Zone
                  </Button>
                ) : null}
                <span
                  className={cn(
                    'text-xs font-medium',
                    isRefreshing ? 'text-primary' : 'text-muted',
                  )}
                >
                  {refreshStatusLabel}
                </span>
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
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-60 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
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
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => void result.refetch()}
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

            {result.isError ? (
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
                  description="No settings records matched the current filters."
                  title="No records found"
                />
              </div>
            ) : (
              <div className="flex flex-col xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--settings-grid-min-width)]"
                    style={settingsGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden gap-3 grid-cols-[var(--settings-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
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
                      <div className="relative flex min-w-0 items-center justify-end pr-3 text-right">
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

                    <div>
                      {rows.map((row) => (
                        <SettingsRow
                          isSubmitting={mutation.isPending}
                          key={getRowId(type, row)}
                          row={row}
                          type={type}
                          visibleColumns={visibleColumns}
                          onOpenAction={setSelectedAction}
                          onOpenDetail={openDetail}
                        />
                      ))}
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
            )}
          </main>
        </section>
      </div>

      <SettingsActionModal
        action={selectedAction}
        error={mutation.error instanceof Error ? mutation.error.message : null}
        isSubmitting={mutation.isPending}
        onClose={() => setSelectedAction(null)}
        onSubmit={(values) => mutation.mutate(values)}
      />
    </PageContainer>
  )
}
