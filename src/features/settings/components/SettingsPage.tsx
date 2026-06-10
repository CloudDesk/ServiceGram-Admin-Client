import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { DynamicTable, TableSkeleton, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { settingsService } from '../services/settings.service'
import { SettingsActionModal, type SettingsActionFormValues, type SettingsActionSelection } from './SettingsActionModal'
import type { PlatformSetting, ServiceCategory, ServiceZone, SettingsRecordType } from '../types/settings.types'
import type {
  PlatformSettingsListResponse,
  ServiceCategoriesListResponse,
  ServiceZonesListResponse,
} from '../types/settings.types'

type Row = PlatformSetting | ServiceCategory | ServiceZone
type SettingsListResponse =
  | PlatformSettingsListResponse
  | ServiceCategoriesListResponse
  | ServiceZonesListResponse

const settingColumns: DynamicTableColumn<PlatformSetting>[] = [
  { key: 'displayName', label: 'Setting', minWidth: 240, renderCell: (row) => <div><p className="font-semibold text-foreground">{row.displayName}</p><p className="text-xs text-muted">{row.settingKey}</p></div> },
  { key: 'category', label: 'Category', minWidth: 140 },
  { key: 'valueType', label: 'Type', minWidth: 100 },
  { key: 'isEditable', label: 'Editable', format: 'status', statusTone: (value) => value ? 'success' : 'neutral', renderCell: (row) => row.isEditable ? 'YES' : 'NO' },
  { key: 'updatedAt', label: 'Updated', format: 'date', minWidth: 180 },
]

const categoryColumns: DynamicTableColumn<ServiceCategory>[] = [
  { key: 'name', label: 'Category', minWidth: 220, renderCell: (row) => <div><p className="font-semibold text-foreground">{row.name}</p><p className="text-xs text-muted">{row.categoryCode}</p></div> },
  { key: 'isActive', label: 'Status', format: 'status', statusTone: (value) => value ? 'success' : 'danger', renderCell: (row) => row.isActive ? 'ACTIVE' : 'INACTIVE' },
  { key: 'displayOrder', label: 'Order', align: 'right' },
  { key: 'updatedAt', label: 'Updated', format: 'date', minWidth: 180 },
]

const zoneColumns: DynamicTableColumn<ServiceZone>[] = [
  { key: 'zoneName', label: 'Zone', minWidth: 220, renderCell: (row) => <div><p className="font-semibold text-foreground">{row.zoneName}</p><p className="text-xs text-muted">{row.zoneId}</p></div> },
  { key: 'city', label: 'City', minWidth: 160 },
  { key: 'isActive', label: 'Status', format: 'status', statusTone: (value) => value ? 'success' : 'danger', renderCell: (row) => row.isActive ? 'ACTIVE' : 'INACTIVE' },
  { key: 'pincodeList', label: 'Pincodes', renderCell: (row) => row.pincodeList.length },
  { key: 'updatedAt', label: 'Updated', format: 'date', minWidth: 180 },
]

function getRowId(type: SettingsRecordType, row: Row) {
  if (type === 'settings') return (row as PlatformSetting).settingKey
  if (type === 'categories') return (row as ServiceCategory).categoryId
  return (row as ServiceZone).zoneId
}

export function SettingsPage() {
  const navigate = useNavigate()
  const [type, setType] = useState<SettingsRecordType>('settings')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [isEditable, setIsEditable] = useState('')
  const [isActive, setIsActive] = useState('')
  const [selectedAction, setSelectedAction] = useState<SettingsActionSelection | null>(null)

  const query = useMemo(() => ({
    page,
    limit,
    search: search.trim() || undefined,
    category: category.trim() || undefined,
    city: city.trim() || undefined,
    isEditable: isEditable === '' ? undefined : isEditable === 'true',
    isActive: isActive === '' ? undefined : isActive === 'true',
  }), [category, city, isActive, isEditable, limit, page, search])

  const result = useQuery<SettingsListResponse>({
    queryKey: ['settings-console', type, query],
    queryFn: () => {
      if (type === 'settings') return settingsService.getSettings(query)
      if (type === 'categories') return settingsService.getCategories(query)
      return settingsService.getZones(query)
    },
  })

  const mutation = useMutation({
    mutationFn: (values: SettingsActionFormValues) => {
      if (!selectedAction) throw new Error('No action selected.')
      if (selectedAction.type === 'zones' && selectedAction.action === 'CREATE') {
        if (!values.city || !values.zoneName) throw new Error('City and zone name are required.')
        return settingsService.createZone({ city: values.city, zoneName: values.zoneName, pincodeList: values.pincodeList, isActive: values.isActive, reason: values.reason })
      }
      throw new Error('Unsupported list action.')
    },
    onSuccess: () => {
      setSelectedAction(null)
      void result.refetch()
    },
  })

  const rows = (result.data?.data ?? []) as Row[]
  const pagination = result.data?.pagination
  const columns = type === 'settings' ? settingColumns : type === 'categories' ? categoryColumns : zoneColumns
  const isLoading = result.isLoading || result.isFetching

  return (
    <PageContainer>
      <PageContextHeader title="Settings" description="Manage platform settings, categories, and service zones." actionNode={type === 'zones' ? <Button size="sm" onClick={() => setSelectedAction({ type: 'zones', action: 'CREATE' })}><Plus className="mr-2 size-4" />Create Zone</Button> : null} />
      <section className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {(['settings', 'categories', 'zones'] as SettingsRecordType[]).map((item) => <Button key={item} size="sm" variant={type === item ? 'primary' : 'secondary'} onClick={() => { setType(item); setPage(1) }}>{item}</Button>)}
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <label className="space-y-1"><span className="text-sm font-medium text-foreground">Search</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div></label>
          {type === 'settings' ? <><label className="space-y-1"><span className="text-sm font-medium text-foreground">Category</span><Input value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }} /></label><label className="space-y-1"><span className="text-sm font-medium text-foreground">Editable</span><select className="form-input" value={isEditable} onChange={(event) => { setIsEditable(event.target.value); setPage(1) }}><option value="">All</option><option value="true">Editable</option><option value="false">Locked</option></select></label></> : null}
          {type === 'zones' ? <label className="space-y-1"><span className="text-sm font-medium text-foreground">City</span><Input value={city} onChange={(event) => { setCity(event.target.value); setPage(1) }} /></label> : null}
          {type !== 'settings' ? <label className="space-y-1"><span className="text-sm font-medium text-foreground">Active</span><select className="form-input" value={isActive} onChange={(event) => { setIsActive(event.target.value); setPage(1) }}><option value="">All</option><option value="true">Active</option><option value="false">Inactive</option></select></label> : null}
        </div>
        {result.isError ? <ErrorState title="Settings unavailable" description="We could not load settings data." onRetry={() => void result.refetch()} /> : isLoading ? <TableSkeleton columns={columns as DynamicTableColumn<unknown>[]} hasFooter={Boolean(pagination)} rowCount={8} /> : rows.length === 0 ? <EmptyState title="No records found" description="No settings records matched the current filters." /> : <DynamicTable columns={columns as DynamicTableColumn<Row>[]} data={rows} getRowId={(row) => getRowId(type, row)} title={type} onRowClick={(row) => navigate(`${routePaths.settings}/${type}/${encodeURIComponent(getRowId(type, row))}`)} pagination={pagination ? { page: pagination.page, pageSize: pagination.limit, total: pagination.totalItems, onPageChange: setPage, onPageSizeChange: (next) => { setLimit(next); setPage(1) }, rowsPerPageOptions: [10, 20, 50, 100] } : undefined} />}
      </section>
      <SettingsActionModal action={selectedAction} error={mutation.error instanceof Error ? mutation.error.message : null} isSubmitting={mutation.isPending} onClose={() => setSelectedAction(null)} onSubmit={(values) => mutation.mutate(values)} />
    </PageContainer>
  )
}
