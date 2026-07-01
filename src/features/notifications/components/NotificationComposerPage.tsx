import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { routePaths } from '../../../config/routes'
import { useAuthStore } from '../../../store/authStore'
import { formatDate } from '../../../utils/formatDate'
import { notificationService } from '../services/notification.service'
import type {
  NotificationAdminStatus,
  NotificationChannel,
  NotificationCustomerStatus,
  NotificationRecipientSummary,
  NotificationRecipientType,
  NotificationSegmentPayload,
  NotificationTargetType,
  NotificationTemplate,
  NotificationUserStatus,
  NotificationVendorOnboardingStatus,
  NotificationVendorStatus,
  SendNotificationData,
  SendNotificationPayload,
} from '../types/notification.types'

const adminStatuses: NotificationAdminStatus[] = ['ACTIVE', 'DISABLED']
const channels: NotificationChannel[] = ['PUSH', 'SMS', 'EMAIL']
const customerStatuses: NotificationCustomerStatus[] = ['ACTIVE', 'BLOCKED', 'INCOMPLETE']
const recipientTypes: NotificationRecipientType[] = ['CUSTOMER', 'VENDOR', 'ADMIN']
const targetTypes: NotificationTargetType[] = ['USER', 'SEGMENT']
const userStatuses: NotificationUserStatus[] = ['ACTIVE', 'BLOCKED', 'INACTIVE', 'DELETED']
const vendorOnboardingStatuses: NotificationVendorOnboardingStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'DOCUMENTS_PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
]
const vendorStatuses: NotificationVendorStatus[] = ['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE']

function readSearchEnum<TValue extends string>(
  searchParams: URLSearchParams,
  key: string,
  allowedValues: readonly TValue[],
  fallback: TValue,
) {
  const value = searchParams.get(key)

  return value && allowedValues.includes(value as TValue) ? (value as TValue) : fallback
}

function parseVariables(value: string) {
  if (!value.trim()) {
    return {}
  }

  const parsed = JSON.parse(value) as unknown

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Variables must be a JSON object.')
  }

  const variables = parsed as Record<string, unknown>
  const invalidKey = Object.entries(variables).find(([, variableValue]) => typeof variableValue !== 'string')?.[0]

  if (invalidKey) {
    throw new Error(`Variable "${invalidKey}" must be a string.`)
  }

  return variables as Record<string, string>
}

function renderTemplate(template: string | null | undefined, variables: Record<string, string>) {
  if (!template) {
    return ''
  }

  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => {
    const normalizedKey = key.trim()

    return variables[normalizedKey] ?? `{{${normalizedKey}}}`
  })
}

function selectedTemplateFor(templates: NotificationTemplate[], templateCode: string) {
  return templates.find((template) => template.templateCode === templateCode) ?? null
}

function isSegmentResult(result: SendNotificationData): result is Extract<SendNotificationData, { targetType: 'SEGMENT' }> {
  return result.targetType === 'SEGMENT'
}

function optionalString(value: string) {
  return value.trim() || undefined
}

