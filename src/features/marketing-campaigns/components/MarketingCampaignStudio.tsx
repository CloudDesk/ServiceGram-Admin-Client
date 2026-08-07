import {
  Archive,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Globe,
  ImageIcon,
  Layers,
  MapPin,
  Megaphone,
  PauseCircle,
  RefreshCcw,
  Send,
  Smartphone,
  Sparkles,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import { routePaths } from '../../../config/routes'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import {
  searchCategoryCodeLookupOptions,
  searchVendorLookupOptions,
} from '../../lookups/adminLookups'
import { marketingCampaignService } from '../services/marketingCampaign.service'
import type {
  MarketingCampaign,
  MarketingCampaignActiveOrderRule,
  MarketingCampaignCtaActionType,
  MarketingCampaignPayload,
  MarketingCampaignStatus,
} from '../types/marketingCampaign.types'

type NewUserRule = 'ANY' | 'NEW_USERS_ONLY' | 'RETURNING_USERS_ONLY'
type StudioTab = 'creative' | 'audience' | 'schedule'

const CTA_ACTION_TYPES: MarketingCampaignCtaActionType[] = [
  'NONE', 'SERVICE_CATEGORY', 'VENDOR', 'ORDERS', 'PROFILE', 'SUPPORT', 'EXTERNAL_LINK',
]

interface CampaignFormState {
  body: string
  campaignCode: string
  cityList: string
  ctaActionPayload: string
  ctaActionType: MarketingCampaignCtaActionType
  ctaLabel: string
  cooldownHoursAfterDismiss: string
  endsAt: string
  headline: string
  maxImpressionsPerCustomer: string
  maxImpressionsPerDay: string
  priority: string
  reason: string
  startsAt: string
  targetingActiveOrderRule: MarketingCampaignActiveOrderRule
  targetingNewUserRule: NewUserRule
  newUserWindowDays: string
  title: string
}

interface ImageDimensions {
  height: number
  objectUrl: string
  width: number
}

interface ActionConfirmState {
  action: 'archive' | 'pause' | 'publish'
  reason: string
}

function humanize(value: string) {
  return value.toLowerCase().split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

function statusTone(status?: MarketingCampaignStatus): StatusTone {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'SCHEDULED') return 'info'
  if (status === 'PAUSED') return 'warning'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

function toLocalInputValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return offsetDate.toISOString().slice(0, 16)
}

function fromLocalInputValue(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function splitCities(value: string) {
  return value.split(',').map((c) => c.trim()).filter(Boolean)
}

function parsePayloadJson(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('CTA payload must be a JSON object.')
  return parsed as Record<string, unknown>
}

function payloadText(value: Record<string, unknown> = {}) {
  return JSON.stringify(value, null, 2)
}

function readPayloadString(value: string, key: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    const raw = parsed[key]

    return typeof raw === 'string' ? raw : ''
  } catch {
    return ''
  }
}

function defaultPayloadForAction(actionType: MarketingCampaignCtaActionType) {
  if (actionType === 'EXTERNAL_LINK') return payloadText({ url: '' })

  return payloadText()
}

function buildCtaActionPayload(
  actionType: MarketingCampaignCtaActionType,
  value: string,
) {
  if (
    actionType === 'NONE' ||
    actionType === 'ORDERS' ||
    actionType === 'PROFILE' ||
    actionType === 'SUPPORT'
  ) {
    return {}
  }

  const payload = parsePayloadJson(value)

  if (actionType === 'SERVICE_CATEGORY') {
    const categoryCode =
      typeof payload.categoryCode === 'string'
        ? payload.categoryCode.trim()
        : ''

    if (!categoryCode) {
      throw new Error('Select a target category for this CTA.')
    }

    return { categoryCode }
  }

  if (actionType === 'VENDOR') {
    const vendorId =
      typeof payload.vendorId === 'string' ? payload.vendorId.trim() : ''

    if (!vendorId) {
      throw new Error('Select a target vendor for this CTA.')
    }

    return { vendorId }
  }

  if (actionType === 'EXTERNAL_LINK') {
    const url = typeof payload.url === 'string' ? payload.url.trim() : ''

    if (!url) {
      throw new Error('Enter an external URL for this CTA.')
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw new Error('Enter a valid external URL for this CTA.')
    }

    if (parsedUrl.protocol !== 'https:') {
      throw new Error('External URL must start with https://.')
    }

    return { url: parsedUrl.toString() }
  }

  return {}
}

function newCampaignForm(): CampaignFormState {
  const ts = Date.now()
  return {
    body: 'Book trusted nearby pros in a tap.',
    campaignCode: `home-popover-${ts}`,
    cityList: '',
    ctaActionPayload: '{\n  "categoryCode": "LAUNDRY"\n}',
    ctaActionType: 'SERVICE_CATEGORY',
    ctaLabel: 'Book now',
    cooldownHoursAfterDismiss: '24',
    endsAt: '',
    headline: 'Fresh service at your doorstep',
    maxImpressionsPerCustomer: '3',
    maxImpressionsPerDay: '1',
    priority: '100',
    reason: 'Create customer home marketing campaign.',
    startsAt: '',
    targetingActiveOrderRule: 'NO_ACTIVE_BOOKINGS',
    targetingNewUserRule: 'ANY',
    newUserWindowDays: '7',
    title: 'Customer Home Popover',
  }
}

function formFromCampaign(campaign: MarketingCampaign): CampaignFormState {
  return {
    body: campaign.body,
    campaignCode: campaign.campaignCode,
    cityList: campaign.targeting.cities?.join(', ') ?? '',
    ctaActionPayload: JSON.stringify(campaign.cta.actionPayload ?? {}, null, 2),
    ctaActionType: campaign.cta.actionType,
    ctaLabel: campaign.cta.label,
    cooldownHoursAfterDismiss: String(campaign.frequencyCap.cooldownHoursAfterDismiss ?? 24),
    endsAt: toLocalInputValue(campaign.schedule.endsAt),
    headline: campaign.headline,
    maxImpressionsPerCustomer: String(campaign.frequencyCap.maxImpressionsPerCustomer ?? 3),
    maxImpressionsPerDay: String(campaign.frequencyCap.maxImpressionsPerDay ?? 1),
    priority: String(campaign.priority),
    reason: 'Update marketing campaign configuration.',
    startsAt: toLocalInputValue(campaign.schedule.startsAt),
    targetingActiveOrderRule: campaign.targeting.activeOrderRule ?? 'NO_ACTIVE_BOOKINGS',
    targetingNewUserRule: (campaign.targeting.newUserRule ?? 'ANY') as NewUserRule,
    newUserWindowDays: String(campaign.targeting.newUserWindowDays ?? 7),
    title: campaign.title,
  }
}

function buildPayload(form: CampaignFormState): MarketingCampaignPayload {
  return {
    body: form.body.trim(),
    campaignCode: form.campaignCode.trim(),
    ctaActionPayload: buildCtaActionPayload(
      form.ctaActionType,
      form.ctaActionPayload,
    ),
    ctaActionType: form.ctaActionType,
    ctaLabel: form.ctaLabel.trim(),
    frequencyCap: {
      cooldownHoursAfterDismiss: Number(form.cooldownHoursAfterDismiss),
      maxImpressionsPerCustomer: Number(form.maxImpressionsPerCustomer),
      maxImpressionsPerDay: Number(form.maxImpressionsPerDay),
    },
    headline: form.headline.trim(),
    placement: 'CUSTOMER_HOME_POPOVER',
    priority: Number(form.priority),
    reason: form.reason.trim(),
    startsAt: fromLocalInputValue(form.startsAt),
    endsAt: fromLocalInputValue(form.endsAt),
    targeting: {
      activeOrderRule: form.targetingActiveOrderRule,
      newUserRule: form.targetingNewUserRule,
      newUserWindowDays: Number(form.newUserWindowDays),
      cities: splitCities(form.cityList),
    },
    theme: { accentColor: '#6B3FD1', surfaceStyle: 'premium-light' },
    title: form.title.trim(),
  }
}

function getImageDimensions(file: File) {
  return new Promise<ImageDimensions>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({ height: image.naturalHeight, objectUrl, width: image.naturalWidth })
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image dimensions.')) }
    image.src = objectUrl
  })
}

