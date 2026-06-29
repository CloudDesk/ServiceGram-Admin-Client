import type { ReactNode } from 'react'
import {
  ArrowUpRight,
  BellPlus,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Mail,
  MessageSquareText,
  Radio,
  ReceiptText,
  RotateCcw,
  Send,
  Smartphone,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { notificationService } from '../services/notification.service'
import type {
  NotificationChannel,
  NotificationEvent,
  NotificationEventStatus,
} from '../types/notification.types'

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
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

function statusTone(status: NotificationEventStatus): StatusTone {
  if (status === 'SENT') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'QUEUED') return 'warning'
  return 'neutral'
}

function channelIcon(channel: NotificationChannel) {
  if (channel === 'EMAIL') return <Mail className="size-4" />
  if (channel === 'SMS') return <MessageSquareText className="size-4" />
  return <Smartphone className="size-4" />
}

const notificationSectionIds = {
  timeline: 'notification-timeline',
  payload: 'notification-payload',
  recipient: 'notification-recipient',
  retry: 'notification-retry',
} as const

type NotificationSectionId =
  (typeof notificationSectionIds)[keyof typeof notificationSectionIds]

function toneClass(tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning') {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
}

function recipientLabel(event: NotificationEvent) {
  return (
    event.recipient?.mobileNumber ??
    event.recipient?.email ??
    event.recipientUserId ??
    'No recipient'
  )
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/35 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-2 break-words text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  meta,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning'
  value: string
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <div className="flex items-center justify-between gap-3">
        <p className={cn('text-xs font-semibold uppercase tracking-normal', toneClass(tone))}>
          {label}
        </p>
        <span className={toneClass(tone)}>{icon}</span>
      </div>
      <p className={cn('mt-3 text-2xl font-semibold tracking-normal', toneClass(tone))}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function SectionShell({
  actionNode,
  children,
  description,
  id,
  icon,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  id?: string
  icon?: ReactNode
  title: string
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
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

function HeaderStatus({ event }: { event: NotificationEvent }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={statusTone(event.status)}>{humanizeCode(event.status)}</Badge>
      <Badge tone="info">{event.channel}</Badge>
      <Badge tone="neutral">{humanizeCode(event.recipientType)}</Badge>
      {event.warnings.length > 0 ? (
        <Badge tone={event.status === 'FAILED' ? 'danger' : 'warning'}>
          {event.warnings.length} warning
        </Badge>
      ) : null}
    </div>
  )
}

function HeaderActions({ canSendNotifications }: { canSendNotifications: boolean }) {
  if (!canSendNotifications) return null

  return (
    <Link to={`${routePaths.notifications}/new`}>
      <Button size="sm" type="button" variant="secondary">
        <BellPlus className="mr-2 size-4" />
        New
      </Button>
    </Link>
  )
}

function DetailSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-16 w-full rounded-[0.875rem]" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-28 rounded-[0.875rem]" key={index} />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-[0.875rem]" />
    </PageContainer>
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
        <Badge tone="neutral">View only</Badge>
      )}
    </div>
  )
}

function RelatedRecordsPanel({
  canReadAudit,
  canSendNotifications,
  canUpdateTemplates,
  event,
  onNavigate,
  onOpenSection,
}: {
  canReadAudit: boolean
  canSendNotifications: boolean
  canUpdateTemplates: boolean
  event: NotificationEvent
  onNavigate: (path: string) => void
  onOpenSection: (sectionId: NotificationSectionId) => void
}) {
  return (
    <SectionShell
      description="Records and tools connected to this delivery event."
      icon={<ArrowUpRight className="size-4" />}
      title="Related records"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          actionLabel="Events"
          canOpen
          icon={<ReceiptText className="size-4" />}
          label="Filtered event queue"
          meta={`${event.channel} · ${humanizeCode(event.status)} · ${humanizeCode(event.recipientType)}`}
          value={event.templateCode}
          onOpen={() => onNavigate(buildNotificationEventsPath(event))}
        />
        <RelatedRecordRow
          actionLabel="Edit"
          canOpen={canUpdateTemplates}
          icon={<Radio className="size-4" />}
          label="Template"
          meta="Opens the template editor with this template selected"
          value={event.templateCode}
          onOpen={() => onNavigate(buildTemplateEditorPath(event))}
        />
        <RelatedRecordRow
          actionLabel="History"
          canOpen={Boolean(event.recipientUserId)}
          icon={<UserRound className="size-4" />}
          label="Recipient delivery history"
          meta={`${humanizeCode(event.recipientType)} event filter`}
          value={recipientLabel(event)}
          onOpen={() => onNavigate(buildRecipientNotificationsPath(event))}
        />
        <RelatedRecordRow
          actionLabel="Payload"
          canOpen
          icon={channelIcon(event.channel)}
          label="Rendered payload"
          meta="Jump to rendered body and provider message"
          value={event.title ?? event.templateCode}
          onOpen={() => onOpenSection(notificationSectionIds.payload)}
        />
        <RelatedRecordRow
          actionLabel="Retry"
          canOpen
          icon={<RotateCcw className="size-4" />}
          label="Retry state"
          meta="Jump to delivery retry metadata"
          value={event.deliveryRetry ? 'Retry metadata available' : 'No retry metadata'}
          onOpen={() => onOpenSection(notificationSectionIds.retry)}
        />
        <RelatedRecordRow
          actionLabel="Audit"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Audit trail"
          meta="Filtered by notification event id"
          value={event.eventId}
          onOpen={() => onNavigate(buildNotificationAuditPath(event))}
        />
        <RelatedRecordRow
          actionLabel="Compose"
          canOpen={canSendNotifications}
          icon={<Send className="size-4" />}
          label="Manual send"
          meta="Prefilled with this event channel and recipient"
          value={event.channel}
          onOpen={() => onNavigate(buildNotificationComposerPath(event))}
        />
      </div>
    </SectionShell>
  )
}

