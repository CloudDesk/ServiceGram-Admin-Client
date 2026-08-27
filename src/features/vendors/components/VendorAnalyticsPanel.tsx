import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  CalendarClock,
  CircleDollarSign,
  Eye,
  RotateCcw,
  ShoppingBag,
  UsersRound,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { formatMoney } from '../../../utils/formatMoney'
import { vendorService } from '../services/vendor.service'
import type {
  VendorAnalyticsOverview,
  VendorAnalyticsPeriod,
} from '../types/vendor.types'

const periods: { label: string; value: VendorAnalyticsPeriod }[] = [
  { label: '7 days', value: '7D' },
  { label: '30 days', value: '30D' },
  { label: '90 days', value: '90D' },
  { label: 'This month', value: 'THIS_MONTH' },
]

function numberValue(value: unknown) {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : 0
}

function money(value: unknown) {
  return formatMoney(numberValue(value) / 100)
}

function percent(value: unknown) {
  return `${numberValue(value).toFixed(1)}%`
}

function change(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return 'No earlier baseline'
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShoppingBag
  label: string
  value: string
}) {
  return (
    <div className="min-h-28 rounded-[1rem] border border-border bg-surface p-4">
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <p className="mt-4 truncate text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 border-b border-border/70 py-2 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

function TrendBars({ data }: { data: VendorAnalyticsOverview['orders']['daily'] }) {
  const visible = data.slice(-21)
  const maximum = Math.max(1, ...visible.map((point) => numberValue(point.orders)))

  if (!visible.length) {
    return <p className="text-sm text-muted">No order activity in this period.</p>
  }

  return (
    <div>
      <div className="flex h-36 items-end gap-1" aria-label="Daily order volume">
        {visible.map((point) => (
          <div className="group relative flex min-w-1 flex-1 items-end" key={point.date}>
            <div
              className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(4, (numberValue(point.orders) / maximum) * 132)}px` }}
              title={`${point.date}: ${numberValue(point.orders)} orders`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{visible[0]?.date}</span>
        <span>{visible.at(-1)?.date}</span>
      </div>
    </div>
  )
}

function AnalyticsContent({ analytics }: { analytics: VendorAnalyticsOverview }) {
  const topDay = analytics.orders.peakBookingDays[0]
  const topHour = analytics.orders.peakBookingHours[0]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ShoppingBag} label="Orders" value={String(numberValue(analytics.orders.total))} />
        <MetricCard icon={CircleDollarSign} label="Net revenue" value={money(analytics.revenue.netRevenuePaise)} />
        <MetricCard icon={BarChart3} label="Completion rate" value={percent(analytics.orders.completionRatePercent)} />
        <MetricCard icon={UsersRound} label="Repeat customer rate" value={percent(analytics.customers.repeatCustomerRatePercent)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
        <section className="rounded-[1rem] border border-border bg-surface p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">Daily order volume</h3>
              <p className="mt-1 text-sm text-muted">Latest 21 days within the selected window.</p>
            </div>
            <Badge tone="info">
              {analytics.window.dateFrom} – {analytics.window.dateTo}
            </Badge>
          </div>
          <TrendBars data={analytics.orders.daily} />
        </section>

        <section className="rounded-[1rem] border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" />
            <h3 className="font-semibold text-foreground">Order operations</h3>
          </div>
          <div className="mt-3">
            <DetailRow label="Completed" value={String(numberValue(analytics.orders.completed))} />
            <DetailRow label="Cancelled" value={String(numberValue(analytics.orders.cancelled))} />
            <DetailRow label="Cancellation rate" value={percent(analytics.orders.cancellationRatePercent)} />
            <DetailRow label="Average fulfilment" value={`${numberValue(analytics.orders.averageFulfilmentHours).toFixed(1)} hours`} />
            <DetailRow label="Peak day" value={topDay?.dayOfWeek ?? '—'} />
            <DetailRow label="Peak hour" value={topHour ? `${String(topHour.hour).padStart(2, '0')}:00` : '—'} />
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-[1rem] border border-border bg-surface p-4">
          <h3 className="font-semibold text-foreground">Revenue</h3>
          <p className="mt-1 text-sm text-muted">Earning records for orders in this window.</p>
          <div className="mt-3">
            <DetailRow label="Gross revenue" value={money(analytics.revenue.grossRevenuePaise)} />
            <DetailRow label="Commission" value={`−${money(analytics.revenue.commissionPaise)}`} />
            <DetailRow label="Logistics" value={`−${money(analytics.revenue.logisticsDeductionPaise)}`} />
            <DetailRow label="Net revenue" value={money(analytics.revenue.netRevenuePaise)} />
            <DetailRow label="Average order value" value={money(analytics.revenue.averageOrderValuePaise)} />
            <DetailRow label="MoM gross revenue" value={change(analytics.comparison.monthOverMonth.grossRevenueChangePercent)} />
          </div>
        </section>

        <section className="rounded-[1rem] border border-border bg-surface p-4">
          <h3 className="font-semibold text-foreground">Customers</h3>
          <p className="mt-1 text-sm text-muted">New, returning, and lifetime value context.</p>
          <div className="mt-3">
            <DetailRow label="Unique customers" value={String(numberValue(analytics.customers.unique))} />
            <DetailRow label="New customers" value={String(numberValue(analytics.customers.new))} />
            <DetailRow label="Returning customers" value={String(numberValue(analytics.customers.returning))} />
          </div>
          <div className="mt-3 space-y-2">
            {!analytics.customers.topCustomers.length ? (
              <p className="rounded-xl bg-background p-3 text-sm text-muted">No delivered-customer history in this window.</p>
            ) : analytics.customers.topCustomers.map((customer) => (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-background p-3" key={customer.customerId}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{customer.fullName || 'Customer'}</p>
                  <p className="text-xs text-muted">{customer.bookingCount} delivered bookings</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-foreground">{money(customer.lifetimeBookingValuePaise)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1rem] border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-primary" />
            <h3 className="font-semibold text-foreground">Content performance</h3>
          </div>
          <p className="mt-1 text-sm text-muted">Recorded reel views and attributed bookings.</p>
          <div className="mt-3">
            <DetailRow label="Views" value={String(numberValue(analytics.content.views))} />
            <DetailRow label="Bookings" value={String(numberValue(analytics.content.bookings))} />
            <DetailRow label="Conversion" value={percent(analytics.content.conversionRatePercent)} />
            <DetailRow label="Average watch" value={`${(numberValue(analytics.content.averageWatchTimeMs) / 1000).toFixed(1)} seconds`} />
          </div>
          <div className="mt-3 space-y-2">
            {!analytics.content.topReels.length ? (
              <p className="rounded-xl bg-background p-3 text-sm text-muted">No reel activity in this window.</p>
            ) : analytics.content.topReels.map((reel) => (
              <div className="rounded-xl bg-background p-3" key={reel.reelId}>
                <p className="truncate text-sm font-medium text-foreground">{reel.caption || reel.publicReelId}</p>
                <p className="mt-1 text-xs text-muted">{reel.views} views · {reel.bookings} bookings · {percent(reel.conversionRatePercent)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <p className="text-center text-xs text-muted">
        Snapshot {analytics.snapshot.cacheStatus.toLowerCase()} · generated {new Date(analytics.snapshot.generatedAt).toLocaleString('en-IN')}
      </p>
    </div>
  )
}

export function VendorAnalyticsPanel({ vendorId }: { vendorId: string }) {
  const [period, setPeriod] = useState<VendorAnalyticsPeriod>('30D')
  const queryClient = useQueryClient()
  const analyticsQuery = useQuery({
    queryKey: ['vendor-analytics', vendorId, period],
    queryFn: () => vendorService.getVendorAnalytics(vendorId, period),
    staleTime: 60_000,
  })
  const analytics = analyticsQuery.data?.data
  const refreshMutation = useMutation({
    mutationFn: () => vendorService.getVendorAnalytics(vendorId, period, true),
    onSuccess: (result) => {
      queryClient.setQueryData(['vendor-analytics', vendorId, period], result)
    },
  })

  return (
    <section className="space-y-4" aria-label="Vendor analytics">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Vendor analytics</h2>
          <p className="mt-1 text-sm text-muted">Read-only support view of the same business metrics shown to this vendor.</p>
        </div>
        <Button
          disabled={analyticsQuery.isFetching || refreshMutation.isPending}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => refreshMutation.mutate()}
        >
          <RotateCcw className="mr-2 size-4" />
          {refreshMutation.isPending ? 'Refreshing…' : 'Refresh snapshot'}
        </Button>
      </div>

      {refreshMutation.isError ? (
        <p className="text-sm text-danger" role="alert">The snapshot refresh failed. Existing analytics remain available.</p>
      ) : null}

      <div className="flex flex-wrap gap-2" aria-label="Analytics date period">
        {periods.map((option) => (
          <Button
            aria-pressed={period === option.value}
            key={option.value}
            size="sm"
            type="button"
            variant={period === option.value ? 'primary' : 'secondary'}
            onClick={() => {
              refreshMutation.reset()
              setPeriod(option.value)
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {analyticsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton className="h-28" key={index} />)}
        </div>
      ) : analyticsQuery.isError ? (
        <ErrorState description="We could not load this vendor's analytics." title="Analytics unavailable" onRetry={() => void analyticsQuery.refetch()} />
      ) : analytics ? (
        <AnalyticsContent analytics={analytics} />
      ) : (
        <EmptyState description="No analytics snapshot is available for this vendor and period." title="No analytics data" />
      )}
    </section>
  )
}