function assertHomePopoverImage(file: File, dimensions: ImageDimensions) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Campaign image must be JPEG, PNG, or WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Campaign image must be under 5 MB.')
  if (dimensions.width < 900 || dimensions.height < 1125) throw new Error('Campaign image must be at least 900x1125.')
  if (Math.abs(dimensions.width / dimensions.height - 0.8) > 0.025) throw new Error('Campaign image must use a 4:5 aspect ratio.')
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AudienceCard({
  active,
  description,
  icon: Icon,
  label,
  onClick,
  tone = 'default',
}: {
  active: boolean
  description: string
  icon: React.ElementType
  label: string
  onClick: () => void
  tone?: 'new' | 'returning' | 'any' | 'default'
}) {
  const toneClasses: Record<string, string> = {
    new: 'from-violet-500/10 to-purple-500/5 border-violet-400/40 text-violet-600',
    returning: 'from-blue-500/10 to-sky-500/5 border-blue-400/40 text-blue-600',
    any: 'from-emerald-500/10 to-teal-500/5 border-emerald-400/40 text-emerald-600',
    default: 'from-slate-100 to-slate-50 border-border text-muted',
  }

  return (
    <button
      className={cn(
        'flex w-full flex-col items-start gap-1.5 rounded-xl border bg-gradient-to-br p-3.5 text-left transition-all',
        active
          ? cn(toneClasses[tone], 'ring-2 ring-current/20 shadow-sm')
          : 'border-border bg-surface hover:border-primary/30 hover:shadow-sm',
      )}
      onClick={onClick}
      type="button"
    >
      <div className={cn('flex size-8 items-center justify-center rounded-lg', active ? 'bg-current/10' : 'bg-secondary')}>
        <Icon className={cn('size-4', active ? 'text-current' : 'text-muted')} />
      </div>
      <p className={cn('text-xs font-extrabold mt-1', active ? 'text-current' : 'text-foreground')}>{label}</p>
      <p className="text-[11px] leading-relaxed text-muted">{description}</p>
    </button>
  )
}

