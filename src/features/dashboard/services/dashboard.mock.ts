import { mockOrders } from '../../../mock/db/orders.mock'
import { mockUsers } from '../../../mock/db/users.mock'
import { mockVendors } from '../../../mock/db/vendors.mock'
import { mockReels } from '../../../mock/db/reels.mock'
import { mockPayments } from '../../../mock/db/payments.mock'
import { mockClient } from '../../../services/mockClient'
import type { DashboardData, DashboardTrendPoint } from '../types/dashboard.types'

const [primaryOrder] = mockOrders
const [primaryUser] = mockUsers
const [secondaryVendor] = mockVendors

if (!primaryOrder || !primaryUser || !secondaryVendor) {
  throw new Error('Mock dashboard seed data is incomplete.')
}

function trendPoints(): DashboardTrendPoint[] {
  const today = new Date()

  return Array.from({ length: 30 }).map((_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (29 - index))
    const dayFactor = (index % 6) + 1

    return {
      bucketStart: date.toISOString().slice(0, 10),
      label: date.toISOString().slice(0, 10),
      ordersCreated: dayFactor + 2,
      ordersDelivered: Math.max(1, dayFactor - 1),
      ordersCancelled: index % 9 === 0 ? 1 : 0,
      paymentsCaptured: dayFactor,
      refundsCreated: index % 11 === 0 ? 1 : 0,
      payoutsCreated: index % 13 === 0 ? 1 : 0,
      paymentAmountPaise: (dayFactor + 2) * 125000,
      refundAmountPaise: index % 11 === 0 ? 45000 : 0,
      payoutAmountPaise: index % 13 === 0 ? 180000 : 0,
    }
  })
}

export const dashboardMockService = {
  getDashboard: async (): Promise<DashboardData> =>
    mockClient(() => {
      const loadedAt = new Date().toISOString()

      return {
        finance: {
          permitted: true,
          scope: { type: 'PLATFORM', zoneIds: [] },
          warnings: [],
          widgets: [
            {
              byStatus: { CAPTURED: { amountPaise: 1250000, count: mockPayments.length } },
              code: 'PAYMENTS',
              totalAmountPaise: 1250000,
              totalCount: mockPayments.length,
            },
          ],
        },
        loadedAt,
        metrics: [
          { label: "Today's orders", value: '184' },
          { label: 'Active vendors', value: String(mockVendors.length) },
          { label: 'Pending reel approvals', value: String(mockReels.length) },
          { label: 'Payment incidents', value: String(mockPayments.length) },
        ],
        orders: {
          byPaymentStatus: { PAID: mockOrders.length },
          byStatus: { PLACED: mockOrders.length },
          matrixRows: [
            {
              count: mockOrders.length,
              orderStatus: 'PLACED',
              orderStatusLabel: 'Placed',
              paymentStatus: 'PAID',
              paymentStatusLabel: 'Paid',
              routeFilter: { orderStatus: 'PLACED', paymentStatus: 'PAID' },
              severity: 'ATTENTION',
            },
          ],
          paymentStatusItems: [
            {
              code: 'PAID',
              count: mockOrders.length,
              label: 'Paid',
              routeFilter: { paymentStatus: 'PAID' },
              severity: 'ATTENTION',
              sortOrder: 1,
            },
          ],
          rows: [
            { count: mockOrders.length, orderStatus: 'PLACED', paymentStatus: 'PAID' },
          ],
          scope: { type: 'PLATFORM', zoneIds: [] },
          statusItems: [
            {
              code: 'PLACED',
              count: mockOrders.length,
              label: 'Placed',
              routeFilter: { orderStatus: 'PLACED' },
              severity: 'ATTENTION',
              sortOrder: 1,
            },
          ],
        },
        pendingActions: [
          primaryOrder,
          secondaryVendor,
          {
            id: 'ADM-ALERT-01',
            name: 'Role change pending confirmation',
            subtitle: primaryUser.email,
            status: 'Needs Review',
            updatedAt: '2026-06-05T07:25:00.000Z',
          },
        ],
        reviewQueues: {
          nextRecommendedAction: 'REVIEW_VENDOR_ONBOARDING',
          queues: [
            {
              availableActions: ['OPEN_QUEUE'],
              code: 'VENDOR_ONBOARDING',
              count: 1,
              label: 'Vendor onboarding',
              path: '/admin/vendors/onboarding-queue',
              severity: 'ATTENTION',
            },
          ],
          scope: { type: 'PLATFORM', zoneIds: [] },
        },
        summary: {
          alerts: ['VENDOR_REVIEW_QUEUE_ACTIVE'],
          cards: [
            {
              action: null,
              code: 'ACTIVE_CUSTOMERS',
              label: 'Active customers',
              severity: 'NORMAL',
              value: mockUsers.length,
            },
            {
              action: 'REVIEW_VENDORS',
              code: 'PENDING_VENDOR_REVIEWS',
              label: 'Vendors pending',
              severity: 'ATTENTION',
              value: 1,
            },
          ],
          nextRecommendedAction: 'REVIEW_VENDOR_ONBOARDING',
          scope: { type: 'PLATFORM', zoneIds: [] },
        },
        trends: {
          bucket: 'day',
          points: trendPoints(),
          range: '30d',
          scope: { type: 'PLATFORM', zoneIds: [] },
          series: [
            {
              code: 'ORDERS_CREATED',
              label: 'Orders created',
              route: '/admin/orders',
              unit: 'count',
            },
            {
              code: 'PAYMENT_AMOUNT',
              label: 'Payment value',
              route: '/admin/payments',
              unit: 'paise',
            },
          ],
        },
      }
    }),
}
