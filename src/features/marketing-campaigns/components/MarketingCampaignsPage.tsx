import {
  Archive,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Eye,
  Filter,
  Globe,
  ImageIcon,
  Megaphone,
  PauseCircle,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { ListHeaderSearch } from '../../../components/ui/ListHeaderSearch'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import {
  LIST_SELECTION_COLUMN_WIDTH,
  ListSelectionCheckbox,
  ListSelectionToolbar,
} from '../../../components/ui/ListSelection'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
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
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
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
type CampaignPreviewTab = 'preview' | 'creative' | 'audience' | 'schedule'

const DEFAULT_PAGE_SIZE = 15
const STATUS_FILTERS: ('ALL' | MarketingCampaignStatus)[] = [
  'ALL', 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'PAUSED', 'ARCHIVED',
]
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

interface ActionConfirmState {
  action: 'archive' | 'pause' | 'publish'
  reason: string
}

function humanize(value: string) {
  return value.toLowerCase().split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

function statusTone(status: MarketingCampaignStatus): StatusTone {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'SCHEDULED') return 'info'
  if (status === 'PAUSED') return 'warning'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

function formatDateSafe(value?: string | null) {
  if (!value) return 'No schedule'
  return formatDate(value, true)
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

function getSaveButtonLabel(isCreating: boolean, status?: MarketingCampaignStatus, isPending?: boolean) {
  if (isPending) return 'Saving...'
  if (isCreating) return 'Create Draft'
  if (status === 'PUBLISHED' || status === 'SCHEDULED' || status === 'PAUSED') return 'Save Changes'
  return 'Save Draft'
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
        'flex w-full flex-col items-start gap-1 rounded-lg border bg-gradient-to-br p-2.5 text-left transition-all',
        active
          ? cn(toneClasses[tone], 'ring-2 ring-current/20 shadow-sm')
          : 'border-border bg-surface hover:border-primary/30 hover:shadow-sm',
      )}
      onClick={onClick}
      type="button"
    >
      <div className={cn('flex size-7 items-center justify-center rounded-md', active ? 'bg-current/10' : 'bg-secondary')}>
        <Icon className={cn('size-4', active ? 'text-current' : 'text-muted')} />
      </div>
      <p className={cn('text-xs font-bold mt-1', active ? 'text-current' : 'text-foreground')}>{label}</p>
      <p className="text-[10px] leading-tight text-muted">{description}</p>
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
    <div className="flex flex-col items-center gap-1">
      <span className="text-center text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
        <button
          className="flex size-7 items-center justify-center rounded-md bg-secondary text-foreground transition hover:bg-secondary-hover disabled:opacity-40"
          disabled={num <= min}
          onClick={() => onChange(String(Math.max(min, num - 1)))}
          type="button"
        >
          <ChevronDown className="size-3.5" />
        </button>
        <span className="w-8 text-center text-xs font-extrabold text-foreground">{num}</span>
        <button
          className="flex size-7 items-center justify-center rounded-md bg-secondary text-foreground transition hover:bg-secondary-hover disabled:opacity-40"
          disabled={num >= max}
          onClick={() => onChange(String(Math.min(max, num + 1)))}
          type="button"
        >
          <ChevronUp className="size-3.5" />
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
      <div className="space-y-1">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-muted">
          <Globe className="size-3" /> External Web URL
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
        queryKey={['lookup', 'marketing-campaign-category-code', 'drawer']}
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
        queryKey={['lookup', 'marketing-campaign-vendor', 'drawer']}
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

function MobilePhonePreview({ campaign, form }: {
  campaign?: MarketingCampaign | null
  form: CampaignFormState
}) {
  const imageUrl = campaign?.image.url
  return (
    <div className="mx-auto max-w-[300px] rounded-[2rem] bg-[#120B21]/90 p-3 shadow-2xl">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-[#6B3FD1]/20 bg-[#F8F4FF] p-3 text-center shadow-xl">
        {/* Swiggy-style White Floating Close Badge */}
        <div className="absolute right-2.5 top-2.5 z-10 flex size-7 items-center justify-center rounded-full bg-white shadow-md">
          <X className="size-3.5 text-[#2B1D45]" />
        </div>

        {/* Top Hero Image Area */}
        <div className="overflow-hidden rounded-[1.25rem] bg-[#F2E9FF]">
          {imageUrl ? (
            <img alt="" className="aspect-[4/5] h-full w-full object-cover" src={imageUrl} />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center text-muted">
              <ImageIcon className="size-8 text-primary/40" />
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="px-1.5 pb-1 pt-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">INTRODUCING</p>
          <p className="mt-1 text-base font-black tracking-tight text-[#1F1235]">{form.headline || 'Campaign Headline'}</p>
          <p className="mx-auto mt-1 max-w-[240px] text-[11px] font-medium leading-relaxed text-[#534370]">{form.body || 'Campaign body text goes here...'}</p>

          {/* Full-width Rounded Pill Action CTA Button */}
          <div className="mt-3 flex min-h-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-700 px-4 text-xs font-black text-white shadow-md shadow-purple-500/25">
            {form.ctaLabel || 'Know more'}
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

// ─── Main Page Component (Vendors & Customers Pattern) ──────────────────────

export function MarketingCampaignsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | MarketingCampaignStatus>('ALL')
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [previewTab, setPreviewTab] = useState<CampaignPreviewTab>('preview')
  const [showFilters, setShowFilters] = useState(false)
  const [form, setForm] = useState<CampaignFormState>(() => newCampaignForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [actionConfirm, setActionConfirm] = useState<ActionConfirmState | null>(null)

  const campaignsQuery = useQuery({
    queryKey: ['admin', 'marketing-campaigns', statusFilter, search],
    queryFn: () => marketingCampaignService.getCampaigns({
      limit: DEFAULT_PAGE_SIZE, page: 1,
      search: search || undefined,
      status: statusFilter === 'ALL' ? undefined : [statusFilter],
    }),
  })

  const campaigns = useMemo<MarketingCampaign[]>(() => {
    const resData = campaignsQuery.data
    if (!resData) return []
    if (Array.isArray(resData)) return resData
    if (Array.isArray(resData.data)) return resData.data
    return []
  }, [campaignsQuery.data])

  const summary = campaignsQuery.data?.summary
  const selectedCampaign = useMemo(
    () => (selectedCampaignId ? campaigns.find((c) => c.campaignId === selectedCampaignId) ?? null : null),
    [campaigns, selectedCampaignId],
  )

  const listSelection = useListSelection(campaigns, (c) => c.campaignId)

  useEffect(() => {
    if (!selectedCampaign || isCreating) return
    let active = true
    void Promise.resolve().then(() => {
      if (!active) return
      setForm(formFromCampaign(selectedCampaign))
      setFormError(null)
      setActionConfirm(null)
    })
    return () => { active = false }
  }, [selectedCampaign, isCreating])

  const refreshCampaigns = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'marketing-campaigns'] })
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
      if (isCreating || !selectedCampaignId) {
        return marketingCampaignService.createCampaign(payload)
      }
      return marketingCampaignService.updateCampaign(selectedCampaignId, payload)
    },
    onMutate: () => setFormError(null),
    onSuccess: async (res) => {
      setSelectedCampaignId(res.data.campaignId)
      setIsCreating(false)
      await refreshCampaigns()
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'Campaign could not be saved.'),
  })

  const actionMutation = useMutation({
    mutationFn: async (input: { action: 'archive' | 'pause' | 'publish'; campaignId: string; reason: string }) => {
      if (input.action === 'publish') return marketingCampaignService.publishCampaign(input.campaignId, { reason: input.reason })
      if (input.action === 'pause') return marketingCampaignService.pauseCampaign(input.campaignId, { reason: input.reason })
      return marketingCampaignService.archiveCampaign(input.campaignId, { reason: input.reason })
    },
    onSuccess: async () => { setActionConfirm(null); await refreshCampaigns() },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'Campaign action failed.'),
  })

  function handleCreateNew() {
    navigate(routePaths.marketingCampaignCreate)
  }

  function handleSelectRow(campaignId: string) {
    setIsCreating(false)
    setSelectedCampaignId(campaignId)
    setPreviewTab('preview')
  }

  function openActionConfirm(action: 'archive' | 'pause' | 'publish') {
    if (!selectedCampaign) return
    const defaults = { publish: 'Approved for customer home placement.', pause: 'Pausing campaign temporarily.', archive: 'Archiving campaign.' }
    setActionConfirm({ action, reason: defaults[action] })
  }

  function handleConfirmAction(reason: string) {
    if (!selectedCampaign || !actionConfirm) return
    actionMutation.mutate({ action: actionConfirm.action, campaignId: selectedCampaign.campaignId, reason })
  }

  const queueItems = [
    { key: 'ALL', label: 'All', count: summary?.total ?? 0 },
    { key: 'PUBLISHED', label: 'Live', count: summary?.published ?? 0 },
    { key: 'SCHEDULED', label: 'Scheduled', count: summary?.scheduled ?? 0 },
    { key: 'DRAFT', label: 'Draft', count: summary?.draft ?? 0 },
    { key: 'PAUSED', label: 'Paused', count: summary?.paused ?? 0 },
    { key: 'ARCHIVED', label: 'Archived', count: summary?.archived ?? 0 },
  ]

  const newUserCards = [
    { value: 'ANY' as NewUserRule, label: 'Everyone', description: 'No user-age filter', icon: Users, tone: 'any' as const },
    { value: 'NEW_USERS_ONLY' as NewUserRule, label: 'New users', description: 'Joined within the configured window', icon: Sparkles, tone: 'new' as const },
    { value: 'RETURNING_USERS_ONLY' as NewUserRule, label: 'Returning', description: 'Outside the new-user window', icon: RefreshCcw, tone: 'returning' as const },
  ]

  const orderCards = [
    { value: 'ANY' as MarketingCampaignActiveOrderRule, label: 'Any', description: 'Regardless of active orders', icon: Globe, tone: 'any' as const },
    { value: 'NO_ACTIVE_BOOKINGS' as MarketingCampaignActiveOrderRule, label: 'No active orders', description: 'Idle — no live booking', icon: CircleDot, tone: 'new' as const },
    { value: 'HAS_ACTIVE_BOOKINGS' as MarketingCampaignActiveOrderRule, label: 'Has active order', description: 'Booking currently in progress', icon: Megaphone, tone: 'returning' as const },
  ]

  const previewDrawerOpen = Boolean(selectedCampaignId || isCreating)
  const saveLabel = getSaveButtonLabel(isCreating, selectedCampaign?.status, saveMutation.isPending)

  return (
    <PageContainer>
      <PageContextHeader
        layout="workspace"
        placement="topbar"
        title="Marketing Campaigns"
      />

      <main className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1">
        {/* Workspace Control Header */}
        <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(10rem,auto)_minmax(22rem,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Campaigns</h2>
              <span className="rounded-full border border-border bg-surface-muted/65 px-2 py-0.5 text-xs font-medium text-muted">
                {summary?.total ?? 0} total
              </span>
            </div>

            <ListHeaderSearch
              className="w-full min-w-0"
              onChange={(v) => setSearch(v)}
              placeholder="Search campaigns by title, code..."
              value={search}
            />

            <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
              <Button
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                onClick={() => setShowFilters((v) => !v)}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Filter className="mr-2 size-4" />
                Filters
              </Button>

              <Button
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                onClick={() => void refreshCampaigns()}
                size="sm"
                type="button"
                variant="secondary"
              >
                <RefreshCcw className="mr-2 size-4" />
                Refresh
              </Button>

              <Button onClick={handleCreateNew} size="sm">
                <Plus className="mr-1.5 size-4" />
                New Campaign
              </Button>
            </div>
          </div>

          {/* Queue Pills */}
          <div className="mt-3 flex gap-1 overflow-x-auto rounded-[0.875rem] border border-border bg-surface-muted/40 p-1">
            {queueItems.map((queue) => {
              const isActive = statusFilter === queue.key
              return (
                <button
                  aria-pressed={isActive}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-2 rounded-[0.65rem] border px-2.5 text-xs font-semibold transition',
                    isActive
                      ? 'border-primary/30 bg-surface text-primary shadow-[var(--sg-shadow-surface)]'
                      : 'border-transparent text-muted hover:bg-surface hover:text-foreground',
                  )}
                  key={queue.key}
                  onClick={() => setStatusFilter(queue.key as typeof statusFilter)}
                  type="button"
                >
                  <span>{queue.label}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-extrabold', isActive ? 'bg-primary/10 text-primary' : 'bg-surface text-muted')}>
                    {queue.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Collapsible Filter Panel */}
          {showFilters ? (
            <div className="mt-3 rounded-[0.75rem] border border-border bg-surface-muted/45 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted">Status:</span>
                    <select className="form-input h-8 text-xs min-w-[140px]" onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} value={statusFilter}>
                      {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : humanize(s)}</option>)}
                    </select>
                  </label>
                </div>
                <Button onClick={() => { setSearch(''); setStatusFilter('ALL') }} size="sm" variant="ghost">Reset</Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Selection Toolbar */}
        {listSelection.selectedIds.length ? (
          <ListSelectionToolbar
            allVisibleSelected={listSelection.allVisibleSelected}
            selectedCount={listSelection.selectedIds.length}
            visibleCount={campaigns.length}
            onClear={listSelection.clearSelection}
            onSelectVisible={() => listSelection.setVisibleSelected(true)}
          />
        ) : null}

        {/* Main Content Area: Data Table + Slide-over Drawer */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Table Container */}
          <div className="flex-1 overflow-y-auto">
            {campaignsQuery.isPending ? (
              <TableSkeleton rowCount={6} />
            ) : campaignsQuery.isError ? (
              <ErrorState description="Marketing campaigns could not be loaded." onRetry={() => void refreshCampaigns()} title="Campaigns unavailable" />
            ) : campaigns.length === 0 ? (
              <EmptyState actionLabel="Create campaign" description="Create your first home popover marketing campaign." onAction={handleCreateNew} title="No campaigns found" />
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-surface text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-3" style={{ width: LIST_SELECTION_COLUMN_WIDTH }}>
                      <ListSelectionCheckbox
                        checked={listSelection.allVisibleSelected}
                        indeterminate={listSelection.selectedIds.length > 0 && !listSelection.allVisibleSelected}
                        label="Select visible marketing campaigns"
                        onChange={listSelection.allVisibleSelected ? () => listSelection.setVisibleSelected(false) : () => listSelection.setVisibleSelected(true)}
                      />
                    </th>
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Audience Signals</th>
                    <th className="px-4 py-3">Frequency Cap</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campaigns.map((c) => {
                    const rowSelected = selectedCampaignId === c.campaignId && !isCreating
                    const checked = listSelection.isSelected(c.campaignId)

                    return (
                      <tr
                        className={cn(
                          'cursor-pointer transition hover:bg-secondary/30',
                          rowSelected && 'bg-primary/5 font-medium',
                        )}
                        key={c.campaignId}
                        onClick={() => handleSelectRow(c.campaignId)}
                      >
                        <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <ListSelectionCheckbox
                            checked={checked}
                            label={`Select campaign ${c.campaignCode}`}
                            onChange={(selected) =>
                              listSelection.setItemSelected(c.campaignId, selected)
                            }
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-extrabold text-foreground">{c.title}</p>
                          <p className="text-xs text-muted">{c.campaignCode}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge tone={statusTone(c.status)}>{humanize(c.status)}</Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {c.targeting.newUserRule && c.targeting.newUserRule !== 'ANY' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                <Sparkles className="size-2.5" />{humanize(c.targeting.newUserRule)}
                              </span>
                            )}
                            {c.targeting.activeOrderRule && c.targeting.activeOrderRule !== 'ANY' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                <CircleDot className="size-2.5" />{humanize(c.targeting.activeOrderRule)}
                              </span>
                            )}
                            {(!c.targeting.newUserRule || c.targeting.newUserRule === 'ANY') && (!c.targeting.activeOrderRule || c.targeting.activeOrderRule === 'ANY') && (
                              <span className="text-xs text-muted">Everyone</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-primary">
                            <Zap className="size-3" />
                            {c.frequencyCap.maxImpressionsPerCustomer}× total · {c.frequencyCap.maxImpressionsPerDay}×/day
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted">
                          <div className="flex items-center gap-1.5">
                            <CalendarClock className="size-3.5 text-muted" />
                            <span>{formatDateSafe(c.schedule.startsAt)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button onClick={() => handleSelectRow(c.campaignId)} size="sm" variant="secondary">
                              <Eye className="mr-1 size-3.5" />
                              Preview
                            </Button>
                            <Button onClick={() => navigate(`${routePaths.marketingCampaigns}/${c.campaignId}`)} size="sm" variant="ghost">
                              <ArrowUpRight className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Slide-over Quick Preview Drawer (Vendors/Customers Style) */}
          {previewDrawerOpen ? (
            <div className="flex w-[480px] flex-col border-l border-border bg-surface shadow-xl">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-extrabold text-foreground">
                      {isCreating ? 'New Campaign Draft' : selectedCampaign?.title}
                    </h3>
                    {selectedCampaign && <Badge tone={statusTone(selectedCampaign.status)}>{humanize(selectedCampaign.status)}</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted">{isCreating ? 'Create Customer Home Popover' : selectedCampaign?.campaignCode}</p>
                </div>
                <div className="flex items-center gap-1">
                  {selectedCampaign && !isCreating && (
                    <Button
                      onClick={() => navigate(`${routePaths.marketingCampaigns}/${selectedCampaign.campaignId}`)}
                      size="sm"
                      variant="ghost"
                    >
                      <ArrowUpRight className="mr-1 size-3.5" />
                      Full Detail Page
                    </Button>
                  )}
                  <button
                    aria-label="Close"
                    className="rounded-lg p-1 text-muted hover:bg-secondary"
                    onClick={() => { setSelectedCampaignId(null); setIsCreating(false) }}
                    type="button"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Drawer Tabs (QuickPreviewTabs) */}
              <QuickPreviewTabs
                activeTab={previewTab}
                ariaLabel="Marketing campaign preview sections"
                onChange={(tab) => setPreviewTab(tab as CampaignPreviewTab)}
                tabs={[
                  { key: 'preview', label: '📱 Mobile Preview' },
                  { key: 'creative', label: '✍️ Creative' },
                  { key: 'audience', label: '🎯 Audience' },
                  { key: 'schedule', label: '⚡ Rules' },
                ]}
              />

              {/* Drawer Tab Contents */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {formError ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{formError}</p> : null}
                {/* Tab: Mobile Preview */}
                {previewTab === 'preview' && (
                  <div className="space-y-4">
                    <MobilePhonePreview campaign={selectedCampaign} form={form} />

                    <QuickPreviewFactGrid>
                      <QuickPreviewFact label="Placement" value="CUSTOMER_HOME_POPOVER" />
                      <QuickPreviewFact label="Priority" value={String(form.priority)} />
                      <QuickPreviewFact label="Lifetime Cap" value={`${form.maxImpressionsPerCustomer} shows`} />
                      <QuickPreviewFact label="Daily Cap" value={`${form.maxImpressionsPerDay}/day`} />
                    </QuickPreviewFactGrid>
                  </div>
                )}

                {/* Tab: Creative */}
                {previewTab === 'creative' && (
                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveMutation.mutate() }}>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-muted">Headline</span>
                      <Input maxLength={120} onChange={(e) => updateForm('headline', e.target.value)} value={form.headline} />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-muted">Body Copy</span>
                      <textarea className="form-input min-h-20 resize-y" maxLength={500} onChange={(e) => updateForm('body', e.target.value)} value={form.body} />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-muted">Button Label</span>
                        <Input onChange={(e) => updateForm('ctaLabel', e.target.value)} value={form.ctaLabel} />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-muted">Action Type</span>
                        <select className="form-input" onChange={(e) => updateCtaActionType(e.target.value as MarketingCampaignCtaActionType)} value={form.ctaActionType}>
                          {CTA_ACTION_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                        </select>
                      </label>
                    </div>

                    <SmartCtaPayload actionType={form.ctaActionType} onChange={(v) => updateForm('ctaActionPayload', v)} value={form.ctaActionPayload} />
                  </form>
                )}

                {/* Tab: Audience */}
                {previewTab === 'audience' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">User Lifecycle Rule</span>
                      <div className="grid grid-cols-3 gap-2">
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
                        <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 p-2.5">
                          <Sparkles className="size-4 text-violet-600" />
                          <span className="text-xs font-bold text-violet-800">Joined within</span>
                          <Input className="w-16 text-center h-8" max={365} min={1} onChange={(e) => updateForm('newUserWindowDays', e.target.value)} type="number" value={form.newUserWindowDays} />
                          <span className="text-xs font-bold text-violet-800">days</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 border-t border-border pt-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">Booking Status Rule</span>
                      <div className="grid grid-cols-3 gap-2">
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

                    <label className="block space-y-1 border-t border-border pt-3">
                      <span className="text-xs font-semibold text-muted">Cities (comma-separated)</span>
                      <Input onChange={(e) => updateForm('cityList', e.target.value)} placeholder="Chennai, Bengaluru" value={form.cityList} />
                    </label>
                  </div>
                )}

                {/* Tab: Schedule & Rules */}
                {previewTab === 'schedule' && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">Impression Frequency Capping</span>
                      <div className="flex flex-wrap justify-around gap-4 rounded-lg border border-border bg-secondary/30 p-3">
                        <FrequencyCapStepper label="Lifetime" max={20} min={1} onChange={(v) => updateForm('maxImpressionsPerCustomer', v)} value={form.maxImpressionsPerCustomer} />
                        <FrequencyCapStepper label="Per day" max={10} min={1} onChange={(v) => updateForm('maxImpressionsPerDay', v)} value={form.maxImpressionsPerDay} />
                        <FrequencyCapStepper label="Cooldown" max={168} min={0} onChange={(v) => updateForm('cooldownHoursAfterDismiss', v)} value={form.cooldownHoursAfterDismiss} />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 border-t border-border pt-3">
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-muted">Starts At</span>
                        <Input onChange={(e) => updateForm('startsAt', e.target.value)} type="datetime-local" value={form.startsAt} />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-muted">Ends At</span>
                        <Input onChange={(e) => updateForm('endsAt', e.target.value)} type="datetime-local" value={form.endsAt} />
                      </label>
                    </div>

                    <div className="space-y-3 border-t border-border pt-3">
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-muted">Campaign Code</span>
                        <Input onChange={(e) => updateForm('campaignCode', e.target.value)} value={form.campaignCode} />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-muted">Internal Title</span>
                        <Input onChange={(e) => updateForm('title', e.target.value)} value={form.title} />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-muted">Audit Log Reason</span>
                        <Input onChange={(e) => updateForm('reason', e.target.value)} value={form.reason} />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Bottom Actions (QuickPreviewActions) */}
              <QuickPreviewActions
                primaryAction={{
                  key: 'save',
                  label: saveLabel,
                  onClick: () => saveMutation.mutate(),
                  disabled: saveMutation.isPending,
                }}
                secondaryActions={[
                  selectedCampaign && !isCreating && selectedCampaign.availableActions.includes('PUBLISH')
                    ? { key: 'publish', label: 'Publish', onClick: () => openActionConfirm('publish') }
                    : null,
                  selectedCampaign && !isCreating && selectedCampaign.availableActions.includes('PAUSE')
                    ? { key: 'pause', label: 'Pause', onClick: () => openActionConfirm('pause') }
                    : null,
                  selectedCampaign && !isCreating && selectedCampaign.availableActions.includes('ARCHIVE')
                    ? { key: 'archive', label: 'Archive', onClick: () => openActionConfirm('archive'), variant: 'danger' as const }
                    : null,
                ].filter(Boolean) as QuickPreviewAction[]}
              />
            </div>
          ) : null}
        </div>
      </main>

      {actionConfirm && selectedCampaign ? (
        <ActionConfirmModal
          campaign={selectedCampaign}
          onClose={() => setActionConfirm(null)}
          onConfirm={handleConfirmAction}
          pending={actionMutation.isPending}
          state={actionConfirm}
        />
      ) : null}
    </PageContainer>
  )
}