function FrequencyCapStepper({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string
  max: number
  min: number
  onChange: (v: string) => void
  value: string
}) {
  const num = Number(value)
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-center text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
        <button
          className="flex size-8 items-center justify-center rounded-lg bg-secondary text-foreground transition hover:bg-secondary-hover disabled:opacity-40"
          disabled={num <= min}
          onClick={() => onChange(String(Math.max(min, num - 1)))}
          type="button"
        >
          <ChevronDown className="size-4" />
        </button>
        <span className="w-10 text-center text-sm font-extrabold text-foreground">{num}</span>
        <button
          className="flex size-8 items-center justify-center rounded-lg bg-secondary text-foreground transition hover:bg-secondary-hover disabled:opacity-40"
          disabled={num >= max}
          onClick={() => onChange(String(Math.min(max, num + 1)))}
          type="button"
        >
          <ChevronUp className="size-4" />
        </button>
      </div>
    </div>
  )
}

function SmartCtaPayload({
  actionType,
  onChange,
  value,
}: {
  actionType: MarketingCampaignCtaActionType
  onChange: (v: string) => void
  value: string
}) {
  if (actionType === 'NONE') return null

  if (actionType === 'EXTERNAL_LINK') {
    const url = readPayloadString(value, 'url')
    return (
      <div className="space-y-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <Globe className="size-3.5" /> External Web URL
        </span>
        <Input
          onChange={(e) => onChange(payloadText({ url: e.target.value }))}
          placeholder="https://example.com/promo"
          type="url"
          value={url}
        />
      </div>
    )
  }

  if (actionType === 'SERVICE_CATEGORY') {
    const code = readPayloadString(value, 'categoryCode')
    return (
      <LookupSelect
        fetchOptions={searchCategoryCodeLookupOptions}
        label="Target category"
        placeholder="Search category"
        queryKey={['lookup', 'marketing-campaign-category-code']}
        searchPlaceholder="Search by category name or code"
        selectedLabel={code ? `${humanize(code)} (${code})` : undefined}
        value={code}
        onChange={(selectedCode) => {
          onChange(
            selectedCode
              ? JSON.stringify({ categoryCode: selectedCode }, null, 2)
              : JSON.stringify({}, null, 2),
          )
        }}
      />
    )
  }

  if (actionType === 'VENDOR') {
    const vendorId = readPayloadString(value, 'vendorId')
    const vendorName = readPayloadString(value, 'vendorName')

    return (
      <LookupSelect
        fetchOptions={searchVendorLookupOptions}
        label="Target vendor"
        placeholder="Search vendor"
        queryKey={['lookup', 'marketing-campaign-vendor']}
        searchPlaceholder="Search by shop, owner, mobile"
        selectedLabel={vendorName ? `${vendorName} (${vendorId})` : vendorId}
        value={vendorId}
        onChange={(selectedVendorId, option) => {
          onChange(
            selectedVendorId
              ? payloadText({
                  vendorId: selectedVendorId,
                  vendorName: option?.label,
                })
              : payloadText(),
          )
        }}
      />
    )
  }

  return null
}

