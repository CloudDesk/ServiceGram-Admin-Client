import type { ReactNode } from 'react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  Edit3,
  FileJson,
  Power,
  ShieldAlert,
} from 'lucide-react'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
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
  CategoryBookingTemplate,
  PlatformSetting,
  ServiceCategory,
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

function JsonPanel({
  className,
  title,
  value,
}: {
  className?: string
  title: string
  value: unknown
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface',
        className,
      )}
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

function SettingSections({ setting }: { setting: PlatformSetting }) {
  return (
    <>
      <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
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
        <JsonPanel title="Current value" value={setting.value} />
        <JsonPanel title="Default value" value={setting.defaultValue} />
      </section>
    </>
  )
}

function CategorySections({ category }: { category: ServiceCategory }) {
  const template: CategoryBookingTemplate = category.bookingTemplate ?? {}

  return (
    <>
      <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
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

      <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
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
        <JsonPanel title="Fields" value={template.fields ?? []} />
        <JsonPanel title="Item templates" value={template.itemTemplates ?? []} />
        <JsonPanel title="Add-on templates" value={template.addOnTemplates ?? []} />
      </section>
      <JsonPanel title="Workflow" value={template.workflow ?? {}} />
    </>
  )
}

function ZoneSections({ zone }: { zone: ServiceZone }) {
  return (
    <>
      <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
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
        <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
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
        <JsonPanel title="Metadata" value={zone.metadata ?? {}} />
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
  const queryClient = useQueryClient()
  const recordType = isSettingsRecordType(type) ? type : null
  const [selectedAction, setSelectedAction] = useState<SettingsActionSelection | null>(null)

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

      if (selectedAction.action === 'CREATE') {
        throw new Error('Create zone is not available on detail.')
      }

      return settingsService.updateZone(selectedAction.record.zoneId, values)
    },
    onSuccess: () => {
      setSelectedAction(null)
      void queryClient.invalidateQueries({
        queryKey: ['settings-detail', recordType, recordId],
      })
      void queryClient.invalidateQueries({ queryKey: ['settings-console'] })
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

  const actionNode =
    recordType === 'settings' ? (
      <Button
        disabled={!(record as PlatformSetting).isEditable}
        size="sm"
        variant="secondary"
        onClick={() =>
          setSelectedAction({
            type: 'settings',
            action: 'UPDATE',
            record: record as PlatformSetting,
          })
        }
      >
        <Edit3 className="mr-2 size-4" />
        Update
      </Button>
    ) : recordType === 'categories' ? (
      <>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setSelectedAction({
              type: 'categories',
              action: 'EDIT',
              record: record as ServiceCategory,
            })
          }
        >
          <Edit3 className="mr-2 size-4" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setSelectedAction({
              type: 'categories',
              action: (record as ServiceCategory).isActive ? 'DEACTIVATE' : 'ACTIVATE',
              record: record as ServiceCategory,
            })
          }
        >
          <Power className="mr-2 size-4" />
          {(record as ServiceCategory).isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </>
    ) : (
      <>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setSelectedAction({
              type: 'zones',
              action: 'EDIT',
              record: record as ServiceZone,
            })
          }
        >
          <Edit3 className="mr-2 size-4" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setSelectedAction({
              type: 'zones',
              action: (record as ServiceZone).isActive ? 'DEACTIVATE' : 'ACTIVATE',
              record: record as ServiceZone,
            })
          }
        >
          <Power className="mr-2 size-4" />
          {(record as ServiceZone).isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </>
    )

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={<div className="flex flex-wrap gap-2">{actionNode}</div>}
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
          value={formatDate(record.updatedAt, true)}
        />
        <SummaryCard
          icon={<CalendarClock className="size-4 text-muted" />}
          label="Created"
          meta="Original record"
          value={formatDate(record.createdAt, true)}
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

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <DetailBody record={record} recordType={recordType} />
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
