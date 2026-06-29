import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FileJson,
  Film,
  ListChecks,
  MapPinned,
  Plus,
  Power,
  ReceiptText,
  Settings2,
  ShieldAlert,
  Store,
  TriangleAlert,
} from 'lucide-react'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { buildPathWithQueryParams } from '../../../utils/buildQueryParams'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { settingsService } from '../services/settings.service'
import {
  SettingsActionModal,
  type SettingsActionFormValues,
  type SettingsActionSelection,
} from './SettingsActionModal'
import type { StatusTone } from '../../../types/status.types'
import type {
  CategoryBookingTemplate,
  PlatformSetting,
  ServiceCategory,
  ServiceType,
  ServiceTypeResponse,
  ServiceTypesListResponse,
  ServiceZone,
  SettingsRecordType,
  UpdateCategoryResponse,
  UpdateSettingResponse,
  UpdateZoneResponse,
} from '../types/settings.types'

type RecordType = PlatformSetting | ServiceCategory | ServiceZone
type SettingsMutationResponse =
  | UpdateSettingResponse
  | UpdateCategoryResponse
  | UpdateZoneResponse
  | ServiceTypeResponse
type CatalogueAction = 'EDIT' | 'ACTIVATE' | 'DEACTIVATE'

const settingsDetailSectionIds = {
  bookingFields: 'settings-booking-fields',
  bookingTemplate: 'settings-booking-template',
  bookingWorkflow: 'settings-booking-workflow',
  categoryProfile: 'settings-category-profile',
  currentValue: 'settings-current-value',
  defaultValue: 'settings-default-value',
  lifecycle: 'settings-lifecycle',
  serviceTypes: 'settings-service-types',
  settingProfile: 'settings-profile',
  signals: 'settings-signals',
  zoneCoverage: 'settings-zone-coverage',
  zoneMetadata: 'settings-zone-metadata',
  zoneProfile: 'settings-zone-profile',
} as const

type SettingsDetailSectionId =
  (typeof settingsDetailSectionIds)[keyof typeof settingsDetailSectionIds]

function isSettingsRecordType(value: string | undefined): value is SettingsRecordType {
  return value === 'settings' || value === 'categories' || value === 'zones'
}

function recordName(type: SettingsRecordType, record: RecordType) {
  if (type === 'settings') return (record as PlatformSetting).displayName
  if (type === 'categories') return (record as ServiceCategory).name
  return (record as ServiceZone).zoneName
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

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'

  try {
    return formatDate(value, true)
  } catch {
    return 'Not available'
  }
}

function hasCatalogueAction(
  record: Pick<ServiceCategory | ServiceZone | ServiceType, 'availableActions'>,
  action: CatalogueAction,
) {
  return record.availableActions.includes(action)
}

function canRunCatalogueAction({
  action,
  canUpdateSettings,
  record,
}: {
  action: CatalogueAction
  canUpdateSettings: boolean
  record: Pick<ServiceCategory | ServiceZone | ServiceType, 'availableActions'>
}) {
  return canUpdateSettings && hasCatalogueAction(record, action)
}

function Field({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-medium text-foreground">
        {value}
      </div>
    </div>
  )
}

function SummaryCard({
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

function SectionShell({
  actionNode,
  children,
  description,
  icon,
  id,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  icon?: ReactNode
  id?: string
  title: string
}) {
  return (
    <section
      className="scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface"
      id={id}
    >
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

function JsonPanel({
  className,
  id,
  title,
  value,
}: {
  className?: string
  id?: string
  title: string
  value: unknown
}) {
  return (
    <section
      className={cn(
        'min-w-0 scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface',
        className,
      )}
      id={id}
    >
      <div className="flex items-center gap-2">
        <FileJson className="size-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <pre className="mt-3 max-h-[28rem] overflow-auto rounded-[0.75rem] bg-surface-muted p-3 text-xs leading-5 text-foreground">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </section>
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

function HeaderActions({
  canUpdateSettings,
  isSubmitting,
  onSelect,
  record,
  recordType,
}: {
  canUpdateSettings: boolean
  isSubmitting: boolean
  onSelect: (action: SettingsActionSelection) => void
  record: RecordType
  recordType: SettingsRecordType
}) {
  if (recordType === 'settings') {
    const setting = record as PlatformSetting
    if (!canUpdateSettings || !setting.isEditable) return null

    return (
      <Button
        disabled={isSubmitting}
        size="sm"
        type="button"
        variant="secondary"
        onClick={() =>
          onSelect({
            type: 'settings',
            action: 'UPDATE',
            record: setting,
          })
        }
      >
        <Edit3 className="mr-2 size-4" />
        Update
      </Button>
    )
  }

  if (recordType === 'categories') {
    const category = record as ServiceCategory
    const statusAction: CatalogueAction = category.isActive
      ? 'DEACTIVATE'
      : 'ACTIVATE'

    return (
      <>
        {canRunCatalogueAction({
          action: 'EDIT',
          canUpdateSettings,
          record: category,
        }) ? (
          <Button
            disabled={isSubmitting}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() =>
              onSelect({
                type: 'categories',
                action: 'EDIT',
                record: category,
              })
            }
          >
            <Edit3 className="mr-2 size-4" />
            Edit
          </Button>
        ) : null}
        {canRunCatalogueAction({
          action: statusAction,
          canUpdateSettings,
          record: category,
        }) ? (
          <Button
            disabled={isSubmitting}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() =>
              onSelect({
                type: 'categories',
                action: statusAction,
                record: category,
              })
            }
          >
            <Power className="mr-2 size-4" />
            {category.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        ) : null}
      </>
    )
  }

  const zone = record as ServiceZone
  const statusAction: CatalogueAction = zone.isActive ? 'DEACTIVATE' : 'ACTIVATE'

  return (
    <>
      {canRunCatalogueAction({
        action: 'EDIT',
        canUpdateSettings,
        record: zone,
      }) ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() =>
            onSelect({
              type: 'zones',
              action: 'EDIT',
              record: zone,
            })
          }
        >
          <Edit3 className="mr-2 size-4" />
          Edit
        </Button>
      ) : null}
      {canRunCatalogueAction({
        action: statusAction,
        canUpdateSettings,
        record: zone,
      }) ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() =>
            onSelect({
              type: 'zones',
              action: statusAction,
              record: zone,
            })
          }
        >
          <Power className="mr-2 size-4" />
          {zone.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      ) : null}
    </>
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
        <Badge tone="neutral">Inline</Badge>
      )}
    </div>
  )
}

