import { mockOrders } from '../../../mock/db/orders.mock'
import { mockUsers } from '../../../mock/db/users.mock'
import { mockVendors } from '../../../mock/db/vendors.mock'
import { mockReels } from '../../../mock/db/reels.mock'
import { mockPayments } from '../../../mock/db/payments.mock'
import { mockClient } from '../../../services/mockClient'
import type { DashboardData } from '../types/dashboard.types'

const [primaryOrder] = mockOrders
const [primaryUser] = mockUsers
const [secondaryVendor] = mockVendors

if (!primaryOrder || !primaryUser || !secondaryVendor) {
  throw new Error('Mock dashboard seed data is incomplete.')
}

export const dashboardMockService = {
  getDashboard: async (): Promise<DashboardData> =>
    mockClient(() => ({
      metrics: [
        { label: "Today's orders", value: '184' },
        { label: 'Active vendors', value: String(mockVendors.length) },
        { label: 'Pending reel approvals', value: String(mockReels.length) },
        { label: 'Payment incidents', value: String(mockPayments.length) },
      ],
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
    })),
}
