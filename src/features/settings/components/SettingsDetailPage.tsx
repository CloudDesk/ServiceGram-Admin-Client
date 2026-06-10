import { Edit3, Power } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { settingsService } from '../services/settings.service'
import { SettingsActionModal, type SettingsActionFormValues, type SettingsActionSelection } from './SettingsActionModal'
import type { PlatformSetting, ServiceCategory, ServiceZone, SettingsRecordType } from '../types/settings.types'
import type {
  UpdateCategoryResponse,
  UpdateSettingResponse,
  UpdateZoneResponse,
} from '../types/settings.types'

type RecordType = PlatformSetting | ServiceCategory | ServiceZone
type SettingsMutationResponse =
  | UpdateSettingResponse
  | UpdateCategoryResponse
  | UpdateZoneResponse

function Field({ label, value }: { label: string; value: unknown }) {
  return <div className="space-y-1"><p className="text-xs font-semibold uppercase text-muted">{label}</p><p className="break-words text-sm text-foreground">{value == null || value === '' ? 'Not available' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</p></div>
}

function recordName(type: SettingsRecordType, record: RecordType) {
  if (type === 'settings') return (record as PlatformSetting).displayName
  if (type === 'categories') return (record as ServiceCategory).name
  return (record as ServiceZone).zoneName
}

export function SettingsDetailPage() {
  const { recordId, type } = useParams()
  const queryClient = useQueryClient()
  const recordType = (type ?? 'settings') as SettingsRecordType
  const [selectedAction, setSelectedAction] = useState<SettingsActionSelection | null>(null)

  const detailQuery = useQuery({
    enabled: Boolean(recordId),
    queryKey: ['settings-detail', recordType, recordId],
    queryFn: async () => {
      const decoded = decodeURIComponent(recordId as string)
      if (recordType === 'settings') {
        const response = await settingsService.getSettings({ search: decoded, limit: 100 })
        return response.data.find((item) => item.settingKey === decoded) ?? null
      }
      if (recordType === 'categories') {
        const response = await settingsService.getCategories({ limit: 100 })
        return response.data.find((item) => item.categoryId === decoded) ?? null
      }
      const response = await settingsService.getZones({ limit: 100 })
      return response.data.find((item) => item.zoneId === decoded) ?? null
    },
  })

  const record = detailQuery.data

  const mutation = useMutation<SettingsMutationResponse, Error, SettingsActionFormValues>({
    mutationFn: (values: SettingsActionFormValues) => {
      if (!selectedAction) throw new Error('No action selected.')
      if (selectedAction.type === 'settings') return settingsService.updateSetting(selectedAction.record.settingKey, { value: values.value, reason: values.reason })
      if (selectedAction.type === 'categories') return settingsService.updateCategory(selectedAction.record.categoryId, values)
      if (selectedAction.action === 'CREATE') throw new Error('Create zone is not available on detail.')
      return settingsService.updateZone(selectedAction.record.zoneId, values)
    },
    onSuccess: () => {
      setSelectedAction(null)
      void queryClient.invalidateQueries({ queryKey: ['settings-detail', recordType, recordId] })
      void queryClient.invalidateQueries({ queryKey: ['settings-console'] })
    },
  })

  if (!recordId) return <PageContainer><ErrorState title="Record not found" description="The settings route is missing a record id." /></PageContainer>
  if (detailQuery.isLoading) return <PageContainer><Skeleton className="h-24 w-full" /><Skeleton className="h-[20rem] w-full" /></PageContainer>
  if (detailQuery.isError) return <PageContainer><ErrorState title="Settings record unavailable" description="We could not load this settings record." onRetry={() => void detailQuery.refetch()} /></PageContainer>
  if (!record) return <PageContainer><EmptyState title="Settings record not found" description="No matching settings record was returned by the backend list API." /></PageContainer>

  const actionNode = recordType === 'settings'
    ? <Button disabled={!(record as PlatformSetting).isEditable} size="sm" onClick={() => setSelectedAction({ type: 'settings', action: 'UPDATE', record: record as PlatformSetting })}><Edit3 className="mr-2 size-4" />Update</Button>
    : recordType === 'categories'
      ? <><Button size="sm" onClick={() => setSelectedAction({ type: 'categories', action: 'EDIT', record: record as ServiceCategory })}><Edit3 className="mr-2 size-4" />Edit</Button><Button size="sm" variant="secondary" onClick={() => setSelectedAction({ type: 'categories', action: (record as ServiceCategory).isActive ? 'DEACTIVATE' : 'ACTIVATE', record: record as ServiceCategory })}><Power className="mr-2 size-4" />{(record as ServiceCategory).isActive ? 'Deactivate' : 'Activate'}</Button></>
      : <><Button size="sm" onClick={() => setSelectedAction({ type: 'zones', action: 'EDIT', record: record as ServiceZone })}><Edit3 className="mr-2 size-4" />Edit</Button><Button size="sm" variant="secondary" onClick={() => setSelectedAction({ type: 'zones', action: (record as ServiceZone).isActive ? 'DEACTIVATE' : 'ACTIVATE', record: record as ServiceZone })}><Power className="mr-2 size-4" />{(record as ServiceZone).isActive ? 'Deactivate' : 'Activate'}</Button></>

  return (
    <PageContainer>
      <DetailPageHeader actionNode={<div className="flex flex-wrap gap-2">{actionNode}</div>} description={recordType} listHref={routePaths.settings} listLabel="Settings" recordName={recordName(recordType, record)} titleMetaNode={<Badge tone={(record as ServiceCategory | ServiceZone).isActive === false ? 'danger' : 'success'}>{recordType === 'settings' ? ((record as PlatformSetting).isEditable ? 'EDITABLE' : 'LOCKED') : ((record as ServiceCategory | ServiceZone).isActive ? 'ACTIVE' : 'INACTIVE')}</Badge>} />
      <section className="rounded-[1rem] border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Object.entries(record).map(([key, value]) => <Field key={key} label={key} value={value} />)}
        </div>
      </section>
      <SettingsActionModal action={selectedAction} error={mutation.error instanceof Error ? mutation.error.message : null} isSubmitting={mutation.isPending} onClose={() => setSelectedAction(null)} onSubmit={(values) => mutation.mutate(values)} />
    </PageContainer>
  )
}
