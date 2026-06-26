import { BellPlus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useAuthStore } from '../../../store/authStore'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { notificationService } from '../services/notification.service'
import type {
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
  return formatDate(value, true)
}

function statusTone(status: NotificationEventStatus): StatusTone {
  if (status === 'SENT') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'QUEUED') return 'warning'
  return 'neutral'
}

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
  value: string | number | null | undefined
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/35 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </p>
    </div>
  )
}

function SummaryCard({
  label,
  meta,
  tone,
  value,
}: {
  label: string
  meta: string
  tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning'
  value: string
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <p className={cn('text-xs font-semibold uppercase tracking-normal', toneClass(tone))}>
        {label}
      </p>
      <p className={cn('mt-3 text-2xl font-semibold tracking-normal', toneClass(tone))}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function SectionShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode
  description?: string
  title: string
}) {
  return (
    <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
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

export function NotificationDetailPage() {
  const { notificationId } = useParams()
  const can = useAuthStore((state) => state.can)
  const canSendNotifications = can('notifications:send')

  const eventQuery = useQuery({
    enabled: Boolean(notificationId),
    queryKey: ['notification-event', notificationId],
    queryFn: () => notificationService.getEvent(notificationId ?? ''),
  })

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
    <PageContainer>
      <DetailPageHeader
        actionNode={
          canSendNotifications ? (
            <Link to={`${routePaths.notifications}/new`}>
              <Button size="sm" type="button" variant="secondary">
                <BellPlus className="mr-2 size-4" />
                New Notification
              </Button>
            </Link>
          ) : null
        }
        description={`${humanizeCode(event.recipientType)} notification delivery event`}
        listHref={routePaths.notifications}
        listLabel="Notifications"
        recordName={event.templateCode}
        titleMetaNode={<HeaderStatus event={event} />}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Status"
          meta={event.failureReason ? humanizeCode(event.failureReason) : 'Current delivery state'}
          tone={failed ? 'danger' : event.status === 'SENT' ? 'success' : 'warning'}
          value={humanizeCode(event.status)}
        />
        <SummaryCard
          label="Channel"
          meta={event.providerMessageId ?? 'Provider message unavailable'}
          tone="info"
          value={event.channel}
        />
        <SummaryCard
          label="Recipient"
          meta={recipientLabel(event)}
          tone="neutral"
          value={humanizeCode(event.recipientType)}
        />
        <SummaryCard
          label="Retry"
          meta={retry?.nextRetryAt ? `Next ${formatDateSafe(retry.nextRetryAt)}` : 'No active retry'}
          tone={retry?.exhausted ? 'danger' : retry ? 'warning' : 'neutral'}
          value={retry ? `${retry.attemptNumber}/${retry.maxAttempts}` : 'None'}
        />
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(21rem,0.65fr)]">
        <div className="space-y-3">
          <SectionShell
            description="Rendered notification payload and provider tracking."
            title="Delivery payload"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label="Template code" value={event.templateCode} />
              <DetailField label="Provider message ID" value={event.providerMessageId} />
              <DetailField label="Title" value={event.title} />
              <DetailField label="Failure reason" value={event.failureReason} />
              <div className="md:col-span-2">
                <DetailField label="Body" value={event.body} />
              </div>
            </div>
          </SectionShell>

          <SectionShell
            description="Recipient summary returned with the event."
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
        </div>

        <div className="space-y-3">
          <SectionShell title="Timeline">
            <div className="grid gap-3">
              <DetailField label="Created" value={formatDateSafe(event.createdAt)} />
              <DetailField label="Updated" value={formatDateSafe(event.updatedAt)} />
              <DetailField label="Sent" value={formatDateSafe(event.sentAt)} />
              <DetailField label="Read" value={formatDateSafe(event.readAt)} />
            </div>
          </SectionShell>

          <SectionShell
            description="Operational warnings, available next actions, and retry metadata."
            title="Signals"
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Warnings
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {event.warnings.length > 0 ? (
                    event.warnings.map((warning) => (
                      <Badge key={warning} tone={failed ? 'danger' : 'warning'}>
                        {humanizeCode(warning)}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="success">No warnings</Badge>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Available actions
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {event.availableActions.length > 0 ? (
                    event.availableActions.map((action) => (
                      <Badge key={action} tone="info">
                        {humanizeCode(action)}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="neutral">No action</Badge>
                  )}
                </div>
              </div>

              {retry ? (
                <div className="grid gap-3">
                  <DetailField
                    label="Last provider status"
                    value={humanizeCode(retry.lastProviderStatus)}
                  />
                  <DetailField
                    label="Last failure"
                    value={humanizeCode(retry.lastFailureReason)}
                  />
                  <DetailField label="Scheduled" value={formatDateSafe(retry.scheduledAt)} />
                  <DetailField label="Backoff seconds" value={retry.backoffSeconds} />
                </div>
              ) : null}
            </div>
          </SectionShell>
        </div>
      </div>
    </PageContainer>
  )
}