function canEditSettingsRecord({
  canUpdateSettings,
  record,
  recordType,
}: {
  canUpdateSettings: boolean
  record: RecordType
  recordType: SettingsRecordType
}) {
  if (!canUpdateSettings) return false

  if (recordType === 'settings') {
    return (record as PlatformSetting).isEditable
  }

  return hasCatalogueAction(record as ServiceCategory | ServiceZone, 'EDIT')
}

function buildSettingsConsolePath(recordType: SettingsRecordType, record: RecordType) {
  const params = new URLSearchParams({ type: recordType })

  if (recordType === 'settings') {
    const setting = record as PlatformSetting
    params.set('category', setting.category)
    params.set('isEditable', String(setting.isEditable))
    params.set('search', setting.settingKey)
  }

  if (recordType === 'categories') {
    const category = record as ServiceCategory
    params.set('isActive', String(category.isActive))
    params.set('search', category.categoryCode)
  }

  if (recordType === 'zones') {
    const zone = record as ServiceZone
    params.set('city', zone.city)
    params.set('isActive', String(zone.isActive))
    params.set('search', zone.zoneName)
  }

  return `${routePaths.settings}?${params.toString()}#settings-records`
}

function buildSettingsRecordAuditPath(recordType: SettingsRecordType, record: RecordType) {
  const params = new URLSearchParams({
    moduleCode: 'settings',
    entityType:
      recordType === 'settings'
        ? 'platform_setting'
        : recordType === 'categories'
          ? 'service_category'
          : 'service_zone',
    entityId:
      recordType === 'settings'
        ? (record as PlatformSetting).settingId
        : recordType === 'categories'
          ? (record as ServiceCategory).categoryId
          : (record as ServiceZone).zoneId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function buildServiceTypeAuditPath(serviceType: ServiceType) {
  const params = new URLSearchParams({
    moduleCode: 'settings',
    entityType: 'service_type',
    entityId: serviceType.serviceTypeId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function buildScopedPolicyRulesPath(scopeType: 'CATEGORY' | 'ZONE') {
  const params = new URLSearchParams({
    type: 'policies',
    scopeType,
  })

  return `${routePaths.settings}?${params.toString()}#settings-policy-rules`
}

function buildCategoryOrdersPath(category: ServiceCategory) {
  return buildPathWithQueryParams(routePaths.orders, {
    categoryId: category.categoryId,
    categoryLabel: category.name,
  })
}

function buildCategoryVendorsPath(category: ServiceCategory) {
  return buildPathWithQueryParams(routePaths.vendors, {
    categoryId: category.categoryId,
    categoryLabel: category.name,
  })
}

function buildCategoryReelsPath(category: ServiceCategory) {
  return buildPathWithQueryParams(routePaths.reels, {
    categoryId: category.categoryId,
    categoryLabel: category.name,
  })
}

function buildZoneOrdersPath(zone: ServiceZone) {
  return buildPathWithQueryParams(routePaths.orders, {
    city: zone.city,
  })
}

function buildZoneVendorsPath(zone: ServiceZone) {
  return buildPathWithQueryParams(routePaths.vendors, {
    city: zone.city,
  })
}

function RelatedRecordsPanel({
  canUpdateSettings,
  canReadAudit,
  canReadOrders,
  canReadReels,
  canReadVendors,
  onNavigate,
  onOpenSection,
  onSelectAction,
  record,
  recordType,
  serviceTypesQuery,
}: {
  canUpdateSettings: boolean
  canReadAudit: boolean
  canReadOrders: boolean
  canReadReels: boolean
  canReadVendors: boolean
  onNavigate: (path: string) => void
  onOpenSection: (sectionId: SettingsDetailSectionId) => void
  onSelectAction: (action: SettingsActionSelection) => void
  record: RecordType
  recordType: SettingsRecordType
  serviceTypesQuery: UseQueryResult<ServiceTypesListResponse, Error>
}) {
  const canEditRecord = canEditSettingsRecord({
    canUpdateSettings,
    record,
    recordType,
  })

  if (recordType === 'settings') {
    const setting = record as PlatformSetting

    return (
      <SectionShell
        description="Places that help verify or audit this platform setting."
        icon={<ArrowUpRight className="size-4" />}
        title="Related records"
      >
        <div className="divide-y divide-border">
          <RelatedRecordRow
            actionLabel="Console"
            canOpen
            icon={<Settings2 className="size-4" />}
            label="Settings console"
            meta={humanizeCode(setting.category)}
            value={setting.settingKey}
            onOpen={() => onNavigate(buildSettingsConsolePath(recordType, record))}
          />
          <RelatedRecordRow
            actionLabel="Edit"
            canOpen={canEditRecord}
            icon={<Edit3 className="size-4" />}
            label="Editable record"
            meta={setting.isEditable ? 'Backend permits updates' : 'Locked by backend'}
            value={setting.isEditable ? 'Editable' : 'Locked'}
            onOpen={() =>
              onSelectAction({
                type: 'settings',
                action: 'UPDATE',
                record: setting,
              })
            }
          />
          <RelatedRecordRow
            actionLabel="Value"
            canOpen
            icon={<FileJson className="size-4" />}
            label="Current value"
            meta={humanizeCode(setting.valueType)}
            value={setting.isValueMasked ? 'Masked value' : 'Stored setting value'}
            onOpen={() => onOpenSection(settingsDetailSectionIds.currentValue)}
          />
          <RelatedRecordRow
            actionLabel="Lifecycle"
            canOpen
            icon={<CalendarClock className="size-4" />}
            label="Lifecycle"
            meta={`Updated ${formatDateSafe(setting.updatedAt)}`}
            value={setting.updatedByAdminId ?? 'System'}
            onOpen={() => onOpenSection(settingsDetailSectionIds.lifecycle)}
          />
          <RelatedRecordRow
            actionLabel="Audit"
            canOpen={canReadAudit}
            icon={<ClipboardList className="size-4" />}
            label="Audit trail"
            meta="Filtered by module, entity type, and setting id"
            value={setting.settingId}
            onOpen={() => onNavigate(buildSettingsRecordAuditPath(recordType, record))}
          />
        </div>
      </SectionShell>
    )
  }

  if (recordType === 'categories') {
    const category = record as ServiceCategory
    const summary = serviceTypesQuery.data?.summary
    const serviceTypeValue = serviceTypesQuery.isLoading
      ? 'Loading service types'
      : summary
        ? `${summary.total} service types`
        : 'Service types unavailable'
    const serviceTypeMeta = summary
      ? `${summary.active} active · ${summary.vendorServiceCount} vendor service links`
      : 'Category-owned child catalogue'

    return (
      <SectionShell
        description="Operational areas connected to this service category."
        icon={<ArrowUpRight className="size-4" />}
        title="Related records"
      >
        <div className="divide-y divide-border">
          <RelatedRecordRow
            actionLabel="Console"
            canOpen
            icon={<Settings2 className="size-4" />}
            label="Settings console"
            meta={category.categoryCode}
            value={category.name}
            onOpen={() => onNavigate(buildSettingsConsolePath(recordType, record))}
          />
          <RelatedRecordRow
            actionLabel="Edit"
            canOpen={canEditRecord}
            icon={<Edit3 className="size-4" />}
            label="Editable category"
            meta="Display, booking template, ordering, and status"
            value={category.isActive ? 'Active category' : 'Inactive category'}
            onOpen={() =>
              onSelectAction({
                type: 'categories',
                action: 'EDIT',
                record: category,
              })
            }
          />
          <RelatedRecordRow
            actionLabel="Types"
            canOpen
            icon={<ListChecks className="size-4" />}
            label="Child service types"
            meta={serviceTypeMeta}
            value={serviceTypeValue}
            onOpen={() => onOpenSection(settingsDetailSectionIds.serviceTypes)}
          />
          <RelatedRecordRow
            actionLabel="Template"
            canOpen
            icon={<FileJson className="size-4" />}
            label="Booking template"
            meta={category.bookingTemplate?.defaultPricingMode ?? 'No pricing mode'}
            value={category.bookingTemplate?.quoteMode ?? 'No quote mode'}
            onOpen={() => onOpenSection(settingsDetailSectionIds.bookingTemplate)}
          />
          <RelatedRecordRow
            actionLabel="Policies"
            canOpen
            icon={<ShieldAlert className="size-4" />}
            label="Scoped policy rules"
            meta="Category-scoped policies"
            value={category.categoryId}
            onOpen={() => onNavigate(buildScopedPolicyRulesPath('CATEGORY'))}
          />
          <RelatedRecordRow
            actionLabel="Vendors"
            canOpen={canReadVendors}
            icon={<Store className="size-4" />}
            label="Vendor catalogue"
            meta="Vendor services use category and service type mappings"
            value={category.name}
            onOpen={() => onNavigate(buildCategoryVendorsPath(category))}
          />
          <RelatedRecordRow
            actionLabel="Orders"
            canOpen={canReadOrders}
            icon={<ReceiptText className="size-4" />}
            label="Orders"
            meta="Orders can be filtered by this service category"
            value={category.name}
            onOpen={() => onNavigate(buildCategoryOrdersPath(category))}
          />
          <RelatedRecordRow
            actionLabel="Reels"
            canOpen={canReadReels}
            icon={<Film className="size-4" />}
            label="Reel tagging"
            meta="Approved reels can be associated with service categories"
            value={category.name}
            onOpen={() => onNavigate(buildCategoryReelsPath(category))}
          />
          <RelatedRecordRow
            actionLabel="Audit"
            canOpen={canReadAudit}
            icon={<ClipboardList className="size-4" />}
            label="Audit trail"
            meta="Filtered by module, entity type, and category id"
            value={category.categoryId}
            onOpen={() => onNavigate(buildSettingsRecordAuditPath(recordType, record))}
          />
        </div>
      </SectionShell>
    )
  }

  const zone = record as ServiceZone

  return (
    <SectionShell
      description="Operational records that commonly depend on serviceable zones."
      icon={<ArrowUpRight className="size-4" />}
      title="Related records"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          actionLabel="Console"
          canOpen
          icon={<Settings2 className="size-4" />}
          label="Settings console"
          meta={zone.city}
          value={zone.zoneName}
          onOpen={() => onNavigate(buildSettingsConsolePath(recordType, record))}
        />
        <RelatedRecordRow
          actionLabel="Edit"
          canOpen={canEditRecord}
          icon={<Edit3 className="size-4" />}
          label="Editable zone"
          meta="City, name, pincodes, status, and metadata"
          value={zone.isActive ? 'Active zone' : 'Inactive zone'}
          onOpen={() =>
            onSelectAction({
              type: 'zones',
              action: 'EDIT',
              record: zone,
            })
          }
        />
        <RelatedRecordRow
          actionLabel="Coverage"
          canOpen
          icon={<MapPinned className="size-4" />}
          label="Pincode coverage"
          meta={zone.city}
          value={`${zone.pincodeList.length} configured pincodes`}
          onOpen={() => onOpenSection(settingsDetailSectionIds.zoneCoverage)}
        />
        <RelatedRecordRow
          actionLabel="Policies"
          canOpen
          icon={<ShieldAlert className="size-4" />}
          label="Scoped policy rules"
          meta="Zone-scoped policies"
          value={zone.zoneId}
          onOpen={() => onNavigate(buildScopedPolicyRulesPath('ZONE'))}
        />
        <RelatedRecordRow
          actionLabel="Vendors"
          canOpen={canReadVendors}
          icon={<Store className="size-4" />}
          label="Vendors"
          meta="Vendor onboarding and service coverage use zones"
          value={zone.city}
          onOpen={() => onNavigate(buildZoneVendorsPath(zone))}
        />
        <RelatedRecordRow
          actionLabel="Orders"
          canOpen={canReadOrders}
          icon={<ReceiptText className="size-4" />}
          label="Orders"
          meta="Orders can be reviewed by service city and delivery coverage"
          value={`${zone.pincodeList.length} configured pincodes`}
          onOpen={() => onNavigate(buildZoneOrdersPath(zone))}
        />
        <RelatedRecordRow
          actionLabel="Audit"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Audit trail"
          meta="Filtered by module, entity type, and zone id"
          value={zone.zoneId}
          onOpen={() => onNavigate(buildSettingsRecordAuditPath(recordType, record))}
        />
      </div>
    </SectionShell>
  )
}

function OperationalSignalsPanel({
  canUpdateSettings,
  record,
  recordType,
}: {
  canUpdateSettings: boolean
  record: RecordType
  recordType: SettingsRecordType
}) {
  if (recordType === 'settings') {
    const setting = record as PlatformSetting
    const guardrails = [
      setting.isSensitive ? 'SENSITIVE' : 'STANDARD',
      setting.isValueMasked ? 'VALUE_MASKED' : 'VISIBLE_VALUE',
      setting.isEditable ? 'EDITABLE' : 'LOCKED',
    ]
    const permittedActions =
      canUpdateSettings && setting.isEditable ? ['UPDATE'] : []

    return (
      <SectionShell
        description="Backend guardrails and actions available to this admin."
        id={settingsDetailSectionIds.signals}
        icon={<TriangleAlert className="size-4" />}
        title="Signals"
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-muted">
              Guardrails
            </p>
            <SignalBadgeGroup
              emptyLabel="No guardrails"
              items={guardrails}
              tone={setting.isSensitive || !setting.isEditable ? 'warning' : 'neutral'}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-muted">
              Available to you
            </p>
            <SignalBadgeGroup
              emptyLabel="No permitted actions"
              items={permittedActions}
              tone="neutral"
            />
          </div>
          <Field
            label="Mutation permission"
            value={canUpdateSettings ? 'Granted' : 'Not granted'}
          />
        </div>
      </SectionShell>
    )
  }

  const catalogueRecord = record as ServiceCategory | ServiceZone
  const permittedActions = catalogueRecord.availableActions.filter((action) =>
    canRunCatalogueAction({
      action: action as CatalogueAction,
      canUpdateSettings,
      record: catalogueRecord,
    }),
  )

  return (
    <SectionShell
      description="Backend catalogue signals and actions permitted for this admin."
      id={settingsDetailSectionIds.signals}
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
            items={catalogueRecord.warnings}
            tone="warning"
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Available to you
          </p>
          <SignalBadgeGroup
            emptyLabel="No permitted actions"
            items={permittedActions}
            tone="neutral"
          />
        </div>
        <Field
          label="Recommended next"
          value={humanizeCode(catalogueRecord.nextRecommendedAction)}
        />
      </div>
    </SectionShell>
  )
}

function LifecyclePanel({
  record,
  recordType,
}: {
  record: RecordType
  recordType: SettingsRecordType
}) {
  const fields: [string, ReactNode][] =
    recordType === 'settings'
      ? [
          ['Created', formatDateSafe(record.createdAt)],
          ['Updated', formatDateSafe(record.updatedAt)],
          ['Updated by', (record as PlatformSetting).updatedByAdminId ?? 'System'],
          ['Setting ID', (record as PlatformSetting).settingId],
        ]
      : recordType === 'categories'
        ? [
            ['Created', formatDateSafe(record.createdAt)],
            ['Updated', formatDateSafe(record.updatedAt)],
            ['Category ID', (record as ServiceCategory).categoryId],
            ['Category code', (record as ServiceCategory).categoryCode],
          ]
        : [
            ['Created', formatDateSafe(record.createdAt)],
            ['Updated', formatDateSafe(record.updatedAt)],
            ['Zone ID', (record as ServiceZone).zoneId],
            ['Pincodes', String((record as ServiceZone).pincodeList.length)],
          ]

  return (
    <SectionShell
      description="Record identity and timestamps returned by the admin API."
      id={settingsDetailSectionIds.lifecycle}
      icon={<CalendarClock className="size-4" />}
      title="Lifecycle"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <Field key={label} label={label} value={value} />
        ))}
      </div>
    </SectionShell>
  )
}

function ServiceTypesPanel({
  canReadAudit,
  canUpdateSettings,
  category,
  onNavigate,
  onRetry,
  onSelect,
  query,
}: {
  canReadAudit: boolean
  canUpdateSettings: boolean
  category: ServiceCategory
  onNavigate: (path: string) => void
  onRetry: () => void
  onSelect: (action: SettingsActionSelection) => void
  query: UseQueryResult<ServiceTypesListResponse, Error>
}) {
  const serviceTypes = query.data?.data ?? []
  const summary = query.data?.summary
  const canCreate = canUpdateSettings

  return (
    <SectionShell
      actionNode={
        canCreate ? (
          <Button
            disabled={query.isFetching}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() =>
              onSelect({
                type: 'serviceTypes',
                action: 'CREATE',
                category,
              })
            }
          >
            <Plus className="mr-2 size-4" />
            Add type
          </Button>
        ) : null
      }
      description="Vendor-selectable child catalogue under this category."
      id={settingsDetailSectionIds.serviceTypes}
      icon={<ListChecks className="size-4" />}
      title="Service types"
    >
      {summary ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge tone="neutral">{summary.total} total</Badge>
          <Badge tone="success">{summary.active} active</Badge>
          <Badge tone={summary.inactive ? 'warning' : 'neutral'}>
            {summary.inactive} inactive
          </Badge>
          <Badge tone="info">
            {summary.vendorServiceCount} vendor links
          </Badge>
        </div>
      ) : null}

      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-[0.875rem]" />
          <Skeleton className="h-20 w-full rounded-[0.875rem]" />
        </div>
      ) : query.isError ? (
        <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3">
          <p className="text-sm font-semibold text-danger">
            Service types unavailable
          </p>
          <p className="mt-1 text-sm text-muted">
            The category loaded, but its child service types could not be fetched.
          </p>
          <Button className="mt-3" size="sm" type="button" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : serviceTypes.length ? (
        <div className="divide-y divide-border">
          {serviceTypes.map((serviceType) => {
            const statusAction: CatalogueAction = serviceType.isActive
              ? 'DEACTIVATE'
              : 'ACTIVATE'
            const canEdit = canRunCatalogueAction({
              action: 'EDIT',
              canUpdateSettings,
              record: serviceType,
            })
            const canChangeStatus = canRunCatalogueAction({
              action: statusAction,
              canUpdateSettings,
              record: serviceType,
            })

            return (
              <div
                className="grid gap-3 py-4 first:pt-0 last:pb-0 xl:grid-cols-[minmax(0,1fr)_18rem]"
                key={serviceType.serviceTypeId}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {serviceType.name}
                    </h3>
                    <Badge tone={serviceType.isActive ? 'success' : 'danger'}>
                      {serviceType.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {serviceType.warnings.length ? (
                      <Badge tone="warning">
                        {serviceType.warnings.length} warning
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs font-medium uppercase tracking-normal text-muted">
                    {serviceType.serviceTypeCode}
                  </p>
                  {serviceType.description ? (
                    <p className="mt-2 text-sm leading-5 text-muted">
                      {serviceType.description}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="neutral">
                      {serviceType.usage.vendorServiceCount} vendor links
                    </Badge>
                    <Badge tone="info">
                      {serviceType.usage.activeVendorServiceCount} active links
                    </Badge>
                    <Badge tone="neutral">
                      Order {serviceType.displayOrder}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-start justify-start gap-2 xl:justify-end">
                  {canEdit ? (
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        onSelect({
                          type: 'serviceTypes',
                          action: 'EDIT',
                          record: serviceType,
                        })
                      }
                    >
                      <Edit3 className="mr-2 size-4" />
                      Edit
                    </Button>
                  ) : null}
                  {canChangeStatus ? (
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        onSelect({
                          type: 'serviceTypes',
                          action: statusAction,
                          record: serviceType,
                        })
                      }
                    >
                      <Power className="mr-2 size-4" />
                      {serviceType.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  ) : null}
                  {canReadAudit ? (
                    <Button
                      size="sm"
                      title="Open service type audit history"
                      type="button"
                      variant="ghost"
                      onClick={() => onNavigate(buildServiceTypeAuditPath(serviceType))}
                    >
                      <ClipboardList className="mr-2 size-4" />
                      Audit
                    </Button>
                  ) : null}
                  {!canEdit && !canChangeStatus && !canReadAudit ? (
                    <Badge tone="neutral">View only</Badge>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="rounded-[0.75rem] border border-border bg-surface-muted/60 p-3 text-sm text-muted">
          No service types are configured for this category.
        </p>
      )}
    </SectionShell>
  )
}

function SettingSections({ setting }: { setting: PlatformSetting }) {
  return (
    <>
      <section
        className="scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface"
        id={settingsDetailSectionIds.settingProfile}
      >
        <h2 className="text-base font-semibold text-foreground">Setting Profile</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Setting key" value={setting.settingKey} />
          <Field label="Category" value={humanizeCode(setting.category)} />
          <Field label="Value type" value={humanizeCode(setting.valueType)} />
          <Field
            label="Sensitivity"
            value={setting.isSensitive ? 'Sensitive' : 'Standard'}
          />
          <Field
            label="Editable"
            value={setting.isEditable ? 'Editable' : 'Locked'}
          />
          <Field
            label="Masked"
            value={setting.isValueMasked ? 'Masked' : 'Visible'}
          />
          <Field
            label="Updated by"
            value={setting.updatedByAdminId ?? 'System'}
          />
          <Field label="Setting ID" value={setting.settingId} />
        </div>
        {setting.description ? (
          <p className="mt-4 rounded-[0.75rem] border border-border bg-surface-muted/60 p-3 text-sm leading-6 text-muted">
            {setting.description}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <JsonPanel
          id={settingsDetailSectionIds.currentValue}
          title="Current value"
          value={setting.value}
        />
        <JsonPanel
          id={settingsDetailSectionIds.defaultValue}
          title="Default value"
          value={setting.defaultValue}
        />
      </section>
    </>
  )
}

function CategorySections({ category }: { category: ServiceCategory }) {
  const template: CategoryBookingTemplate = category.bookingTemplate ?? {}

  return (
    <>
      <section
        className="scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface"
        id={settingsDetailSectionIds.categoryProfile}
      >
        <h2 className="text-base font-semibold text-foreground">Category Profile</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Category code" value={category.categoryCode} />
          <Field label="Category ID" value={category.categoryId} />
          <Field label="Display order" value={category.displayOrder} />
          <Field
            label="Next action"
            value={category.nextRecommendedAction ?? 'No next action'}
          />
          <Field
            label="Icon asset"
            value={category.iconAssetId ?? 'Not available'}
          />
          <Field
            label="Available actions"
            value={category.availableActions.length ? category.availableActions.join(', ') : 'None'}
          />
          <Field
            label="Warnings"
            value={category.warnings.length ? category.warnings.join(', ') : 'None'}
          />
          <Field
            label="Status"
            value={category.isActive ? 'Active' : 'Inactive'}
          />
        </div>
        {category.description ? (
          <p className="mt-4 rounded-[0.75rem] border border-border bg-surface-muted/60 p-3 text-sm leading-6 text-muted">
            {category.description}
          </p>
        ) : null}
      </section>

      <section
        className="scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface"
        id={settingsDetailSectionIds.bookingTemplate}
      >
        <h2 className="text-base font-semibold text-foreground">Booking Template</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field
            label="Template"
            value={template.isEnabled === false ? 'Disabled' : 'Enabled'}
          />
          <Field
            label="Service mode"
            value={template.multiServiceEnabled ? 'Multi-service' : 'Single service'}
          />
          <Field
            label="Pricing mode"
            value={template.defaultPricingMode ?? 'Not configured'}
          />
          <Field label="Quote mode" value={template.quoteMode ?? 'Instant'} />
          <Field
            label="Instant estimate"
            value={template.instantEstimateEnabled ? 'Enabled' : 'Disabled'}
          />
          <Field
            label="Price revision"
            value={template.priceRevisionEnabled ? 'Enabled' : 'Disabled'}
          />
          <Field
            label="Pricing units"
            value={(template.allowedPricingUnits ?? []).join(', ') || 'Not configured'}
          />
          <Field
            label="Pricing modes"
            value={(template.allowedPricingModes ?? []).join(', ') || 'Not configured'}
          />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <JsonPanel
          id={settingsDetailSectionIds.bookingFields}
          title="Fields"
          value={template.fields ?? []}
        />
        <JsonPanel title="Item templates" value={template.itemTemplates ?? []} />
        <JsonPanel title="Add-on templates" value={template.addOnTemplates ?? []} />
      </section>
      <JsonPanel
        id={settingsDetailSectionIds.bookingWorkflow}
        title="Workflow"
        value={template.workflow ?? {}}
      />
    </>
  )
}

function ZoneSections({ zone }: { zone: ServiceZone }) {
  return (
    <>
      <section
        className="scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface"
        id={settingsDetailSectionIds.zoneProfile}
      >
        <h2 className="text-base font-semibold text-foreground">Zone Profile</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Zone ID" value={zone.zoneId} />
          <Field label="City" value={zone.city} />
          <Field label="Zone name" value={zone.zoneName} />
          <Field label="Status" value={zone.isActive ? 'Active' : 'Inactive'} />
          <Field
            label="Warnings"
            value={zone.warnings.length ? zone.warnings.join(', ') : 'None'}
          />
          <Field
            label="Available actions"
            value={zone.availableActions.length ? zone.availableActions.join(', ') : 'None'}
          />
          <Field
            label="Next action"
            value={zone.nextRecommendedAction ?? 'No next action'}
          />
          <Field label="Pincodes" value={zone.pincodeList.length} />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section
          className="scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface"
          id={settingsDetailSectionIds.zoneCoverage}
        >
          <h2 className="text-base font-semibold text-foreground">Pincode Coverage</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {zone.pincodeList.length ? (
              zone.pincodeList.map((pincode) => (
                <Badge key={pincode} tone="neutral">
                  {pincode}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted">No pincodes configured.</p>
            )}
          </div>
        </section>
        <JsonPanel
          id={settingsDetailSectionIds.zoneMetadata}
          title="Metadata"
          value={zone.metadata ?? {}}
        />
      </section>
    </>
  )
}

function DetailBody({
  record,
  recordType,
}: {
  record: RecordType
  recordType: SettingsRecordType
}) {
  if (recordType === 'settings') {
    return <SettingSections setting={record as PlatformSetting} />
  }

  if (recordType === 'categories') {
    return <CategorySections category={record as ServiceCategory} />
  }

  return <ZoneSections zone={record as ServiceZone} />
}

export function SettingsDetailPage() {
  const { recordId, type } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const recordType = isSettingsRecordType(type) ? type : null
  const [selectedAction, setSelectedAction] = useState<SettingsActionSelection | null>(null)
  const canUpdateSettings = usePermission('settings:update')
  const canReadAudit = usePermission('audit:read')
  const canReadOrders = usePermission('orders:read')
  const canReadReels = usePermission('reels:read')
  const canReadVendors = usePermission('vendors:read')

  const detailQuery = useQuery({
    enabled: Boolean(recordId && recordType),
    queryKey: ['settings-detail', recordType, recordId],
    queryFn: async () => {
      const decoded = decodeURIComponent(recordId as string)

      if (recordType === 'settings') {
        return (await settingsService.getSetting(decoded)).data
      }

      if (recordType === 'categories') {
        return (await settingsService.getCategory(decoded)).data
      }

      return (await settingsService.getZone(decoded)).data
    },
  })

  const record = detailQuery.data
  const serviceTypeCategoryId =
    recordType === 'categories' && record
      ? (record as ServiceCategory).categoryId
      : null
  const serviceTypesQuery = useQuery<ServiceTypesListResponse, Error>({
    enabled: Boolean(serviceTypeCategoryId),
    queryKey: ['settings-service-types', serviceTypeCategoryId],
    queryFn: () =>
      settingsService.getServiceTypes(serviceTypeCategoryId as string, {
        limit: 100,
      }),
  })

  const mutation = useMutation<SettingsMutationResponse, Error, SettingsActionFormValues>({
    mutationFn: (values: SettingsActionFormValues) => {
      if (!selectedAction) throw new Error('No action selected.')

      if (selectedAction.type === 'settings') {
        return settingsService.updateSetting(selectedAction.record.settingKey, {
          value: values.value,
          reason: values.reason,
        })
      }

      if (selectedAction.type === 'categories') {
        return settingsService.updateCategory(selectedAction.record.categoryId, values)
      }

      if (selectedAction.type === 'serviceTypes') {
        if (selectedAction.action === 'CREATE') {
          return settingsService.createServiceType(selectedAction.category.categoryId, {
            serviceTypeCode: values.serviceTypeCode ?? '',
            name: values.name ?? '',
            description: values.description ?? null,
            displayOrder: values.displayOrder ?? 0,
            isActive: values.isActive ?? true,
            metadata: values.metadata ?? {},
            reason: values.reason ?? '',
          })
        }

        return settingsService.updateServiceType(selectedAction.record.serviceTypeId, {
          name: values.name,
          description: values.description,
          displayOrder: values.displayOrder,
          isActive: values.isActive,
          metadata: values.metadata,
          reason: values.reason ?? '',
        })
      }

      if (selectedAction.action === 'CREATE') {
        throw new Error('Create zone is not available on detail.')
      }

      return settingsService.updateZone(selectedAction.record.zoneId, values)
    },
    onSuccess: () => {
      const action = selectedAction
      setSelectedAction(null)
      void queryClient.invalidateQueries({
        queryKey: ['settings-detail', recordType, recordId],
      })
      void queryClient.invalidateQueries({ queryKey: ['settings-console'] })

      if (action?.type === 'serviceTypes') {
        const categoryId =
          action.action === 'CREATE'
            ? action.category.categoryId
            : action.record.categoryId
        void queryClient.invalidateQueries({
          queryKey: ['settings-service-types', categoryId],
        })
      }
    },
  })

  if (!recordType) {
    return (
      <PageContainer>
        <ErrorState
          description="This settings detail route does not match a supported record type."
          title="Settings route unavailable"
        />
      </PageContainer>
    )
  }

  if (!recordId) {
    return (
      <PageContainer>
        <ErrorState
          description="The settings route is missing a record id."
          title="Record not found"
        />
      </PageContainer>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-24 w-full rounded-[1rem]" />
        <Skeleton className="h-[22rem] w-full rounded-[1rem]" />
      </PageContainer>
    )
  }

  if (detailQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load this settings record."
          title="Settings record unavailable"
          onRetry={() => void detailQuery.refetch()}
        />
      </PageContainer>
    )
  }

  if (!record) {
    return (
      <PageContainer>
        <EmptyState
          description="No matching settings record was returned by the backend."
          title="Settings record not found"
        />
      </PageContainer>
    )
  }

  const statusBadge =
    recordType === 'settings' ? (
      <Badge tone={(record as PlatformSetting).isEditable ? 'success' : 'neutral'}>
        {(record as PlatformSetting).isEditable ? 'Editable' : 'Locked'}
      </Badge>
    ) : (
      <Badge tone={(record as ServiceCategory | ServiceZone).isActive ? 'success' : 'danger'}>
        {(record as ServiceCategory | ServiceZone).isActive ? 'Active' : 'Inactive'}
      </Badge>
    )
  const secondaryBadge =
    recordType === 'settings' ? (
      <Badge tone={(record as PlatformSetting).isSensitive ? 'warning' : 'info'}>
        {(record as PlatformSetting).isSensitive
          ? 'Sensitive'
          : humanizeCode((record as PlatformSetting).valueType)}
      </Badge>
    ) : (
      <Badge
        tone={
          (record as ServiceCategory | ServiceZone).warnings.length ? 'warning' : 'success'
        }
      >
        {(record as ServiceCategory | ServiceZone).warnings.length
          ? 'Action needed'
          : 'Ready'}
      </Badge>
    )
  const actionNode = (
    <HeaderActions
      canUpdateSettings={canUpdateSettings}
      isSubmitting={mutation.isPending}
      record={record}
      recordType={recordType}
      onSelect={setSelectedAction}
    />
  )
  const openSection = (sectionId: SettingsDetailSectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <PageContainer className="!px-3 !py-4 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={actionNode}
        description={humanizeCode(recordType)}
        listHref={routePaths.settings}
        listLabel="Settings"
        recordName={recordName(recordType, record)}
        titleMetaNode={
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge}
            {secondaryBadge}
          </div>
        }
      />

      <section className="grid shrink-0 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<CheckCircle2 className="size-4 text-success" />}
          label="Status"
          meta={humanizeCode(recordType)}
          value={statusBadge}
        />
        <SummaryCard
          icon={<CalendarClock className="size-4 text-info" />}
          label="Updated"
          meta="Backend timestamp"
          value={formatDateSafe(record.updatedAt)}
        />
        <SummaryCard
          icon={<CalendarClock className="size-4 text-muted" />}
          label="Created"
          meta="Original record"
          value={formatDateSafe(record.createdAt)}
        />
        <SummaryCard
          icon={<ShieldAlert className="size-4 text-warning" />}
          label={recordType === 'settings' ? 'Guardrails' : 'Warnings'}
          meta="Current record"
          value={
            recordType === 'settings'
              ? (record as PlatformSetting).isSensitive
                ? 'Sensitive'
                : 'Standard'
              : (record as ServiceCategory | ServiceZone).warnings.length
          }
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <LifecyclePanel record={record} recordType={recordType} />
        <OperationalSignalsPanel
          canUpdateSettings={canUpdateSettings}
          record={record}
          recordType={recordType}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        {recordType === 'categories' ? (
          <ServiceTypesPanel
            canReadAudit={canReadAudit}
            canUpdateSettings={canUpdateSettings}
            category={record as ServiceCategory}
            onNavigate={navigate}
            query={serviceTypesQuery}
            onRetry={() => void serviceTypesQuery.refetch()}
            onSelect={setSelectedAction}
          />
        ) : (
          <DetailBody record={record} recordType={recordType} />
        )}
        <RelatedRecordsPanel
          canUpdateSettings={canUpdateSettings}
          canReadAudit={canReadAudit}
          canReadOrders={canReadOrders}
          canReadReels={canReadReels}
          canReadVendors={canReadVendors}
          record={record}
          recordType={recordType}
          serviceTypesQuery={serviceTypesQuery}
          onNavigate={navigate}
          onOpenSection={openSection}
          onSelectAction={setSelectedAction}
        />
      </section>

      {recordType === 'categories' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <DetailBody record={record} recordType={recordType} />
        </div>
      ) : null}

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
