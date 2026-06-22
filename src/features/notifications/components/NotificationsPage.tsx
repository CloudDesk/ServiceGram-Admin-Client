import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellPlus, Pencil, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DynamicTable, TableSkeleton, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { routePaths } from '../../../config/routes'
import { useAuthStore } from '../../../store/authStore'
import { formatDate } from '../../../utils/formatDate'
import { notificationService } from '../services/notification.service'
import type {
  NotificationChannel,
  NotificationEvent,
  NotificationEventStatus,
  NotificationEventsQueryParams,
  NotificationRecipientType,
  NotificationTemplate,
  NotificationTemplatesQueryParams,
  UpdateNotificationTemplatePayload,
} from '../types/notification.types'

const DEFAULT_PAGE_SIZE = 20
const channels: NotificationChannel[] = ['PUSH', 'SMS', 'EMAIL']
const recipientTypes: NotificationRecipientType[] = ['CUSTOMER', 'VENDOR', 'ADMIN']
const statuses: NotificationEventStatus[] = ['QUEUED', 'SENT', 'FAILED', 'SKIPPED']

type ActiveFilter = '' | 'true' | 'false'

const templateColumns: DynamicTableColumn<NotificationTemplate>[] = [
  {
    key: 'templateCode',
    label: 'Template',
    minWidth: 280,
    renderCell: (template) => (
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{template.templateCode}</p>
        <p className="line-clamp-1 text-xs text-muted">{template.titleTemplate ?? 'No title template'}</p>
        <p className="line-clamp-1 text-xs text-muted">{template.bodyTemplate}</p>
      </div>
    ),
  },
  {
    key: 'channel',
    label: 'Channel',
    format: 'status',
    statusTone: 'info',
    minWidth: 120,
  },
  {
    key: 'isActive',
    label: 'State',
    minWidth: 120,
    renderCell: (template) => (
      <Badge tone={template.isActive ? 'success' : 'warning'}>
        {template.isActive ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    key: 'warnings',
    label: 'Warnings',
    minWidth: 180,
    renderCell: (template) =>
      template.warnings.length ? (
        <div className="flex flex-wrap gap-1">
          {template.warnings.map((warning) => (
            <Badge key={warning} tone="warning">
              {warning}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted">None</span>
      ),
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    minWidth: 180,
    renderCell: (template) => formatDate(template.updatedAt, true),
  },
]

const eventColumns: DynamicTableColumn<NotificationEvent>[] = [
  {
    key: 'templateCode',
    label: 'Event',
    minWidth: 280,
    renderCell: (event) => (
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{event.templateCode}</p>
        <p className="line-clamp-1 text-xs text-muted">{event.title ?? event.body}</p>
      </div>
    ),
  },
  {
    key: 'recipientType',
    label: 'Recipient',
    minWidth: 210,
    renderCell: (event) => (
      <div>
        <p className="font-medium text-foreground">{event.recipientType}</p>
        <p className="text-xs text-muted">
          {event.recipient?.mobileNumber ?? event.recipient?.email ?? event.recipientUserId ?? 'No recipient'}
        </p>
      </div>
    ),
  },
  {
    key: 'channel',
    label: 'Channel',
    format: 'status',
    statusTone: 'info',
    minWidth: 120,
  },
  {
    key: 'status',
    label: 'Status',
    format: 'status',
    statusTone: (value) =>
      value === 'SENT'
        ? 'success'
        : value === 'FAILED'
          ? 'danger'
          : value === 'SKIPPED'
            ? 'neutral'
            : 'warning',
    minWidth: 140,
  },
  {
    key: 'warnings',
    label: 'Warnings',
    minWidth: 220,
    renderCell: (event) =>
      event.warnings.length ? (
        <div className="flex flex-wrap gap-1">
          {event.warnings.slice(0, 2).map((warning) => (
            <Badge key={warning} tone={event.status === 'FAILED' ? 'danger' : 'warning'}>
              {warning}
            </Badge>
          ))}
          {event.warnings.length > 2 ? <Badge tone="neutral">+{event.warnings.length - 2}</Badge> : null}
        </div>
      ) : (
        <span className="text-muted">None</span>
      ),
  },
  {
    key: 'createdAt',
    label: 'Created',
    minWidth: 180,
    renderCell: (event) => formatDate(event.createdAt, true),
  },
]

function SummaryMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number | string
  tone?: 'danger' | 'info' | 'neutral' | 'success' | 'warning'
}) {
  return (
    <div className="rounded-control border border-border bg-background/40 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="mt-1">
        <Badge tone={tone}>{value}</Badge>
      </div>
    </div>
  )
}

function TemplateEditModal({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  template,
}: {
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (payload: UpdateNotificationTemplatePayload) => void
  template: NotificationTemplate
}) {
  const [bodyTemplate, setBodyTemplate] = useState(template.bodyTemplate)
  const [formError, setFormError] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(template.isActive)
  const [reason, setReason] = useState('')
  const [titleTemplate, setTitleTemplate] = useState(template.titleTemplate ?? '')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (bodyTemplate.trim().length < 1) {
      setFormError('Body template is required.')
      return
    }

    if (reason.trim().length < 5) {
      setFormError('Reason must be at least 5 characters.')
      return
    }

    onSubmit({
      titleTemplate: titleTemplate.trim() || null,
      bodyTemplate: bodyTemplate.trim(),
      isActive,
      reason: reason.trim(),
    })
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">Edit template</h2>
            <p className="mt-1 text-sm text-muted">{template.templateCode}</p>
          </div>
          <button
            aria-label="Close template editor"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Channel</span>
              <Input disabled value={template.channel} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">State</span>
              <select
                className="form-input"
                value={isActive ? 'active' : 'inactive'}
                onChange={(event) => setIsActive(event.target.value === 'active')}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Title template</span>
            <Input value={titleTemplate} onChange={(event) => setTitleTemplate(event.target.value)} />
            <span className="block text-right text-xs text-muted">{titleTemplate.length}/500</span>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Body template *</span>
            <textarea
              className="form-input min-h-32 resize-y"
              value={bodyTemplate}
              onChange={(event) => setBodyTemplate(event.target.value)}
            />
            <span className="block text-right text-xs text-muted">{bodyTemplate.length}/1000</span>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Reason *</span>
            <Input
              placeholder="Updating copy for clearer customer messaging"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          {formError || error ? (
            <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button disabled={isSubmitting} size="sm" type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button isLoading={isSubmitting} size="sm" type="submit">
              Save Template
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function NotificationsPage() {
  const can = useAuthStore((state) => state.can)
  const queryClient = useQueryClient()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [eventChannel, setEventChannel] = useState<'' | NotificationChannel>('')
  const [eventStatus, setEventStatus] = useState<'' | NotificationEventStatus>('')
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const [recipientType, setRecipientType] = useState<'' | NotificationRecipientType>('')
  const [recipientUserId, setRecipientUserId] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null)
  const [templateActive, setTemplateActive] = useState<ActiveFilter>('')
  const [templateActionError, setTemplateActionError] = useState<string | null>(null)
  const [templateChannel, setTemplateChannel] = useState<'' | NotificationChannel>('')
  const [templateCode, setTemplateCode] = useState('')
  const [templateSearch, setTemplateSearch] = useState('')

  const canSendNotifications = can('notifications:send')
  const canUpdateTemplates = can('notifications:update')

  const templateQueryParams = useMemo<NotificationTemplatesQueryParams>(
    () => ({
      search: templateSearch.trim() || undefined,
      channel: templateChannel || undefined,
      isActive: templateActive === '' ? undefined : templateActive === 'true',
    }),
    [templateActive, templateChannel, templateSearch],
  )

  const eventQueryParams = useMemo<NotificationEventsQueryParams>(
    () => ({
      page,
      limit,
      channel: eventChannel || undefined,
      recipientType: recipientType || undefined,
      status: eventStatus || undefined,
      templateCode: templateCode.trim() || undefined,
      recipientUserId: recipientUserId.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [dateFrom, dateTo, eventChannel, eventStatus, limit, page, recipientType, recipientUserId, templateCode],
  )

  const templatesQuery = useQuery({
    queryKey: ['notification-templates', templateQueryParams],
    queryFn: () => notificationService.getTemplates(templateQueryParams),
  })
  const eventsQuery = useQuery({
    queryKey: ['notification-events', eventQueryParams],
    queryFn: () => notificationService.getEvents(eventQueryParams),
  })
  const updateTemplateMutation = useMutation({
    mutationFn: ({
      payload,
      templateId,
    }: {
      payload: UpdateNotificationTemplatePayload
      templateId: string
    }) => notificationService.updateTemplate(templateId, payload),
    onSuccess: () => {
      setSelectedTemplate(null)
      setTemplateActionError(null)
      void queryClient.invalidateQueries({ queryKey: ['notification-templates'] })
      void queryClient.invalidateQueries({ queryKey: ['notification-events'] })
    },
    onError: (error) => {
      setTemplateActionError(error instanceof Error ? error.message : 'Template update failed.')
    },
  })

  const templates = templatesQuery.data?.data ?? []
  const events = eventsQuery.data?.data ?? []
  const eventSummary = eventsQuery.data?.summary
  const pagination = eventsQuery.data?.pagination
  const templateSummary = templatesQuery.data?.summary
  const isEventsLoading = eventsQuery.isLoading || eventsQuery.isFetching
  const resetEventsPage = () => setPage(1)

  return (
    <PageContainer>
      <PageContextHeader
        actionNode={
          canSendNotifications ? (
            <Link to={`${routePaths.notifications}/new`}>
              <Button size="sm">
                <BellPlus className="mr-2 size-4" />
                New Notification
              </Button>
            </Link>
          ) : (
            <Button disabled size="sm" title="Requires notifications:send">
              <BellPlus className="mr-2 size-4" />
              New Notification
            </Button>
          )
        }
        title="Notifications"
      />

      {!canSendNotifications ? <InlineAlert message="Your role can view notifications but cannot send them." /> : null}

      <section className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-3">
          <SummaryMetric label="Templates" value={templateSummary?.total ?? 0} />
          <SummaryMetric label="Active" value={templateSummary?.active ?? 0} tone="success" />
          <SummaryMetric label="Inactive" value={templateSummary?.inactive ?? 0} tone="warning" />
          {channels.map((channel) => (
            <SummaryMetric
              key={channel}
              label={channel}
              value={templateSummary?.byChannel[channel] ?? 0}
              tone="info"
            />
          ))}
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Template Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                className="pl-9"
                placeholder="OTP, order, payout"
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Template Channel</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={templateChannel}
              onChange={(event) => setTemplateChannel(event.target.value as '' | NotificationChannel)}
            >
              <option value="">All</option>
              {channels.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Template State</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={templateActive}
              onChange={(event) => setTemplateActive(event.target.value as ActiveFilter)}
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>

        {templatesQuery.isError ? (
          <ErrorState
            description={
              templatesQuery.error instanceof Error
                ? templatesQuery.error.message
                : 'We could not load notification templates.'
            }
            title="Templates unavailable"
            onRetry={() => void templatesQuery.refetch()}
          />
        ) : templatesQuery.isLoading || templatesQuery.isFetching ? (
          <TableSkeleton columns={templateColumns} hasActions rowCount={5} />
        ) : templates.length === 0 ? (
          <EmptyState description="No notification templates matched this filter." title="No templates" />
        ) : (
          <DynamicTable
            actionColumnMinWidth={130}
            bodyMaxHeight={360}
            columns={templateColumns}
            data={templates}
            inlineActionLimit={1}
            rowActions={(template) => [
              {
                key: 'edit-template',
                label: 'Edit',
                icon: <Pencil className="size-4" />,
                isDisabled: !canUpdateTemplates || !template.availableActions.includes('UPDATE_TEMPLATE'),
                onClick: (row) => {
                  setTemplateActionError(null)
                  setSelectedTemplate(row)
                },
                placement: 'inline',
              },
            ]}
            title="Templates"
            getRowId={(template) => template.templateId}
          />
        )}
      </section>

      <section className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-3">
          <SummaryMetric label="Events On Page" value={eventSummary?.total ?? 0} />
          {statuses.map((status) => (
            <SummaryMetric
              key={status}
              label={status}
              value={eventSummary?.byStatus[status] ?? 0}
              tone={status === 'FAILED' ? 'danger' : status === 'SENT' ? 'success' : 'neutral'}
            />
          ))}
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Template Code</span>
            <Input
              placeholder="ORDER_STATUS_UPDATE"
              value={templateCode}
              onChange={(event) => {
                setTemplateCode(event.target.value)
                resetEventsPage()
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Recipient User ID</span>
            <Input
              placeholder="UUID"
              value={recipientUserId}
              onChange={(event) => {
                setRecipientUserId(event.target.value)
                resetEventsPage()
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Status</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={eventStatus}
              onChange={(event) => {
                setEventStatus(event.target.value as '' | NotificationEventStatus)
                resetEventsPage()
              }}
            >
              <option value="">All</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Channel</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={eventChannel}
              onChange={(event) => {
                setEventChannel(event.target.value as '' | NotificationChannel)
                resetEventsPage()
              }}
            >
              <option value="">All</option>
              {channels.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Recipient</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={recipientType}
              onChange={(event) => {
                setRecipientType(event.target.value as '' | NotificationRecipientType)
                resetEventsPage()
              }}
            >
              <option value="">All</option>
              {recipientTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Date From</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value)
                resetEventsPage()
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Date To</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value)
                resetEventsPage()
              }}
            />
          </label>
        </div>

        {eventsQuery.isError ? (
          <ErrorState
            description={
              eventsQuery.error instanceof Error
                ? eventsQuery.error.message
                : 'We could not load notification delivery events.'
            }
            title="Events unavailable"
            onRetry={() => void eventsQuery.refetch()}
          />
        ) : isEventsLoading ? (
          <TableSkeleton columns={eventColumns} hasFooter={Boolean(pagination)} rowCount={8} />
        ) : events.length === 0 ? (
          <EmptyState description="No notification events matched this filter." title="No events" />
        ) : (
          <DynamicTable
            bodyMaxHeight={560}
            columns={eventColumns}
            data={events}
            pagination={
              pagination
                ? {
                    page: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    onPageChange: setPage,
                    onPageSizeChange: (nextLimit) => {
                      setLimit(nextLimit)
                      setPage(1)
                    },
                    rowsPerPageOptions: [10, 20, 50, 100],
                  }
                : undefined
            }
            title="Delivery Events"
            getRowId={(event) => event.eventId}
          />
        )}
      </section>

      {selectedTemplate ? (
        <TemplateEditModal
          key={selectedTemplate.templateId}
          error={templateActionError}
          isSubmitting={updateTemplateMutation.isPending}
          template={selectedTemplate}
          onClose={() => {
            if (!updateTemplateMutation.isPending) {
              setSelectedTemplate(null)
              setTemplateActionError(null)
            }
          }}
          onSubmit={(payload) =>
            updateTemplateMutation.mutate({
              payload,
              templateId: selectedTemplate.templateId,
            })
          }
        />
      ) : null}
    </PageContainer>
  )
}
