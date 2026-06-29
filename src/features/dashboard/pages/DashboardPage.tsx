import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EChartsCoreOption } from 'echarts/core'
import {
  ArrowUpRight,
  Bell,
  CircleDollarSign,
  CreditCard,
  Film,
  HandCoins,
  PackageSearch,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Users,
  Wrench,
} from 'lucide-react'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { buildPathWithQueryParams } from '../../../utils/buildQueryParams'
import { cn } from '../../../utils/cn'
import { DashboardChart } from '../components/DashboardChart'
import type {
  DashboardCard,
  DashboardChartItem,
  DashboardFinanceWidget,
  DashboardOrderMatrixRow,
  DashboardOrderDistributionRow,
  DashboardTrendPoint,
  DashboardQueue,
} from '../types/dashboard.types'
import { useDashboardData } from '../hooks/useDashboardData'

interface DrilldownTarget {
  canOpen: boolean
  label: string
  path: string
}

interface DashboardAccess {
  canReadCustomers: boolean
  canReadNotifications: boolean
  canReadOrders: boolean
  canReadPayments: boolean
  canReadPayouts: boolean
  canReadReels: boolean
  canReadVendors: boolean
}

const chartPalette = [
  '#0066cc',
  '#248a3d',
  '#b45309',
  '#ff3b30',
  '#5e5ce6',
  '#0f766e',
] as const

const orderStatusRouteAliases: Record<string, string> = {
  ACCEPTED: 'VENDOR_ACCEPTED',
  COMPLETED: 'SERVICE_COMPLETED',
  IN_PROGRESS: 'SERVICE_IN_PROGRESS',
  PLACED: 'ORDER_PLACED',
}

const orderPaymentStatusRouteAliases: Record<string, string> = {
  CAPTURED: 'PAID',
  SUCCESS: 'PAID',
}

const financeStatusRouteAliases: Record<string, Record<string, string>> = {
  PAYMENTS: {
    CAPTURED: 'SUCCESS',
    PAID: 'SUCCESS',
  },
  PAYOUTS: {
    ON_HOLD: 'HELD',
    SETTLED: 'PAID',
    SUCCESS: 'PAID',
  },
  REFUNDS: {
    REFUNDED: 'SUCCESS',
  },
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

function formatShortMoneyPaise(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 1,
    notation: 'compact',
    style: 'currency',
  }).format(value / 100)
}

function formatMoneyPaise(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value / 100)
}

function chartRoute(data: unknown) {
  if (!data || typeof data !== 'object' || !('routePath' in data)) return null

  const routePath = (data as { routePath?: unknown }).routePath
  return typeof routePath === 'string' ? routePath : null
}

function routeWithFilters(
  path: string,
  filters: Record<string, string | undefined>,
) {
  return buildPathWithQueryParams(path, filters)
}

function dayRangeFilters(value: string) {
  const date = value.slice(0, 10)

  return {
    dateFrom: date,
    dateTo: date,
  }
}

function vendorReviewPath() {
  return `${routeWithFilters(routePaths.vendorOnboarding, {
    onboardingStatus: 'UNDER_REVIEW',
  })}#vendor-onboarding-records`
}

function normalizeOrderRouteFilters(filters: Record<string, string>) {
  const nextFilters = { ...filters }

  if (nextFilters.orderStatus) {
    nextFilters.orderStatus =
      orderStatusRouteAliases[nextFilters.orderStatus] ?? nextFilters.orderStatus
  }

  if (nextFilters.paymentStatus) {
    nextFilters.paymentStatus =
      orderPaymentStatusRouteAliases[nextFilters.paymentStatus] ??
      nextFilters.paymentStatus
  }

  return nextFilters
}

function orderRouteWithFilters(filters: Record<string, string>) {
  return routeWithFilters(routePaths.orders, normalizeOrderRouteFilters(filters))
}

function normalizeFinanceStatus(widgetCode: string, status: string) {
  return financeStatusRouteAliases[widgetCode]?.[status] ?? status
}

function financeRouteWithStatus(widget: DashboardFinanceWidget, path: string, status: string) {
  return routeWithFilters(path, {
    status: normalizeFinanceStatus(widget.code, status),
  })
}

function localDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const date = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${date}`
}

function todayRangeFilters() {
  return dayRangeFilters(localDateKey(new Date()))
}

function chartItemsFromRecord(
  data: Record<string, number>,
  filterKey: 'orderStatus' | 'paymentStatus',
): DashboardChartItem[] {
  return Object.entries(data)
    .map(([code, count], index) => ({
      code,
      count,
      label: humanizeCode(code),
      routeFilter: { [filterKey]: code },
      severity: count > 0 ? ('ATTENTION' as const) : ('NORMAL' as const),
      sortOrder: index + 1,
    }))
    .sort((left, right) => right.count - left.count)
}

function formatRefreshTime(value: number) {
  if (!value) return 'Not refreshed yet'

  return `Last refreshed ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))}`
}

function toneClass(tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning') {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
}

function statusToneFromSeverity(severity: 'ATTENTION' | 'NORMAL'): StatusTone {
  return severity === 'ATTENTION' ? 'warning' : 'success'
}

function getCardIcon(code: string) {
  if (code.includes('CUSTOMER')) return <Users className="size-4" />
  if (code.includes('VENDOR')) return <Wrench className="size-4" />
  if (code.includes('ORDER')) return <PackageSearch className="size-4" />
  if (code.includes('REEL')) return <Film className="size-4" />
  if (code.includes('REFUND')) return <RotateCcw className="size-4" />
  if (code.includes('PAYOUT')) return <HandCoins className="size-4" />
  return <ShieldCheck className="size-4" />
}

function getQueueIcon(code: string) {
  if (code === 'VENDOR_ONBOARDING') return <Wrench className="size-4" />
  if (code === 'REEL_MODERATION') return <Film className="size-4" />
  if (code === 'REFUND_REVIEWS') return <RotateCcw className="size-4" />
  if (code === 'PAYOUT_HOLDS') return <HandCoins className="size-4" />
  if (code === 'FAILED_NOTIFICATIONS') return <Bell className="size-4" />
  return <ShieldAlert className="size-4" />
}

function getCardTarget(card: DashboardCard, access: DashboardAccess): DrilldownTarget | null {
  if (card.code === 'ACTIVE_CUSTOMERS') {
    return { canOpen: access.canReadCustomers, label: 'Customers', path: routePaths.customers }
  }

  if (card.code === 'ACTIVE_VENDORS') {
    return { canOpen: access.canReadVendors, label: 'Vendors', path: routePaths.vendors }
  }

  if (card.code === 'ACTIVE_ORDERS' || card.code === 'TODAY_ORDERS') {
    return {
      canOpen: access.canReadOrders,
      label: 'Orders',
      path:
        card.code === 'TODAY_ORDERS'
          ? routeWithFilters(routePaths.orders, todayRangeFilters())
          : routePaths.orders,
    }
  }

  if (card.code === 'PENDING_VENDOR_REVIEWS' || card.action === 'REVIEW_VENDORS') {
    return {
      canOpen: access.canReadVendors,
      label: 'Vendor onboarding',
      path: vendorReviewPath(),
    }
  }

  if (card.code === 'PENDING_REEL_REVIEWS' || card.action === 'REVIEW_REELS') {
    return {
      canOpen: access.canReadReels,
      label: 'Reels',
      path: routeWithFilters(routePaths.reels, {
        moderationStatus: 'PENDING_REVIEW',
        view: 'pending',
      }),
    }
  }

  if (card.code === 'PENDING_REFUNDS' || card.action === 'REVIEW_REFUNDS') {
    return {
      canOpen: access.canReadPayments,
      label: 'Refunds',
      path: routeWithFilters(routePaths.refunds, { status: 'REQUESTED' }),
    }
  }

  if (card.code === 'PAYOUT_HOLDS' || card.action === 'REVIEW_PAYOUTS') {
    return {
      canOpen: access.canReadPayouts,
      label: 'Payouts',
      path: routeWithFilters(routePaths.payouts, { status: 'HELD' }),
    }
  }

  return null
}

function getQueueTarget(queue: DashboardQueue, access: DashboardAccess): DrilldownTarget | null {
  if (queue.code === 'VENDOR_ONBOARDING') {
    return {
      canOpen: access.canReadVendors,
      label: 'Vendor onboarding',
      path: vendorReviewPath(),
    }
  }

  if (queue.code === 'REEL_MODERATION') {
    return {
      canOpen: access.canReadReels,
      label: 'Reels',
      path: routeWithFilters(routePaths.reels, {
        moderationStatus: 'PENDING_REVIEW',
        view: 'pending',
      }),
    }
  }

  if (queue.code === 'REFUND_REVIEWS') {
    return {
      canOpen: access.canReadPayments,
      label: 'Refunds',
      path: routeWithFilters(routePaths.refunds, { status: 'REQUESTED' }),
    }
  }

  if (queue.code === 'PAYOUT_HOLDS') {
    return {
      canOpen: access.canReadPayouts,
      label: 'Payouts',
      path: routeWithFilters(routePaths.payouts, { status: 'HELD' }),
    }
  }

  if (queue.code === 'FAILED_NOTIFICATIONS') {
    return {
      canOpen: access.canReadNotifications,
      label: 'Notifications',
      path: routeWithFilters(routePaths.notifications, { status: 'FAILED' }),
    }
  }

  return null
}

function getRecommendedActionTarget(
  action: string | null,
  access: DashboardAccess,
): DrilldownTarget | null {
  const normalized = action?.toUpperCase() ?? ''

  if (!normalized) return null

  if (normalized.includes('VENDOR')) {
    return {
      canOpen: access.canReadVendors,
      label: 'Vendor onboarding',
      path: vendorReviewPath(),
    }
  }

  if (normalized.includes('REEL')) {
    return {
      canOpen: access.canReadReels,
      label: 'Reels',
      path: routeWithFilters(routePaths.reels, {
        moderationStatus: 'PENDING_REVIEW',
        view: 'pending',
      }),
    }
  }

  if (normalized.includes('REFUND')) {
    return {
      canOpen: access.canReadPayments,
      label: 'Refunds',
      path: routeWithFilters(routePaths.refunds, { status: 'REQUESTED' }),
    }
  }

  if (normalized.includes('PAYOUT')) {
    return {
      canOpen: access.canReadPayouts,
      label: 'Payouts',
      path: routeWithFilters(routePaths.payouts, { status: 'HELD' }),
    }
  }

  if (normalized.includes('NOTIFICATION')) {
    return {
      canOpen: access.canReadNotifications,
      label: 'Notifications',
      path: routeWithFilters(routePaths.notifications, { status: 'FAILED' }),
    }
  }

  if (normalized.includes('PAYMENT')) {
    return {
      canOpen: access.canReadPayments,
      label: 'Payments',
      path: routePaths.payments,
    }
  }

  if (normalized.includes('ORDER')) {
    return {
      canOpen: access.canReadOrders,
      label: 'Orders',
      path: routePaths.orders,
    }
  }

  return null
}

function getFinanceTarget(widget: DashboardFinanceWidget, access: DashboardAccess) {
  if (widget.code === 'PAYMENTS') {
    return { canOpen: access.canReadPayments, label: 'Payments', path: routePaths.payments }
  }

  if (widget.code === 'REFUNDS') {
    return { canOpen: access.canReadPayments, label: 'Refunds', path: routePaths.refunds }
  }

  if (widget.code === 'PAYOUTS') {
    return { canOpen: access.canReadPayouts, label: 'Payouts', path: routePaths.payouts }
  }

  return null
}

function SectionShell({
  actionNode,
  children,
  description,
  icon,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  icon?: ReactNode
  title: string
}) {
  return (
    <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
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

function KpiCard({
  card,
  onOpen,
  target,
}: {
  card: DashboardCard
  onOpen: (path: string) => void
  target: DrilldownTarget | null
}) {
  const tone = statusToneFromSeverity(card.severity)
  const canOpen = Boolean(target?.canOpen)

  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-xs font-semibold uppercase tracking-normal', toneClass(tone))}>
            {card.label}
          </p>
          <p className="mt-1 truncate text-xs text-muted">{card.code}</p>
        </div>
        <span className={toneClass(tone)}>{getCardIcon(card.code)}</span>
      </div>
      <p className={cn('mt-3 text-3xl font-semibold tracking-normal', toneClass(tone))}>
        {card.value}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge tone={tone}>{card.severity === 'ATTENTION' ? 'Needs review' : 'Normal'}</Badge>
        {target ? (
          <Button
            disabled={!canOpen}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => {
              if (target.canOpen) onOpen(target.path)
            }}
          >
            <ArrowUpRight className="mr-2 size-4" />
            {target.canOpen ? target.label : 'No access'}
          </Button>
        ) : null}
      </div>
    </article>
  )
}

function QueuePanel({
  access,
  onOpen,
  queues,
}: {
  access: DashboardAccess
  onOpen: (path: string) => void
  queues: DashboardQueue[]
}) {
  const queueChartOption = useMemo<EChartsCoreOption>(() => {
    const chartQueues = [...queues].sort((left, right) => left.count - right.count)

    return {
      aria: { enabled: true },
      color: [chartPalette[2]],
      grid: { bottom: 12, containLabel: true, left: 4, right: 12, top: 8 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        axisLabel: { color: '#86868b' },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
        type: 'value',
      },
      yAxis: {
        axisLabel: { color: '#1d1d1f' },
        data: chartQueues.map((queue) => queue.label),
        type: 'category',
      },
      series: [
        {
          barMaxWidth: 18,
          data: chartQueues.map((queue) => {
            const target = getQueueTarget(queue, access)
            const routePath =
              target?.canOpen && queue.availableActions.includes('OPEN_QUEUE')
                ? target.path
                : undefined

            return {
              itemStyle: {
                borderRadius: [0, 5, 5, 0],
                color: queue.count > 0 ? chartPalette[2] : '#d1d5db',
              },
              routePath,
              value: queue.count,
            }
          }),
          name: 'Waiting',
          type: 'bar',
        },
      ],
    }
  }, [access, queues])

  return (
    <SectionShell
      description="Backend review queues. Counts are returned directly by the dashboard API."
      icon={<ShieldAlert className="size-4" />}
      title="Review queues"
    >
      <DashboardChart
        className="mb-3 h-60 min-h-60"
        option={queueChartOption}
        onChartClick={(event) => {
          const routePath = chartRoute(event.data)
          if (routePath) onOpen(routePath)
        }}
      />
      <div className="divide-y divide-border">
        {queues.map((queue) => {
          const target = getQueueTarget(queue, access)
          const canOpen = Boolean(
            target?.canOpen && queue.availableActions.includes('OPEN_QUEUE'),
          )

          return (
            <div
              className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              key={queue.code}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className={cn('mt-0.5', queue.count > 0 ? 'text-warning' : 'text-muted')}>
                  {getQueueIcon(queue.code)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{queue.label}</p>
                    <Badge tone={statusToneFromSeverity(queue.severity)}>
                      {queue.count}
                    </Badge>
                  </div>
                  <p className="mt-1 break-words text-xs text-muted">
                    {queue.count === 1
                      ? '1 backend item waiting'
                      : `${queue.count} backend items waiting`}
                  </p>
                </div>
              </div>
              {target ? (
                <Button
                  disabled={!canOpen}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (canOpen) onOpen(target.path)
                  }}
                >
                  <ArrowUpRight className="mr-2 size-4" />
                  {canOpen ? target.label : 'No access'}
                </Button>
              ) : (
                <Badge tone="neutral">No route</Badge>
              )}
            </div>
          )
        })}
      </div>
    </SectionShell>
  )
}

function FinancePanel({
  access,
  permitted,
  warnings,
  widgets,
  onOpen,
}: {
  access: DashboardAccess
  permitted: boolean
  warnings: string[]
  widgets: DashboardFinanceWidget[]
  onOpen: (path: string) => void
}) {
  const financeChartOption = useMemo<EChartsCoreOption>(() => {
    const statusCodes = Array.from(
      new Set(
        widgets.flatMap((widget) =>
          widget.statusItems?.length
            ? widget.statusItems.map((item) => item.code)
            : Object.keys(widget.byStatus),
        ),
      ),
    )

    return {
      aria: { enabled: true },
      color: [...chartPalette],
      grid: { bottom: 24, containLabel: true, left: 8, right: 8, top: 12 },
      legend: {
        bottom: 0,
        icon: 'circle',
        textStyle: { color: '#86868b', fontSize: 11 },
      },
      tooltip: { trigger: 'axis' },
      xAxis: {
        axisLabel: { color: '#1d1d1f' },
        data: widgets.map((widget) => humanizeCode(widget.code)),
        type: 'category',
      },
      yAxis: {
        axisLabel: { color: '#86868b' },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
        type: 'value',
      },
      series: statusCodes.map((status) => ({
        data: widgets.map((widget) => {
          const target = getFinanceTarget(widget, access)

          return {
            routePath: target?.canOpen
              ? financeRouteWithStatus(widget, target.path, status)
              : undefined,
            value: widget.byStatus[status]?.count ?? 0,
          }
        }),
        emphasis: { focus: 'series' },
        name: humanizeCode(status),
        stack: 'finance-status',
        type: 'bar',
      })),
    }
  }, [access, widgets])

  if (!permitted) {
    return (
      <SectionShell
        description="Finance dashboard data is hidden by the backend for this admin."
        icon={<CircleDollarSign className="size-4" />}
        title="Finance"
      >
        <div className="rounded-[0.75rem] border border-warning/20 bg-warning/5 p-3 text-sm text-warning">
          {warnings.length ? warnings.map(humanizeCode).join(', ') : 'Finance permission required'}
        </div>
      </SectionShell>
    )
  }

  return (
    <SectionShell
      description="Finance widgets returned when the backend permits finance visibility."
      icon={<CircleDollarSign className="size-4" />}
      title="Finance"
    >
      <DashboardChart
        className="mb-3 h-64 min-h-64"
        option={financeChartOption}
        onChartClick={(event) => {
          const routePath = chartRoute(event.data)
          if (routePath) onOpen(routePath)
        }}
      />
      <div className="grid gap-3 lg:grid-cols-3">
        {widgets.map((widget) => {
          const target = getFinanceTarget(widget, access)
          const statusItems = widget.statusItems?.length
            ? widget.statusItems.map((item) => ({
                count: item.count,
                status: item.code,
              }))
            : Object.entries(widget.byStatus).map(([status, item]) => ({
                count: item.count,
                status,
              }))

          return (
            <article
              className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3"
              key={widget.code}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                    {humanizeCode(widget.code)}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {widget.totalCount}
                  </p>
                  <p className="text-sm text-muted">
                    {formatMoneyPaise(widget.totalAmountPaise)}
                  </p>
                </div>
                <CreditCard className="size-4 text-primary" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {statusItems.map((item) => {
                  const routePath = target?.canOpen
                    ? financeRouteWithStatus(widget, target.path, item.status)
                    : null

                  return (
                    <button
                      className={cn(
                        'inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition',
                        item.count > 0
                          ? 'border-warning/30 bg-warning/10 text-warning hover:border-warning/60'
                          : 'border-border bg-surface text-muted hover:border-primary/35',
                        !routePath && 'cursor-not-allowed opacity-60 hover:border-border',
                      )}
                      disabled={!routePath}
                      key={item.status}
                      type="button"
                      onClick={() => {
                        if (routePath) onOpen(routePath)
                      }}
                    >
                      <span>{humanizeCode(item.status)}</span>
                      <span>{item.count}</span>
                    </button>
                  )
                })}
              </div>
              {target ? (
                <Button
                  className="mt-3 w-full"
                  disabled={!target.canOpen}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (target.canOpen) onOpen(target.path)
                  }}
                >
                  <ArrowUpRight className="mr-2 size-4" />
                  {target.canOpen ? target.label : 'No access'}
                </Button>
              ) : null}
            </article>
          )
        })}
      </div>
    </SectionShell>
  )
}

function OrdersPanel({
  canReadOrders,
  byPaymentStatus,
  byStatus,
  matrixRows,
  paymentStatusItems,
  rows,
  statusItems,
  onOpen,
}: {
  canReadOrders: boolean
  byPaymentStatus: Record<string, number>
  byStatus: Record<string, number>
  matrixRows?: DashboardOrderMatrixRow[]
  paymentStatusItems?: DashboardChartItem[]
  rows: DashboardOrderDistributionRow[]
  statusItems?: DashboardChartItem[]
  onOpen: (path: string) => void
}) {
  const resolvedStatusItems = useMemo(
    () => statusItems?.length ? statusItems : chartItemsFromRecord(byStatus, 'orderStatus'),
    [byStatus, statusItems],
  )
  const resolvedPaymentItems = useMemo(
    () =>
      paymentStatusItems?.length
        ? paymentStatusItems
        : chartItemsFromRecord(byPaymentStatus, 'paymentStatus'),
    [byPaymentStatus, paymentStatusItems],
  )
  const resolvedMatrixRows = useMemo<DashboardOrderMatrixRow[]>(
    () =>
      matrixRows?.length
        ? matrixRows
        : rows.map((row) => ({
            count: row.count,
            orderStatus: row.orderStatus,
            orderStatusLabel: humanizeCode(row.orderStatus),
            paymentStatus: row.paymentStatus,
            paymentStatusLabel: humanizeCode(row.paymentStatus),
            routeFilter: {
              orderStatus: row.orderStatus,
              paymentStatus: row.paymentStatus,
            },
            severity: row.count > 0 ? 'ATTENTION' : 'NORMAL',
          })),
    [matrixRows, rows],
  )
  const orderStatusOption = useMemo<EChartsCoreOption>(
    () => ({
      aria: { enabled: true },
      color: [chartPalette[0]],
      grid: { bottom: 12, containLabel: true, left: 4, right: 12, top: 8 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        axisLabel: { color: '#86868b' },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
        type: 'value',
      },
      yAxis: {
        axisLabel: { color: '#1d1d1f' },
        data: [...resolvedStatusItems].reverse().map((item) => item.label),
        type: 'category',
      },
      series: [
        {
          barMaxWidth: 18,
          data: [...resolvedStatusItems].reverse().map((item) => ({
            itemStyle: { borderRadius: [0, 5, 5, 0] },
            routePath: orderRouteWithFilters(item.routeFilter),
            value: item.count,
          })),
          name: 'Orders',
          type: 'bar',
        },
      ],
    }),
    [resolvedStatusItems],
  )
  const paymentStatusOption = useMemo<EChartsCoreOption>(
    () => ({
      aria: { enabled: true },
      color: [...chartPalette],
      legend: {
        bottom: 0,
        icon: 'circle',
        textStyle: { color: '#86868b', fontSize: 11 },
      },
      series: [
        {
          data: resolvedPaymentItems.map((item) => ({
            name: item.label,
            routePath: orderRouteWithFilters(item.routeFilter),
            value: item.count,
          })),
          emphasis: { label: { show: true } },
          label: { formatter: '{b}: {c}' },
          name: 'Payment status',
          radius: ['48%', '72%'],
          type: 'pie',
        },
      ],
      tooltip: { trigger: 'item' },
    }),
    [resolvedPaymentItems],
  )
  const matrixOption = useMemo<EChartsCoreOption>(() => {
    const orderLabels = Array.from(
      new Map(
        resolvedMatrixRows.map((row) => [row.orderStatus, row.orderStatusLabel]),
      ).values(),
    )
    const paymentLabels = Array.from(
      new Map(
        resolvedMatrixRows.map((row) => [row.paymentStatus, row.paymentStatusLabel]),
      ).values(),
    )
    const maxCount = Math.max(1, ...resolvedMatrixRows.map((row) => row.count))

    return {
      aria: { enabled: true },
      grid: { bottom: 24, containLabel: true, left: 8, right: 8, top: 8 },
      tooltip: { position: 'top' },
      visualMap: {
        calculable: false,
        inRange: { color: ['#f5f5f7', '#80bfff', chartPalette[0]] },
        max: maxCount,
        min: 0,
        show: false,
      },
      xAxis: {
        axisLabel: { color: '#86868b', interval: 0 },
        data: paymentLabels,
        splitArea: { show: true },
        type: 'category',
      },
      yAxis: {
        axisLabel: { color: '#1d1d1f' },
        data: orderLabels,
        splitArea: { show: true },
        type: 'category',
      },
      series: [
        {
          data: resolvedMatrixRows.map((row) => ({
            routePath: orderRouteWithFilters(row.routeFilter),
            value: [
              paymentLabels.indexOf(row.paymentStatusLabel),
              orderLabels.indexOf(row.orderStatusLabel),
              row.count,
            ],
          })),
          emphasis: {
            itemStyle: {
              borderColor: '#1d1d1f',
              borderWidth: 1,
            },
          },
          name: 'Order payment matrix',
          type: 'heatmap',
        },
      ],
    }
  }, [resolvedMatrixRows])

  return (
    <SectionShell
      actionNode={
        <Button
          disabled={!canReadOrders}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => {
            if (canReadOrders) onOpen(routePaths.orders)
          }}
        >
          <ArrowUpRight className="mr-2 size-4" />
          {canReadOrders ? 'Orders' : 'No access'}
        </Button>
      }
      description="Order and payment status distributions returned by the dashboard API."
      icon={<PackageSearch className="size-4" />}
      title="Order health"
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
        <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Order status
          </p>
          <DashboardChart
            className="mt-2 h-72 min-h-72"
            option={orderStatusOption}
            onChartClick={(event) => {
              const routePath = chartRoute(event.data)
              if (routePath && canReadOrders) onOpen(routePath)
            }}
          />
        </div>
        <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Payment status
          </p>
          <DashboardChart
            className="mt-2 h-72 min-h-72"
            option={paymentStatusOption}
            onChartClick={(event) => {
              const routePath = chartRoute(event.data)
              if (routePath && canReadOrders) onOpen(routePath)
            }}
          />
        </div>
      </div>
      <div className="mt-3 rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted">
          Order x payment grid
        </p>
        <DashboardChart
          className="mt-2 h-80 min-h-80"
          option={matrixOption}
          onChartClick={(event) => {
            const routePath = chartRoute(event.data)
            if (routePath && canReadOrders) onOpen(routePath)
          }}
        />
      </div>
      {rows.length ? (
        <div className="mt-3 overflow-hidden rounded-[0.75rem] border border-border">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem] gap-3 bg-surface-muted px-3 py-2 text-xs font-semibold uppercase tracking-normal text-muted">
            <span>Order</span>
            <span>Payment</span>
            <span className="text-right">Count</span>
          </div>
          <div className="divide-y divide-border">
            {rows.slice(0, 8).map((row) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem] gap-3 px-3 py-2 text-sm"
                key={`${row.orderStatus}-${row.paymentStatus}`}
              >
                <span className="truncate text-foreground">{humanizeCode(row.orderStatus)}</span>
                <span className="truncate text-muted">{humanizeCode(row.paymentStatus)}</span>
                <span className="text-right font-semibold text-foreground">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </SectionShell>
  )
}

function TrendsPanel({
  canReadOrders,
  canReadPayments,
  points,
  onOpen,
}: {
  canReadOrders: boolean
  canReadPayments: boolean
  points: DashboardTrendPoint[]
  onOpen: (path: string) => void
}) {
  const trendOption = useMemo<EChartsCoreOption>(
    () => ({
      aria: { enabled: true },
      color: [chartPalette[0], chartPalette[1], chartPalette[2]],
      grid: { bottom: 28, containLabel: true, left: 8, right: 36, top: 20 },
      legend: {
        bottom: 0,
        icon: 'circle',
        textStyle: { color: '#86868b', fontSize: 11 },
      },
      tooltip: {
        trigger: 'axis',
      },
      xAxis: {
        axisLabel: { color: '#86868b', hideOverlap: true },
        boundaryGap: false,
        data: points.map((point) => point.label),
        type: 'category',
      },
      yAxis: [
        {
          axisLabel: { color: '#86868b' },
          name: 'Orders',
          splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
          type: 'value',
        },
        {
          axisLabel: {
            color: '#86868b',
            formatter: (value: number) => formatShortMoneyPaise(value),
          },
          name: 'Value',
          splitLine: { show: false },
          type: 'value',
        },
      ],
      series: [
        {
          areaStyle: { opacity: 0.08 },
          data: points.map((point) => ({
            routePath: routeWithFilters(routePaths.orders, dayRangeFilters(point.bucketStart)),
            value: point.ordersCreated,
          })),
          name: 'Orders created',
          smooth: true,
          symbolSize: 5,
          type: 'line',
        },
        {
          data: points.map((point) => ({
            routePath: routeWithFilters(routePaths.orders, {
              ...dayRangeFilters(point.bucketStart),
              orderStatus: 'DELIVERED',
            }),
            value: point.ordersDelivered,
          })),
          name: 'Delivered',
          smooth: true,
          symbolSize: 5,
          type: 'line',
        },
        {
          data: points.map((point) => ({
            routePath: routeWithFilters(routePaths.payments, dayRangeFilters(point.bucketStart)),
            value: point.paymentAmountPaise,
          })),
          name: 'Payment value',
          smooth: true,
          symbolSize: 5,
          type: 'line',
          yAxisIndex: 1,
        },
      ],
    }),
    [points],
  )

  return (
    <SectionShell
      actionNode={
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!canReadOrders}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => {
              if (canReadOrders) onOpen(routePaths.orders)
            }}
          >
            <ArrowUpRight className="mr-2 size-4" />
            Orders
          </Button>
          <Button
            disabled={!canReadPayments}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => {
              if (canReadPayments) onOpen(routePaths.payments)
            }}
          >
            <ArrowUpRight className="mr-2 size-4" />
            Payments
          </Button>
        </div>
      }
      description="30-day backend-bucketed order and payment trends."
      icon={<PackageSearch className="size-4" />}
      title="Operational trend"
    >
      <DashboardChart
        className="h-80 min-h-80"
        option={trendOption}
        onChartClick={(event) => {
          const routePath = chartRoute(event.data)
          if (!routePath) return
          if (routePath.startsWith(routePaths.payments) && !canReadPayments) return
          if (routePath.startsWith(routePaths.orders) && !canReadOrders) return
          onOpen(routePath)
        }}
      />
    </SectionShell>
  )
}

function SignalsPanel({
  access,
  alerts,
  loadedAt,
  nextRecommendedAction,
  onOpen,
  scopeType,
  zoneIds,
}: {
  access: DashboardAccess
  alerts: string[]
  loadedAt: string
  nextRecommendedAction: string | null
  onOpen: (path: string) => void
  scopeType: string
  zoneIds: string[]
}) {
  const recommendedTarget = getRecommendedActionTarget(
    nextRecommendedAction,
    access,
  )

  return (
    <SectionShell
      description="Backend signals returned with dashboard summary."
      icon={<TriangleAlert className="size-4" />}
      title="Signals"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Alerts
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {alerts.length ? (
              alerts.map((alert) => (
                <Badge key={alert} tone="warning">
                  {humanizeCode(alert)}
                </Badge>
              ))
            ) : (
              <Badge tone="success">No alerts</Badge>
            )}
          </div>
        </div>
        <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Scope
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">{humanizeCode(scopeType)}</p>
          <p className="mt-1 break-words text-xs text-muted">
            {zoneIds.length ? `${zoneIds.length} zone scope(s)` : 'All platform zones'}
          </p>
        </div>
        <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Next action
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {nextRecommendedAction ? humanizeCode(nextRecommendedAction) : 'No backend recommendation'}
          </p>
          {recommendedTarget ? (
            <Button
              className="mt-3"
              disabled={!recommendedTarget.canOpen}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => {
                if (recommendedTarget.canOpen) onOpen(recommendedTarget.path)
              }}
            >
              <ArrowUpRight className="mr-2 size-4" />
              {recommendedTarget.canOpen ? recommendedTarget.label : 'No access'}
            </Button>
          ) : null}
        </div>
        <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Loaded
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {new Intl.DateTimeFormat(undefined, {
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
            }).format(new Date(loadedAt))}
          </p>
        </div>
      </div>
    </SectionShell>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton className="h-36 rounded-[0.875rem]" key={index} />
        ))}
      </section>
      <Skeleton className="h-80 rounded-[0.875rem]" />
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const dashboardQuery = useDashboardData()
  const canReadCustomers = usePermission('customers:read')
  const canReadNotifications = usePermission('notifications:read')
  const canReadOrders = usePermission('orders:read')
  const canReadPayments = usePermission('payments:read')
  const canReadPayouts = usePermission('payouts:read')
  const canReadReels = usePermission('reels:read')
  const canReadVendors = usePermission('vendors:read')
  const access = useMemo<DashboardAccess>(
    () => ({
      canReadCustomers,
      canReadNotifications,
      canReadOrders,
      canReadPayments,
      canReadPayouts,
      canReadReels,
      canReadVendors,
    }),
    [
      canReadCustomers,
      canReadNotifications,
      canReadOrders,
      canReadPayments,
      canReadPayouts,
      canReadReels,
      canReadVendors,
    ],
  )
  const isRefreshing = dashboardQuery.isFetching && !dashboardQuery.isLoading
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing...'
    : formatRefreshTime(dashboardQuery.dataUpdatedAt)
  const data = dashboardQuery.data

  return (
    <PageContainer className="!px-3 !py-4 sm:!px-4 lg:!px-6">
      <PageContextHeader
        description="Operational dashboard using backend-provided summaries, queues, and warnings."
        placement="topbar"
        title="Dashboard"
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className={cn('text-xs font-medium', isRefreshing ? 'text-primary' : 'text-muted')}>
          {refreshStatusLabel}
        </span>
        <Button
          disabled={dashboardQuery.isLoading}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => void dashboardQuery.refetch()}
        >
          <RefreshCcw
            className={cn(
              'mr-2 size-4',
              isRefreshing && 'animate-spin motion-reduce:animate-none',
            )}
          />
          Refresh
        </Button>
      </div>

      {dashboardQuery.isLoading ? <DashboardSkeleton /> : null}

      {dashboardQuery.isError ? (
        <ErrorState
          description="We could not load the dashboard right now. Please refresh and try again."
          title="Unable to load dashboard"
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : null}

      {data ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {data.summary.cards.map((card) => (
              <KpiCard
                card={card}
                key={card.code}
                target={getCardTarget(card, access)}
                onOpen={navigate}
              />
            ))}
          </section>

          <TrendsPanel
            canReadOrders={canReadOrders}
            canReadPayments={canReadPayments}
            points={data.trends.points}
            onOpen={navigate}
          />

          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
            <OrdersPanel
              byPaymentStatus={data.orders.byPaymentStatus}
              byStatus={data.orders.byStatus}
              canReadOrders={canReadOrders}
              matrixRows={data.orders.matrixRows}
              paymentStatusItems={data.orders.paymentStatusItems}
              rows={data.orders.rows}
              statusItems={data.orders.statusItems}
              onOpen={navigate}
            />
            <SignalsPanel
              access={access}
              alerts={data.summary.alerts}
              loadedAt={data.loadedAt}
              nextRecommendedAction={
                data.reviewQueues.nextRecommendedAction ??
                data.summary.nextRecommendedAction
              }
              onOpen={navigate}
              scopeType={data.summary.scope.type}
              zoneIds={data.summary.scope.zoneIds}
            />
          </section>

          <section className="grid gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <QueuePanel
              access={access}
              queues={data.reviewQueues.queues}
              onOpen={navigate}
            />
            <FinancePanel
              access={access}
              permitted={data.finance.permitted}
              warnings={data.finance.warnings}
              widgets={data.finance.widgets}
              onOpen={navigate}
            />
          </section>
        </>
      ) : null}
    </PageContainer>
  )
}