function buildNotificationEventsPath(event: NotificationEvent) {
  const params = new URLSearchParams({
    channel: event.channel,
    recipientType: event.recipientType,
    status: event.status,
    templateCode: event.templateCode,
  })

  if (event.recipientUserId) {
    params.set('recipientUserId', event.recipientUserId)
  }

  return `${routePaths.notifications}?${params.toString()}#notification-events`
}

function buildRecipientNotificationsPath(event: NotificationEvent) {
  const params = new URLSearchParams({
    recipientType: event.recipientType,
  })

  if (event.recipientUserId) {
    params.set('recipientUserId', event.recipientUserId)
  }

  return `${routePaths.notifications}?${params.toString()}#notification-events`
}

function buildTemplateEditorPath(event: NotificationEvent) {
  const params = new URLSearchParams({
    templateChannel: event.channel,
    templateCode: event.templateCode,
    templateEditor: '1',
  })

  return `${routePaths.notifications}?${params.toString()}#notification-templates`
}

function buildNotificationAuditPath(event: NotificationEvent) {
  const params = new URLSearchParams({
    moduleCode: 'notifications',
    entityType: 'notification_event',
    entityId: event.eventId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function buildNotificationComposerPath(event: NotificationEvent) {
  const params = new URLSearchParams({
    channel: event.channel,
    recipientType: event.recipientType,
    targetType: 'USER',
    templateCode: event.templateCode,
  })

  if (event.recipientUserId) {
    params.set('recipientUserId', event.recipientUserId)
  }

  return `${routePaths.notifications}/new?${params.toString()}`
}

function RecipientPanel({ event }: { event: NotificationEvent }) {
  return (
    <SectionShell
      description="Recipient summary returned with the event."
      id={notificationSectionIds.recipient}
      icon={<UserRound className="size-4" />}
      title="Recipient"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <DetailField label="Recipient type" value={humanizeCode(event.recipientType)} />
        <DetailField label="Recipient user ID" value={event.recipientUserId} />
        <DetailField label="Mobile" value={event.recipient?.mobileNumber} />
        <DetailField label="Email" value={event.recipient?.email} />
        <DetailField label="User status" value={humanizeCode(event.recipient?.status)} />
        <DetailField label="User type" value={humanizeCode(event.recipient?.userType)} />
      </div>
    </SectionShell>
  )
}

function PayloadPanel({ event }: { event: NotificationEvent }) {
  return (
    <SectionShell
      description="Rendered notification payload and provider tracking."
      id={notificationSectionIds.payload}
      icon={channelIcon(event.channel)}
      title="Delivery payload"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <DetailField label="Template code" value={event.templateCode} />
        <DetailField label="Provider message ID" value={event.providerMessageId} />
        <DetailField label="Title" value={event.title ?? 'Not available'} />
        <DetailField label="Failure reason" value={event.failureReason} />
      </div>
      <pre className="mt-3 max-h-[24rem] overflow-auto whitespace-pre-wrap rounded-[0.75rem] border border-border bg-surface-muted/35 p-3 text-sm leading-6 text-foreground">
        {event.body}
      </pre>
    </SectionShell>
  )
}

function LifecyclePanel({ event }: { event: NotificationEvent }) {
  return (
    <SectionShell
      description="Delivery lifecycle timestamps returned by the admin API."
      id={notificationSectionIds.timeline}
      icon={<CalendarClock className="size-4" />}
      title="Timeline"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Created" value={formatDateSafe(event.createdAt)} />
        <DetailField label="Updated" value={formatDateSafe(event.updatedAt)} />
        <DetailField label="Sent" value={formatDateSafe(event.sentAt)} />
        <DetailField label="Read" value={formatDateSafe(event.readAt)} />
      </div>
    </SectionShell>
  )
}

function RetryPanel({ event }: { event: NotificationEvent }) {
  const retry = event.deliveryRetry

  return (
    <SectionShell
      description="Retry metadata is provider-controlled; no manual retry API is exposed here."
      id={notificationSectionIds.retry}
      icon={<RotateCcw className="size-4" />}
      title="Retry state"
    >
      {retry ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailField label="Attempt" value={`${retry.attemptNumber}/${retry.maxAttempts}`} />
          <DetailField
            label="State"
            value={retry.exhausted ? 'Exhausted' : 'Scheduled'}
          />
          <DetailField label="Next retry" value={formatDateSafe(retry.nextRetryAt)} />
          <DetailField label="Scheduled" value={formatDateSafe(retry.scheduledAt)} />
          <DetailField
            label="Last provider status"
            value={humanizeCode(retry.lastProviderStatus)}
          />
          <DetailField
            label="Last failure"
            value={humanizeCode(retry.lastFailureReason)}
          />
          <DetailField label="Backoff seconds" value={retry.backoffSeconds} />
        </div>
      ) : (
        <p className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3 text-sm text-muted">
          No retry metadata is attached to this delivery event.
        </p>
      )}
    </SectionShell>
  )
}

function SignalsPanel({
  canSendNotifications,
  event,
}: {
  canSendNotifications: boolean
  event: NotificationEvent
}) {
  const adminControls = canSendNotifications ? ['SEND_NEW_NOTIFICATION'] : []

  return (
    <SectionShell
      description="Backend delivery hints and controls available for this admin."
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
            items={event.warnings}
            tone={event.status === 'FAILED' ? 'danger' : 'warning'}
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Backend hints
          </p>
          <SignalBadgeGroup
            emptyLabel="No backend action"
            items={event.availableActions}
            tone="info"
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Available to you
          </p>
          <SignalBadgeGroup
            emptyLabel="No permitted controls"
            items={adminControls}
            tone="neutral"
          />
        </div>
      </div>
    </SectionShell>
  )
}

export function NotificationDetailPage() {
  const { notificationId } = useParams()
  const navigate = useNavigate()
  const canReadAudit = usePermission('audit:read')
  const canSendNotifications = usePermission('notifications:send')
  const canUpdateTemplates = usePermission('notifications:update')

  const eventQuery = useQuery({
    enabled: Boolean(notificationId),
    queryKey: ['notification-event', notificationId],
    queryFn: () => notificationService.getEvent(notificationId ?? ''),
  })

  const openSection = (sectionId: NotificationSectionId) => {
    const section = document.getElementById(sectionId)

    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (section) {
      window.history.replaceState(null, '', `#${sectionId}`)
    }
  }

  if (!notificationId) {
    return (
      <PageContainer>
        <ErrorState
          description="The notification event id is missing from this route."
          title="Notification unavailable"
        />
      </PageContainer>
    )
  }

  if (eventQuery.isLoading) {
    return <DetailSkeleton />
  }

  if (eventQuery.isError || !eventQuery.data?.data) {
    return (
      <PageContainer>
        <ErrorState
          description={
            eventQuery.error instanceof Error
              ? eventQuery.error.message
              : 'We could not load this notification event.'
          }
          title="Notification unavailable"
          onRetry={() => void eventQuery.refetch()}
        />
      </PageContainer>
    )
  }

  const event = eventQuery.data.data
  const retry = event.deliveryRetry
  const failed = event.status === 'FAILED'

  return (
    <PageContainer className="!px-3 !py-4 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={<HeaderActions canSendNotifications={canSendNotifications} />}
        description={`${humanizeCode(event.recipientType)} notification delivery event`}
        listHref={routePaths.notifications}
        listLabel="Notifications"
        recordName={event.templateCode}
        titleMetaNode={<HeaderStatus event={event} />}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<CheckCircle2 className="size-4" />}
          label="Status"
          meta={
            event.failureReason
              ? humanizeCode(event.failureReason)
              : 'Current delivery state'
          }
          tone={
            failed
              ? 'danger'
              : event.status === 'SENT'
                ? 'success'
                : event.status === 'SKIPPED'
                  ? 'neutral'
                  : 'warning'
          }
          value={humanizeCode(event.status)}
        />
        <SummaryCard
          icon={channelIcon(event.channel)}
          label="Channel"
          meta={event.providerMessageId ?? 'Provider message unavailable'}
          tone="info"
          value={event.channel}
        />
        <SummaryCard
          icon={<UserRound className="size-4" />}
          label="Recipient"
          meta={recipientLabel(event)}
          tone="neutral"
          value={humanizeCode(event.recipientType)}
        />
        <SummaryCard
          icon={<RotateCcw className="size-4" />}
          label="Retry"
          meta={
            retry?.nextRetryAt ? `Next ${formatDateSafe(retry.nextRetryAt)}` : 'No active retry'
          }
          tone={retry?.exhausted ? 'danger' : retry ? 'warning' : 'neutral'}
          value={retry ? `${retry.attemptNumber}/${retry.maxAttempts}` : 'None'}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <LifecyclePanel event={event} />
        <SignalsPanel canSendNotifications={canSendNotifications} event={event} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <div className="space-y-3">
          <PayloadPanel event={event} />
          <RecipientPanel event={event} />
          <RetryPanel event={event} />
        </div>
        <RelatedRecordsPanel
          canReadAudit={canReadAudit}
          canSendNotifications={canSendNotifications}
          canUpdateTemplates={canUpdateTemplates}
          event={event}
          onNavigate={navigate}
          onOpenSection={openSection}
        />
      </section>
    </PageContainer>
  )
}