function MobilePhonePreview({ campaign, form, imagePreviewUrl }: {
  campaign?: MarketingCampaign | null
  form: CampaignFormState
  imagePreviewUrl?: string | null
}) {
  const imageUrl = imagePreviewUrl ?? campaign?.image.url
  return (
    <div className="sticky top-6 rounded-[1rem] border border-border bg-surface p-5 shadow-surface">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Live Mobile Preview</p>
          <p className="text-xs text-muted">390px Mobile Customer Home Popover</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
          <Smartphone className="size-4.5" />
        </div>
      </div>

      <div className="mx-auto max-w-[340px] rounded-[2.25rem] bg-[#120B21]/90 p-4 shadow-2xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#6B3FD1]/20 bg-[#F8F4FF] p-4 text-center shadow-xl">
          {/* Swiggy-style White Floating Close Badge */}
          <div className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white shadow-md">
            <X className="size-4 text-[#2B1D45]" />
          </div>

          {/* Top Hero Image Area */}
          <div className="overflow-hidden rounded-[1.5rem] bg-[#F2E9FF]">
            {imageUrl ? (
              <img alt="" className="aspect-[4/5] h-full w-full object-cover" src={imageUrl} />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center text-muted">
                <ImageIcon className="size-10 text-primary/40" />
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="px-2 pb-2 pt-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">INTRODUCING</p>
            <p className="mt-1.5 text-xl font-black tracking-tight text-[#1F1235]">{form.headline || 'Campaign Headline'}</p>
            <p className="mx-auto mt-2 max-w-[260px] text-xs font-medium leading-relaxed text-[#534370]">{form.body || 'Campaign body text goes here...'}</p>

            {/* Full-width Rounded Pill Action CTA Button */}
            <div className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-700 px-5 text-sm font-black text-white shadow-lg shadow-purple-500/25">
              {form.ctaLabel || 'Know more'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionConfirmModal({
  campaign,
  onClose,
  onConfirm,
  pending,
  state,
}: {
  campaign: MarketingCampaign
  onClose: () => void
  onConfirm: (reason: string) => void
  pending: boolean
  state: ActionConfirmState
}) {
  const [reason, setReason] = useState(state.reason)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const icons = { publish: Send, pause: PauseCircle, archive: Archive }
  const Icon = icons[state.action]
  const tones = { publish: 'text-primary', pause: 'text-warning', archive: 'text-muted' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[1.25rem] border border-border bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Icon className={cn('size-5', tones[state.action])} />
            <h3 className="text-base font-extrabold text-foreground capitalize">{state.action} Campaign</h3>
          </div>
          <button className="rounded-lg p-1 text-muted hover:bg-secondary" onClick={onClose} type="button">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted">
            Are you sure you want to {state.action} <span className="font-bold text-foreground">&ldquo;{campaign.title}&rdquo;</span>?
          </p>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted">Reason for this action</span>
            <Input ref={inputRef} onChange={(e) => setReason(e.target.value)} placeholder="Provide a brief reason..." value={reason} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-3">
          <Button disabled={pending} onClick={onClose} type="button" variant="secondary">Cancel</Button>
          <Button disabled={!reason.trim() || pending} isLoading={pending} onClick={() => onConfirm(reason)} type="button">
            Confirm {humanize(state.action)}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Reusable Component ──────────────────────────────────────────────────

export interface MarketingCampaignStudioProps {
  campaign?: MarketingCampaign | null
  mode: 'create' | 'edit'
  onBack?: () => void
  onSaved?: (savedCampaign: MarketingCampaign) => void
}

export function MarketingCampaignStudio({ campaign, mode, onBack, onSaved }: MarketingCampaignStudioProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<StudioTab>('creative')
  const [form, setForm] = useState<CampaignFormState>(() => campaign ? formFromCampaign(campaign) : newCampaignForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [actionConfirm, setActionConfirm] = useState<ActionConfirmState | null>(null)

  const refreshCampaign = async (campaignId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'marketing-campaigns'] })
    if (campaignId) {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'marketing-campaign', campaignId] })
    }
  }

  function updateForm<K extends keyof CampaignFormState>(key: K, value: CampaignFormState[K]) {
    setForm((cur) => ({ ...cur, [key]: value }))
  }

  function updateCtaActionType(actionType: MarketingCampaignCtaActionType) {
    setForm((cur) =>
      cur.ctaActionType === actionType
        ? cur
        : {
            ...cur,
            ctaActionPayload: defaultPayloadForAction(actionType),
            ctaActionType: actionType,
          },
    )
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form)
      if (mode === 'create' || !campaign) {
        return marketingCampaignService.createCampaign(payload)
      }
      return marketingCampaignService.updateCampaign(campaign.campaignId, payload)
    },
    onMutate: () => setFormError(null),
    onSuccess: async (res) => {
      await refreshCampaign(res.data.campaignId)
      if (onSaved) onSaved(res.data)
      if (mode === 'create') {
        navigate(`${routePaths.marketingCampaigns}/${res.data.campaignId}`)
      }
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'Campaign could not be saved.'),
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!campaign) throw new Error('Save the campaign draft before uploading artwork.')
      const dimensions = await getImageDimensions(file)
      assertHomePopoverImage(file, dimensions)
      setImagePreviewUrl(dimensions.objectUrl)
      const intentRes = await marketingCampaignService.createImageUploadIntent(campaign.campaignId, { fileName: file.name, mimeType: file.type, sizeBytes: file.size })
      const intent = intentRes.data
      if (!intent.uploadUrl) throw new Error('Campaign image upload URL is unavailable.')
      const headers = new Headers(intent.headers)
      if (!headers.has('Content-Type')) headers.set('Content-Type', file.type)
      const uploadRes = await fetch(intent.uploadUrl, { method: 'PUT', headers, body: file })
      if (!uploadRes.ok) throw new Error('Campaign image upload failed. Please try again.')
      return marketingCampaignService.confirmImageUpload(campaign.campaignId, {
        height: dimensions.height,
        mediaAssetId: intent.mediaAssetId,
        reason: 'Uploaded validated 4:5 customer home popover artwork.',
        uploadedAt: new Date().toISOString(),
        width: dimensions.width,
      })
    },
    onMutate: () => setImageError(null),
    onSuccess: async () => { if (campaign) await refreshCampaign(campaign.campaignId) },
    onError: (e) => setImageError(e instanceof Error ? e.message : 'Campaign image upload failed.'),
  })

  const actionMutation = useMutation({
    mutationFn: async (input: { action: 'archive' | 'pause' | 'publish'; reason: string }) => {
      if (!campaign) return
      if (input.action === 'publish') return marketingCampaignService.publishCampaign(campaign.campaignId, { reason: input.reason })
      if (input.action === 'pause') return marketingCampaignService.pauseCampaign(campaign.campaignId, { reason: input.reason })
      return marketingCampaignService.archiveCampaign(campaign.campaignId, { reason: input.reason })
    },
    onSuccess: async () => { setActionConfirm(null); if (campaign) await refreshCampaign(campaign.campaignId) },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'Campaign action failed.'),
  })

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) uploadMutation.mutate(file)
  }

  function openActionConfirm(action: 'archive' | 'pause' | 'publish') {
    const defaults = { publish: 'Approved for customer home placement.', pause: 'Pausing campaign temporarily.', archive: 'Archiving campaign.' }
    setActionConfirm({ action, reason: defaults[action] })
  }

  function handleConfirmAction(reason: string) {
    if (!actionConfirm) return
    actionMutation.mutate({ action: actionConfirm.action, reason })
  }

  const newUserCards = [
    { value: 'ANY' as NewUserRule, label: 'Everyone', description: 'No user-age filter', icon: Users, tone: 'any' as const },
    { value: 'NEW_USERS_ONLY' as NewUserRule, label: 'New users', description: 'Never booked, recently joined', icon: Sparkles, tone: 'new' as const },
    { value: 'RETURNING_USERS_ONLY' as NewUserRule, label: 'Returning', description: 'Has placed at least 1 order', icon: RefreshCcw, tone: 'returning' as const },
  ]

  const orderCards = [
    { value: 'ANY' as MarketingCampaignActiveOrderRule, label: 'Any', description: 'Regardless of active orders', icon: Globe, tone: 'any' as const },
    { value: 'NO_ACTIVE_BOOKINGS' as MarketingCampaignActiveOrderRule, label: 'No active orders', description: 'Idle — no live booking', icon: CircleDot, tone: 'new' as const },
    { value: 'HAS_ACTIVE_BOOKINGS' as MarketingCampaignActiveOrderRule, label: 'Has active order', description: 'Booking currently in progress', icon: Megaphone, tone: 'returning' as const },
  ]

  const saveButtonLabel = saveMutation.isPending
    ? 'Saving...'
    : mode === 'create'
    ? 'Create Draft'
    : campaign?.status === 'PUBLISHED' || campaign?.status === 'SCHEDULED' || campaign?.status === 'PAUSED'
    ? 'Save Changes'
    : 'Save Draft'

  return (
    <div className="space-y-6">
      {/* Sticky Top Header Bar */}
      <div className="sticky top-0 z-20 -mx-6 -mt-6 border-b border-border bg-surface/95 px-6 py-4 backdrop-blur shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button onClick={onBack ?? (() => navigate(routePaths.marketingCampaigns))} variant="ghost">
              <ArrowLeft className="mr-1.5 size-4" />
              Campaigns
            </Button>
            <div className="h-5 w-px bg-border" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {mode === 'create' ? 'Create New Campaign' : 'Marketing Campaign Studio'}
              </p>
              <h1 className="text-lg font-extrabold text-foreground">{form.title || 'Untitled Campaign'}</h1>
            </div>
            {campaign && <Badge tone={statusTone(campaign.status)}>{humanize(campaign.status)}</Badge>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()} type="button">
              {saveButtonLabel}
            </Button>
            {mode === 'edit' && campaign && (
              <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-control bg-secondary px-3.5 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary-hover">
                <Upload className="mr-1.5 size-3.5" />
                Upload 4:5 Artwork
                <input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadMutation.isPending} onChange={handleImageChange} type="file" />
              </label>
            )}
            {campaign?.availableActions.includes('PUBLISH') ? (
              <Button disabled={actionMutation.isPending} onClick={() => openActionConfirm('publish')} type="button" variant="secondary">
                <Send className="mr-1.5 size-3.5" />Publish
              </Button>
            ) : null}
            {campaign?.availableActions.includes('PAUSE') ? (
              <Button disabled={actionMutation.isPending} onClick={() => openActionConfirm('pause')} type="button" variant="secondary">
                <PauseCircle className="mr-1.5 size-3.5" />Pause
              </Button>
            ) : null}
            {campaign?.availableActions.includes('ARCHIVE') ? (
              <Button disabled={actionMutation.isPending} onClick={() => openActionConfirm('archive')} type="button" variant="ghost">
                <Archive className="mr-1.5 size-3.5" />Archive
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {formError ? <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm font-semibold text-danger">{formError}</p> : null}
      {imageError ? <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm font-semibold text-danger">{imageError}</p> : null}

      {/* Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition',
            activeTab === 'creative' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground',
          )}
          onClick={() => setActiveTab('creative')}
          type="button"
        >
          <Layers className="size-4" />
          1. Creative & Content
        </button>

        <button
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition',
            activeTab === 'audience' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground',
          )}
          onClick={() => setActiveTab('audience')}
          type="button"
        >
          <Users className="size-4" />
          2. Audience & Targeting
        </button>

        <button
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition',
            activeTab === 'schedule' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground',
          )}
          onClick={() => setActiveTab('schedule')}
          type="button"
        >
          <Zap className="size-4" />
          3. Frequency & Schedule
        </button>
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === 'creative' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="space-y-5 rounded-[1rem] border border-border bg-surface p-6 shadow-surface">
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-foreground">Content & Call to Action</h3>
                <p className="text-xs text-muted">Configure the messaging and button action shown on customer phones.</p>
              </div>

              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-muted">Headline</span>
                  <Input maxLength={120} onChange={(e) => updateForm('headline', e.target.value)} value={form.headline} />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-muted">Body Copy</span>
                  <textarea className="form-input min-h-24 resize-y" maxLength={500} onChange={(e) => updateForm('body', e.target.value)} value={form.body} />
                </label>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted">Button Label</span>
                    <Input onChange={(e) => updateForm('ctaLabel', e.target.value)} value={form.ctaLabel} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted">Action Type</span>
                    <select className="form-input" onChange={(e) => updateCtaActionType(e.target.value as MarketingCampaignCtaActionType)} value={form.ctaActionType}>
                      {CTA_ACTION_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted">Priority</span>
                    <Input min={0} onChange={(e) => updateForm('priority', e.target.value)} type="number" value={form.priority} />
                  </label>
                </div>

                <SmartCtaPayload actionType={form.ctaActionType} onChange={(v) => updateForm('ctaActionPayload', v)} value={form.ctaActionPayload} />
              </div>
            </section>

            <MobilePhonePreview campaign={campaign} form={form} imagePreviewUrl={imagePreviewUrl} />
          </div>
        )}

        {activeTab === 'audience' && (
          <div className="max-w-4xl space-y-6">
            <section className="space-y-6 rounded-[1rem] border border-border bg-surface p-6 shadow-surface">
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-foreground">Target Audience Criteria</h3>
                <p className="text-xs text-muted">Select which customers will see this campaign on their home screen.</p>
              </div>

              <div className="space-y-3">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                  <Sparkles className="size-3.5" /> User Lifecycle Rule
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {newUserCards.map((card) => (
                    <AudienceCard
                      key={card.value}
                      active={form.targetingNewUserRule === card.value}
                      description={card.description}
                      icon={card.icon}
                      label={card.label}
                      onClick={() => updateForm('targetingNewUserRule', card.value)}
                      tone={card.tone}
                    />
                  ))}
                </div>

                {form.targetingNewUserRule === 'NEW_USERS_ONLY' && (
                  <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <Sparkles className="size-4 text-violet-600" />
                    <label className="flex items-center gap-3">
                      <span className="text-xs font-bold text-violet-800">Target users registered within the last</span>
                      <Input
                        className="w-20 text-center"
                        max={365}
                        min={1}
                        onChange={(e) => updateForm('newUserWindowDays', e.target.value)}
                        type="number"
                        value={form.newUserWindowDays}
                      />
                      <span className="text-xs font-bold text-violet-800">days</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                  <CircleDot className="size-3.5" /> Live Booking Status Rule
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {orderCards.map((card) => (
                    <AudienceCard
                      key={card.value}
                      active={form.targetingActiveOrderRule === card.value}
                      description={card.description}
                      icon={card.icon}
                      label={card.label}
                      onClick={() => updateForm('targetingActiveOrderRule', card.value)}
                      tone={card.tone}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <label className="block space-y-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <MapPin className="size-3.5" /> Target Cities (comma separated, leave blank for all cities)
                  </span>
                  <Input onChange={(e) => updateForm('cityList', e.target.value)} placeholder="e.g. Chennai, Bengaluru, Mumbai" value={form.cityList} />
                </label>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="max-w-4xl space-y-6">
            <section className="space-y-6 rounded-[1rem] border border-border bg-surface p-6 shadow-surface">
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-foreground">Frequency Capping & Scheduling</h3>
                <p className="text-xs text-muted">Control impression limits and automated start/end dates.</p>
              </div>

              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Impression Limits</span>
                <div className="flex flex-wrap justify-around gap-6 rounded-xl border border-border bg-secondary/30 p-5">
                  <FrequencyCapStepper label="Lifetime shows" max={20} min={1} onChange={(v) => updateForm('maxImpressionsPerCustomer', v)} value={form.maxImpressionsPerCustomer} />
                  <FrequencyCapStepper label="Per day" max={10} min={1} onChange={(v) => updateForm('maxImpressionsPerDay', v)} value={form.maxImpressionsPerDay} />
                  <FrequencyCapStepper label="Cooldown (hrs)" max={168} min={0} onChange={(v) => updateForm('cooldownHoursAfterDismiss', v)} value={form.cooldownHoursAfterDismiss} />
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Active Window Schedule</span>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted">Starts At</span>
                    <Input onChange={(e) => updateForm('startsAt', e.target.value)} type="datetime-local" value={form.startsAt} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted">Ends At</span>
                    <Input onChange={(e) => updateForm('endsAt', e.target.value)} type="datetime-local" value={form.endsAt} />
                  </label>
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Campaign Identification & Log</span>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted">Campaign Code</span>
                    <Input onChange={(e) => updateForm('campaignCode', e.target.value)} value={form.campaignCode} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted">Internal Title</span>
                    <Input onChange={(e) => updateForm('title', e.target.value)} value={form.title} />
                  </label>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-muted">Reason for Change Log</span>
                  <Input onChange={(e) => updateForm('reason', e.target.value)} value={form.reason} />
                </label>
              </div>
            </section>
          </div>
        )}
      </div>

      {actionConfirm && campaign && (
        <ActionConfirmModal
          campaign={campaign}
          onClose={() => setActionConfirm(null)}
          onConfirm={handleConfirmAction}
          pending={actionMutation.isPending}
          state={actionConfirm}
        />
      )}
    </div>
  )
}