function compactSegment(segment: NotificationSegmentPayload) {
  return Object.fromEntries(
    Object.entries(segment).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as NotificationSegmentPayload
}

function RecipientPreviewList({ recipients }: { recipients: NotificationRecipientSummary[] }) {
  if (!recipients.length) {
    return <p className="text-sm text-muted">No recipients matched.</p>
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {recipients.slice(0, 8).map((recipient) => (
        <div key={recipient.userId} className="rounded-control border border-border bg-background/40 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">{recipient.userType}</span>
            <Badge tone={recipient.status === 'ACTIVE' ? 'success' : 'warning'}>{recipient.status}</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted">
            {recipient.mobileNumber ?? recipient.email ?? recipient.userId}
          </p>
        </div>
      ))}
    </div>
  )
}

function SendResultPanel({ result }: { result: SendNotificationData }) {
  if (isSegmentResult(result)) {
    return (
      <section className="mt-4 rounded-[1rem] border border-border bg-background/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={result.dryRun ? 'info' : 'success'}>{result.dryRun ? 'Preview' : 'Queued'}</Badge>
          <Badge tone="neutral">Matched {result.matchedCount}</Badge>
          <Badge tone="success">Queued {result.queuedCount}</Badge>
          <Badge tone={result.skippedCount ? 'warning' : 'neutral'}>Skipped {result.skippedCount}</Badge>
        </div>
        {result.dispatch.warnings.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {result.dispatch.warnings.map((warning) => (
              <Badge key={warning} tone={warning === 'DRY_RUN' ? 'info' : 'warning'}>
                {warning}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="mt-4">
          <RecipientPreviewList recipients={result.recipientPreview} />
        </div>
      </section>
    )
  }

  return (
    <section className="mt-4 rounded-[1rem] border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={result.status === 'QUEUED' ? 'warning' : result.status === 'SENT' ? 'success' : 'neutral'}>
          {result.status}
        </Badge>
        <Badge tone="info">{result.channel}</Badge>
        <Badge tone={result.dispatch.queued ? 'success' : 'warning'}>
          {result.dispatch.providerStatus}
        </Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Event ID</p>
          <p className="break-all text-sm text-foreground">{result.eventId}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Created</p>
          <p className="text-sm text-foreground">{formatDate(result.createdAt, true)}</p>
        </div>
      </div>
      <div className="mt-3 rounded-control border border-border bg-surface px-3 py-2">
        <p className="text-sm font-semibold text-foreground">{result.title ?? result.templateCode}</p>
        <p className="mt-1 text-sm text-muted">{result.body}</p>
      </div>
    </section>
  )
}

function ConfirmationModal({
  isSubmitting,
  onClose,
  onConfirm,
  payload,
}: {
  isSubmitting: boolean
  onClose: () => void
  onConfirm: () => void
  payload: SendNotificationPayload
}) {
  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">Confirm notification</h2>
            <p className="mt-1 text-sm text-muted">{payload.templateCode}</p>
          </div>
          <button
            aria-label="Close confirmation"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">{payload.channel}</Badge>
            <Badge tone="neutral">{payload.recipientType}</Badge>
            <Badge tone={payload.targetType === 'SEGMENT' ? 'warning' : 'neutral'}>{payload.targetType}</Badge>
          </div>
          <div className="rounded-control border border-border bg-background/40 p-3">
            {payload.targetType === 'USER' ? (
              <p className="break-all text-foreground">{payload.recipientUserId}</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words text-xs text-foreground">
                {JSON.stringify(payload.segment ?? {}, null, 2)}
              </pre>
            )}
          </div>
          <p className="text-muted">{payload.reason}</p>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
          <Button disabled={isSubmitting} size="sm" type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isSubmitting} size="sm" type="button" onClick={onConfirm}>
            Queue Notification
          </Button>
        </div>
      </div>
    </div>
  )
}

export function NotificationComposerPage() {
  const can = useAuthStore((state) => state.can)
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const seededRecipientUserId = searchParams.get('recipientUserId') ?? ''
  const seededTargetType = readSearchEnum(
    searchParams,
    'targetType',
    targetTypes,
    'USER',
  )
  const initialTargetType = seededRecipientUserId ? 'USER' : seededTargetType
  const [adminStatus, setAdminStatus] = useState<'' | NotificationAdminStatus>('')
  const [categoryId, setCategoryId] = useState('')
  const [channel, setChannel] = useState<NotificationChannel>(() =>
    readSearchEnum(searchParams, 'channel', channels, 'PUSH'),
  )
  const [customerStatus, setCustomerStatus] = useState<'' | NotificationCustomerStatus>('')
  const [dryRun, setDryRun] = useState(() => initialTargetType === 'SEGMENT')
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingPayload, setPendingPayload] = useState<SendNotificationPayload | null>(null)
  const [reason, setReason] = useState('')
  const [recipientType, setRecipientType] = useState<NotificationRecipientType>(() =>
    readSearchEnum(searchParams, 'recipientType', recipientTypes, 'CUSTOMER'),
  )
  const [recipientUserId, setRecipientUserId] = useState(seededRecipientUserId)
  const [segmentCity, setSegmentCity] = useState('')
  const [segmentLimit, setSegmentLimit] = useState('100')
  const [targetType, setTargetType] =
    useState<NotificationTargetType>(initialTargetType)
  const [templateCode, setTemplateCode] = useState(
    () => searchParams.get('templateCode') ?? '',
  )
  const [userStatus, setUserStatus] = useState<NotificationUserStatus>('ACTIVE')
  const [variablesJson, setVariablesJson] = useState('{}')
  const [vendorOnboardingStatus, setVendorOnboardingStatus] =
    useState<'' | NotificationVendorOnboardingStatus>('')
  const [vendorStatus, setVendorStatus] = useState<'' | NotificationVendorStatus>('')
  const [zoneId, setZoneId] = useState('')

  const canSendNotifications = can('notifications:send')
  const templatesQuery = useQuery({
    enabled: canSendNotifications,
    queryKey: ['notification-templates', 'composer', channel],
    queryFn: () => notificationService.getTemplates({ channel, isActive: true }),
  })
  const sendMutation = useMutation({
    mutationFn: (payload: SendNotificationPayload) =>
      notificationService.sendNotification(payload),
    onSuccess: () => {
      setPendingPayload(null)
      void queryClient.invalidateQueries({ queryKey: ['notification-events'] })
    },
  })

  const templates = templatesQuery.data?.data ?? []
  const selectedTemplate = selectedTemplateFor(templates, templateCode)
  const parsedVariables = useMemo(() => {
    try {
      return { error: null, value: parseVariables(variablesJson) }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Variables must be valid JSON.',
        value: {},
      }
    }
  }, [variablesJson])
  const previewTitle = renderTemplate(selectedTemplate?.titleTemplate, parsedVariables.value)
  const previewBody = renderTemplate(selectedTemplate?.bodyTemplate, parsedVariables.value)

  const buildSegment = (): NotificationSegmentPayload => {
    const limit = Math.min(Math.max(Number(segmentLimit) || 100, 1), 500)
    const baseSegment: NotificationSegmentPayload = {
      city: optionalString(segmentCity),
      zoneId: optionalString(zoneId),
      userStatus,
      limit,
    }

    if (recipientType === 'CUSTOMER') {
      baseSegment.customerStatus = customerStatus || undefined
    }

    if (recipientType === 'VENDOR') {
      baseSegment.categoryId = optionalString(categoryId)
      baseSegment.vendorStatus = vendorStatus || undefined
      baseSegment.vendorOnboardingStatus = vendorOnboardingStatus || undefined
    }

    if (recipientType === 'ADMIN') {
      baseSegment.adminStatus = adminStatus || undefined
    }

    return compactSegment(baseSegment)
  }

  const buildPayload = (): SendNotificationPayload => {
    if (!templateCode.trim()) {
      throw new Error('Template code is required.')
    }

    if (reason.trim().length < 5) {
      throw new Error('Reason must be at least 5 characters.')
    }

    if (parsedVariables.error) {
      throw new Error(parsedVariables.error)
    }

    if (targetType === 'USER' && !recipientUserId.trim()) {
      throw new Error('Recipient user ID is required for one-to-one notifications.')
    }

    return {
      targetType,
      recipientType,
      channel,
      templateCode: templateCode.trim(),
      variables: parsedVariables.value,
      dryRun: targetType === 'SEGMENT' ? dryRun : false,
      reason: reason.trim(),
      ...(targetType === 'USER'
        ? { recipientUserId: recipientUserId.trim() }
        : { segment: buildSegment() }),
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!canSendNotifications) {
      setFormError('Your current admin role cannot send notifications.')
      return
    }

    try {
      const payload = buildPayload()

      if (payload.targetType === 'SEGMENT' && payload.dryRun) {
        sendMutation.mutate(payload)
        return
      }

      setPendingPayload(payload)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Notification request failed.')
    }
  }

  const handleTargetTypeChange = (nextTargetType: NotificationTargetType) => {
    setTargetType(nextTargetType)

    if (nextTargetType === 'USER') {
      setDryRun(false)
    }
  }

  if (!canSendNotifications) {
    return (
      <PageContainer>
        <DetailPageHeader
          listHref={routePaths.notifications}
          listLabel="Notifications"
          recordName="New Notification"
        />
        <ErrorState
          description="Your current admin role can view notification events and templates but cannot queue new sends."
          title="Notification composer unavailable"
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <DetailPageHeader
        listHref={routePaths.notifications}
        listLabel="Notifications"
        recordName="New Notification"
      />

      <form className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]" onSubmit={handleSubmit}>
        <section className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">Target Type</span>
              <select
                className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                value={targetType}
                onChange={(event) => handleTargetTypeChange(event.target.value as NotificationTargetType)}
              >
                {targetTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">Recipient Type</span>
              <select
                className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                value={recipientType}
                onChange={(event) => setRecipientType(event.target.value as NotificationRecipientType)}
              >
                {recipientTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">Channel</span>
              <select
                className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                value={channel}
                onChange={(event) => {
                  setChannel(event.target.value as NotificationChannel)
                  setTemplateCode('')
                }}
              >
                {channels.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">Template</span>
              <select
                className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                value={templateCode}
                onChange={(event) => setTemplateCode(event.target.value)}
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.templateId} value={template.templateCode}>
                    {template.templateCode}
                  </option>
                ))}
              </select>
            </label>

            {targetType === 'USER' ? (
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-foreground">Recipient User ID</span>
                <Input
                  placeholder="UUID"
                  value={recipientUserId}
                  onChange={(event) => setRecipientUserId(event.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-foreground">City</span>
                  <Input
                    placeholder="Bengaluru"
                    value={segmentCity}
                    onChange={(event) => setSegmentCity(event.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-foreground">Zone ID</span>
                  <Input placeholder="UUID" value={zoneId} onChange={(event) => setZoneId(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-foreground">User Status</span>
                  <select
                    className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                    value={userStatus}
                    onChange={(event) => setUserStatus(event.target.value as NotificationUserStatus)}
                  >
                    {userStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-foreground">Segment Limit</span>
                  <Input
                    max={500}
                    min={1}
                    type="number"
                    value={segmentLimit}
                    onChange={(event) => setSegmentLimit(event.target.value)}
                  />
                </label>
                {recipientType === 'CUSTOMER' ? (
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-foreground">Customer Status</span>
                    <select
                      className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                      value={customerStatus}
                      onChange={(event) => setCustomerStatus(event.target.value as '' | NotificationCustomerStatus)}
                    >
                      <option value="">Any</option>
                      {customerStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {recipientType === 'VENDOR' ? (
                  <>
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-foreground">Vendor Status</span>
                      <select
                        className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                        value={vendorStatus}
                        onChange={(event) => setVendorStatus(event.target.value as '' | NotificationVendorStatus)}
                      >
                        <option value="">Any</option>
                        {vendorStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-foreground">Onboarding Status</span>
                      <select
                        className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                        value={vendorOnboardingStatus}
                        onChange={(event) =>
                          setVendorOnboardingStatus(event.target.value as '' | NotificationVendorOnboardingStatus)
                        }
                      >
                        <option value="">Any</option>
                        {vendorOnboardingStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-foreground">Category ID</span>
                      <Input
                        placeholder="UUID"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                      />
                    </label>
                  </>
                ) : null}
                {recipientType === 'ADMIN' ? (
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-foreground">Admin Status</span>
                    <select
                      className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                      value={adminStatus}
                      onChange={(event) => setAdminStatus(event.target.value as '' | NotificationAdminStatus)}
                    >
                      <option value="">Any</option>
                      {adminStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            )}

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Variables JSON</span>
              <textarea
                className="min-h-32 w-full rounded-[0.9rem] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none"
                value={variablesJson}
                onChange={(event) => setVariablesJson(event.target.value)}
              />
              {parsedVariables.error ? <span className="text-xs text-danger">{parsedVariables.error}</span> : null}
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Reason</span>
              <Input
                placeholder="Manual support follow-up"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>

            {targetType === 'SEGMENT' ? (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input checked={dryRun} type="checkbox" onChange={(event) => setDryRun(event.target.checked)} />
                Dry run
              </label>
            ) : null}
          </div>

          {formError || sendMutation.isError ? (
            <div className="mt-4">
              <ErrorState
                description={
                  formError ??
                  (sendMutation.error instanceof Error ? sendMutation.error.message : 'Notification send failed.')
                }
                title="Notification not queued"
              />
            </div>
          ) : null}

          {sendMutation.data ? <SendResultPanel result={sendMutation.data.data} /> : null}

          <div className="mt-4 flex justify-end">
            <Button isLoading={sendMutation.isPending} type="submit">
              <Send className="mr-2 size-4" />
              {targetType === 'SEGMENT' && dryRun ? 'Preview Segment' : 'Review Send'}
            </Button>
          </div>
        </section>

        <aside className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-[-0.03em] text-foreground">Preview</h2>
            <Badge tone={selectedTemplate ? 'info' : 'neutral'}>{channel}</Badge>
          </div>
          <div className="mt-4 rounded-[1.25rem] border border-border bg-background/40 p-4">
            <p className="text-sm font-semibold text-foreground">
              {previewTitle || selectedTemplate?.templateCode || 'Select template'}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
              {previewBody || 'Template body will appear here.'}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
            <span>Title {previewTitle.length}/500</span>
            <span className="text-right">Body {previewBody.length}/1000</span>
          </div>
          {templatesQuery.isError ? (
            <div className="mt-4">
              <InlineAlert
                message={
                  templatesQuery.error instanceof Error
                    ? templatesQuery.error.message
                    : 'Template list could not be loaded.'
                }
              />
            </div>
          ) : null}
          {templatesQuery.isLoading || templatesQuery.isFetching ? (
            <p className="mt-4 text-sm text-muted">Loading templates...</p>
          ) : null}
        </aside>
      </form>

      {pendingPayload ? (
        <ConfirmationModal
          isSubmitting={sendMutation.isPending}
          payload={pendingPayload}
          onClose={() => {
            if (!sendMutation.isPending) {
              setPendingPayload(null)
            }
          }}
          onConfirm={() => sendMutation.mutate(pendingPayload)}
        />
      ) : null}
    </PageContainer>
  )
}
