import { type FormEvent, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { PlatformSetting, ServiceCategory, ServiceZone, SettingsRecordType } from '../types/settings.types'

export type SettingsActionSelection =
  | { type: 'settings'; action: 'UPDATE'; record: PlatformSetting }
  | { type: 'categories'; action: 'EDIT' | 'ACTIVATE' | 'DEACTIVATE'; record: ServiceCategory }
  | { type: 'zones'; action: 'CREATE'; record?: undefined }
  | { type: 'zones'; action: 'EDIT' | 'ACTIVATE' | 'DEACTIVATE'; record: ServiceZone }

export interface SettingsActionFormValues {
  value?: unknown
  name?: string
  description?: string | null
  iconAssetId?: string | null
  displayOrder?: number
  city?: string
  zoneName?: string
  pincodeList?: string[] | null
  isActive?: boolean
  metadata?: Record<string, unknown>
  reason?: string
}

interface SettingsActionModalProps {
  action: SettingsActionSelection | null
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: SettingsActionFormValues) => void
}

function title(action: SettingsActionSelection) {
  const typeLabel: Record<SettingsRecordType, string> = {
    settings: 'setting',
    categories: 'category',
    zones: 'zone',
  }
  return `${action.action.replace('_', ' ').toLowerCase()} ${typeLabel[action.type]}`
}

function parseValue(raw: string, valueType?: string): unknown {
  if (valueType === 'boolean') return raw === 'true'
  if (valueType === 'number' || valueType === 'integer') return Number(raw)
  if (valueType === 'json') return JSON.parse(raw)
  return raw
}

export function SettingsActionModal({ action, error, isSubmitting, onClose, onSubmit }: SettingsActionModalProps) {
  const [city, setCity] = useState(action?.type === 'zones' && action.record ? action.record.city : '')
  const [description, setDescription] = useState(action?.type === 'categories' && action.record.description ? action.record.description : '')
  const [displayOrder, setDisplayOrder] = useState(action?.type === 'categories' && action.record ? String(action.record.displayOrder) : '')
  const [formError, setFormError] = useState<string | null>(null)
  const [iconAssetId, setIconAssetId] = useState(action?.type === 'categories' && action.record.iconAssetId ? action.record.iconAssetId : '')
  const [name, setName] = useState(action?.type === 'categories' && action.record ? action.record.name : '')
  const [pincodeList, setPincodeList] = useState(action?.type === 'zones' && action.record ? action.record.pincodeList.join(', ') : '')
  const [reason, setReason] = useState('')
  const [settingValue, setSettingValue] = useState(action?.type === 'settings' ? JSON.stringify(action.record.value ?? '') : '')
  const [zoneName, setZoneName] = useState(action?.type === 'zones' && action.record ? action.record.zoneName : '')

  if (!action) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    try {
      if (action.type === 'settings') {
        onSubmit({ value: parseValue(settingValue, action.record.valueType.toLowerCase()), reason: reason.trim() || undefined })
        return
      }
      if (action.type === 'categories') {
        onSubmit({
          name: name || undefined,
          description: description || null,
          iconAssetId: iconAssetId || null,
          displayOrder: displayOrder ? Number(displayOrder) : undefined,
          isActive: action.action === 'ACTIVATE' ? true : action.action === 'DEACTIVATE' ? false : undefined,
          reason: reason.trim() || undefined,
        })
        return
      }
      onSubmit({
        city: city || undefined,
        zoneName: zoneName || undefined,
        pincodeList: pincodeList ? pincodeList.split(',').map((item) => item.trim()).filter(Boolean) : [],
        isActive: action.action === 'ACTIVATE' || action.action === 'CREATE' ? true : action.action === 'DEACTIVATE' ? false : undefined,
        reason: reason.trim() || undefined,
      })
    } catch {
      setFormError('Value must match the expected type.')
    }
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold capitalize tracking-[-0.03em] text-foreground">{title(action)}</h2>
          <button aria-label="Close action modal" className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground" disabled={isSubmitting} onClick={onClose} type="button"><X className="size-4" /></button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {action.type === 'settings' ? <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Value ({action.record.valueType})</span><textarea className="form-input min-h-24 resize-y" value={settingValue} onChange={(event) => setSettingValue(event.target.value)} /></label> : null}
          {action.type === 'categories' ? <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Name</span><input className="form-input" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Display order</span><input className="form-input" type="number" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} /></label><label className="block space-y-2 sm:col-span-2"><span className="text-sm font-semibold text-foreground">Description</span><textarea className="form-input min-h-20 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="block space-y-2 sm:col-span-2"><span className="text-sm font-semibold text-foreground">Icon asset ID</span><input className="form-input" value={iconAssetId} onChange={(event) => setIconAssetId(event.target.value)} /></label></div> : null}
          {action.type === 'zones' ? <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-2"><span className="text-sm font-semibold text-foreground">City</span><input className="form-input" value={city} onChange={(event) => setCity(event.target.value)} /></label><label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Zone name</span><input className="form-input" value={zoneName} onChange={(event) => setZoneName(event.target.value)} /></label><label className="block space-y-2 sm:col-span-2"><span className="text-sm font-semibold text-foreground">Pincodes</span><input className="form-input" placeholder="Comma separated" value={pincodeList} onChange={(event) => setPincodeList(event.target.value)} /></label></div> : null}
          <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Reason</span><textarea className="form-input min-h-20 resize-y" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          {formError || error ? <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{formError ?? error}</div> : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button disabled={isSubmitting} size="sm" type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button isLoading={isSubmitting} size="sm" type="submit">Submit</Button></div>
        </form>
      </div>
    </div>
  )
}
