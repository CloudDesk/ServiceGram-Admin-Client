import type { RouteObject } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { mockCustomers } from '../mock/db/customers.mock'
import { mockOrders } from '../mock/db/orders.mock'
import { mockPayments } from '../mock/db/payments.mock'
import { mockPayouts } from '../mock/db/payouts.mock'
import { mockReels } from '../mock/db/reels.mock'
import { mockUsers } from '../mock/db/users.mock'
import { mockVendors } from '../mock/db/vendors.mock'
import { routePaths } from '../config/routes'
import { AccessDeniedPage } from './AccessDeniedPage'
import { NotFoundPage } from './NotFoundPage'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage'
import { DashboardPage } from '../features/dashboard/pages/DashboardPage'
import { AdminLayout } from '../layouts/AdminLayout'
import { ModuleLayout } from '../layouts/ModuleLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicRoute } from './PublicRoute'
import { ModulePageFactory, RecordDetailPage } from './RouteScaffolds'
import { Button } from '../components/ui/Button'

const [primaryUser] = mockUsers
const [primaryCustomer] = mockCustomers
const [primaryVendor, secondaryVendor] = mockVendors
const [primaryOrder] = mockOrders
const [primaryPayment] = mockPayments
const [primaryPayout] = mockPayouts
const [primaryReel] = mockReels

if (
  !primaryUser ||
  !primaryCustomer ||
  !primaryVendor ||
  !secondaryVendor ||
  !primaryOrder ||
  !primaryPayment ||
  !primaryPayout ||
  !primaryReel
) {
  throw new Error('Mock route seed data is incomplete.')
}

export const appRoutes: RouteObject[] = [
  {
    element: <PublicRoute />,
    children: [
      { path: '/', element: <LoginPage /> },
      { path: routePaths.login, element: <LoginPage /> },
      { path: routePaths.forgotPassword, element: <ForgotPasswordPage /> },
      { path: routePaths.resetPassword, element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            element: <ModuleLayout />,
            children: [
              { path: routePaths.dashboard, element: <DashboardPage /> },
              {
                path: routePaths.adminUsers,
                element: (
                  <ModulePageFactory
                    actionNode={
                      <Link to={`${routePaths.adminUsers}/new`}>
                        <Button size="sm">Add User</Button>
                      </Link>
                    }
                    description="Typed admin user management shell with permissions, session visibility, and audit-ready actions."
                    records={mockUsers.map((user) => ({
                      id: user.id,
                      name: user.name,
                      status: user.role,
                      subtitle: user.email,
                      updatedAt: '2026-06-05T07:20:00.000Z',
                    }))}
                    title="Users"
                  />
                ),
              },
              {
                path: `${routePaths.adminUsers}/new`,
                element: (
                  <RecordDetailPage
                    description="Foundation form route for creating a new admin user."
                    record={{
                      id: 'FORM',
                      name: 'Create Admin User',
                      status: 'Draft Ready',
                      subtitle: 'React Hook Form + Zod route placeholder',
                      updatedAt: '2026-06-05T07:20:00.000Z',
                    }}
                    title="Create Admin User"
                  />
                ),
              },
              {
                path: `${routePaths.adminUsers}/:adminUserId`,
                element: (
                  <RecordDetailPage
                    description="Detail shell for profile, role and access, login history, session history, and audit activity."
                    record={{
                      id: primaryUser.id,
                      name: primaryUser.name,
                      status: primaryUser.role,
                      subtitle: primaryUser.email,
                      updatedAt: '2026-06-05T07:20:00.000Z',
                    }}
                    title="Admin User Detail"
                  />
                ),
              },
              {
                path: routePaths.customers,
                element: (
                  <ModulePageFactory
                    description="Customer management shell with search, filters, list behavior, and mock-backed detail routing."
                    records={mockCustomers}
                    title="Customers"
                  />
                ),
              },
              {
                path: `${routePaths.customers}/:customerId`,
                element: (
                  <RecordDetailPage
                    description="Detail shell with overview, orders, payments, notes, and activity tabs ready for backend integration."
                    record={primaryCustomer}
                    title="Customer Detail"
                  />
                ),
              },
              {
                path: routePaths.vendors,
                element: (
                  <ModulePageFactory
                    description="Vendor operations shell covering approvals, documents, activity, pricing, and payments."
                    records={mockVendors}
                    title="Vendors"
                  />
                ),
              },
              {
                path: `${routePaths.vendors}/:vendorId`,
                element: (
                  <RecordDetailPage
                    description="Detail shell for profile, services, orders, documents, payments, notes, and activity."
                    record={primaryVendor}
                    title="Vendor Detail"
                  />
                ),
              },
              {
                path: routePaths.vendorOnboarding,
                element: (
                  <ModulePageFactory
                    description="Queue-first onboarding shell prepared for kanban and review workflows."
                    records={mockVendors}
                    title="Vendor Onboarding"
                  />
                ),
              },
              {
                path: `${routePaths.vendorOnboarding}/:vendorId`,
                element: (
                  <RecordDetailPage
                    description="Detail shell for stage review, document verification, and approval decisions."
                    record={secondaryVendor}
                    title="Onboarding Detail"
                  />
                ),
              },
              {
                path: routePaths.orders,
                element: (
                  <ModulePageFactory
                    description="Order management foundation with status-heavy operations, notes, and logistics controls."
                    records={mockOrders}
                    title="Orders"
                  />
                ),
              },
              {
                path: `${routePaths.orders}/:orderId`,
                element: (
                  <RecordDetailPage
                    description="Detail shell for customer, vendor, payment, notes, action history, and manual logistics."
                    record={primaryOrder}
                    title="Order Detail"
                  />
                ),
              },
              {
                path: routePaths.manualLogistics,
                element: (
                  <ModulePageFactory
                    description="Manual delivery control shell with chronological update history and exception workflows."
                    records={mockOrders}
                    title="Manual Logistics"
                  />
                ),
              },
              {
                path: `${routePaths.orders}/:orderId/logistics`,
                element: (
                  <RecordDetailPage
                    description="Route placeholder for order-specific logistics actions, proof uploads, and exception handling."
                    record={primaryOrder}
                    title="Manual Logistics Detail"
                  />
                ),
              },
              {
                path: routePaths.payments,
                element: (
                  <ModulePageFactory
                    description="Finance operations shell for transactions, refunds, reconciliation, and reporting."
                    records={mockPayments}
                    title="Payments"
                  />
                ),
              },
              {
                path: `${routePaths.payments}/:paymentId`,
                element: (
                  <RecordDetailPage
                    description="Detail shell for payment context, status, references, and refund actions."
                    record={primaryPayment}
                    title="Payment Detail"
                  />
                ),
              },
              {
                path: routePaths.payouts,
                element: (
                  <ModulePageFactory
                    description="Vendor payout shell for queue, history, failed payouts, and adjustment actions."
                    records={mockPayouts}
                    title="Payouts"
                  />
                ),
              },
              {
                path: `${routePaths.payouts}/:payoutId`,
                element: (
                  <RecordDetailPage
                    description="Detail shell for bank verification, deductions, references, and payout decisions."
                    record={primaryPayout}
                    title="Payout Detail"
                  />
                ),
              },
              {
                path: routePaths.reels,
                element: (
                  <ModulePageFactory
                    description="Moderation shell for pending approvals, live reel controls, and media review states."
                    records={mockReels}
                    title="Reels"
                  />
                ),
              },
              {
                path: `${routePaths.reels}/:reelId`,
                element: (
                  <RecordDetailPage
                    description="Detail shell for video review, moderation history, and approval actions."
                    record={primaryReel}
                    title="Reel Detail"
                  />
                ),
              },
              {
                path: routePaths.notifications,
                element: (
                  <ModulePageFactory
                    actionNode={
                      <Link to={`${routePaths.notifications}/new`}>
                        <Button size="sm">New Notification</Button>
                      </Link>
                    }
                    description="Notification center foundation for drafts, previews, scheduling, and audience targeting."
                    records={[
                      {
                        id: 'NTF-001',
                        name: 'Monsoon campaign reminder',
                        subtitle: 'Customer App • Scheduled',
                        status: 'Draft',
                        updatedAt: '2026-06-05T07:05:00.000Z',
                      },
                    ]}
                    title="Notifications"
                  />
                ),
              },
              {
                path: `${routePaths.notifications}/new`,
                element: (
                  <RecordDetailPage
                    description="Composer shell for title, body, audience, schedule, preview, and confirmation."
                    record={{
                      id: 'DRAFT',
                      name: 'Notification Composer',
                      subtitle: 'Mock compose workflow',
                      status: 'Draft Ready',
                      updatedAt: '2026-06-05T07:05:00.000Z',
                    }}
                    title="Create Notification"
                  />
                ),
              },
              {
                path: `${routePaths.notifications}/:notificationId`,
                element: (
                  <RecordDetailPage
                    description="Detail shell for campaign status, audience summary, and send history."
                    record={{
                      id: 'NTF-001',
                      name: 'Monsoon campaign reminder',
                      subtitle: 'Customer App • Scheduled',
                      status: 'Draft',
                      updatedAt: '2026-06-05T07:05:00.000Z',
                    }}
                    title="Notification Detail"
                  />
                ),
              },
              {
                path: routePaths.content,
                element: (
                  <ModulePageFactory
                    description="Content management shell for static content, templates, preview, and versioning."
                    records={[
                      {
                        id: 'CNT-101',
                        name: 'FAQ Landing Content',
                        subtitle: 'Published static page',
                        status: 'Published',
                        updatedAt: '2026-06-05T06:15:00.000Z',
                      },
                    ]}
                    title="Content"
                  />
                ),
              },
              {
                path: `${routePaths.content}/:contentId`,
                element: (
                  <RecordDetailPage
                    description="Editor shell for draft, preview, publish, archive, and rollback flows."
                    record={{
                      id: 'CNT-101',
                      name: 'FAQ Landing Content',
                      subtitle: 'Published static page',
                      status: 'Published',
                      updatedAt: '2026-06-05T06:15:00.000Z',
                    }}
                    title="Content Editor"
                  />
                ),
              },
              {
                path: routePaths.reports,
                element: (
                  <ModulePageFactory
                    description="Report catalog shell with export-ready tables, filters, and finance-aware access control."
                    records={[
                      {
                        id: 'RPT-OPS-01',
                        name: 'Order lifecycle report',
                        subtitle: 'Operations',
                        status: 'Ready',
                        updatedAt: '2026-06-05T05:05:00.000Z',
                      },
                    ]}
                    title="Reports"
                  />
                ),
              },
              {
                path: `${routePaths.reports}/:reportKey`,
                element: (
                  <RecordDetailPage
                    description="Report detail shell with filters, export, retry, and long-running job placeholders."
                    record={{
                      id: 'RPT-OPS-01',
                      name: 'Order lifecycle report',
                      subtitle: 'Operations',
                      status: 'Ready',
                      updatedAt: '2026-06-05T05:05:00.000Z',
                    }}
                    title="Report Detail"
                  />
                ),
              },
              {
                path: routePaths.settings,
                element: (
                  <ModulePageFactory
                    description="Platform configuration shell for categories, zones, vendors, orders, payments, and notifications."
                    records={[
                      {
                        id: 'SET-ORDER',
                        name: 'Order settings',
                        subtitle: 'Cancellation rules • OTP rules',
                        status: 'Configured',
                        updatedAt: '2026-06-05T04:45:00.000Z',
                      },
                    ]}
                    title="Settings"
                  />
                ),
              },
              {
                path: routePaths.audit,
                element: (
                  <ModulePageFactory
                    description="Audit log shell for role changes, payment actions, manual overrides, and settings changes."
                    records={[
                      {
                        id: 'AUD-0001',
                        name: 'Vendor approval updated',
                        subtitle: 'Operations Admin • Sparkle Laundry Hub',
                        status: 'Logged',
                        updatedAt: '2026-06-05T03:55:00.000Z',
                      },
                    ]}
                    title="Audit Logs"
                  />
                ),
              },
              {
                path: routePaths.profile,
                element: (
                  <ModulePageFactory
                    description="Profile and session management shell with account details, password change, and active sessions."
                    records={[
                      {
                        id: primaryUser.id,
                        name: primaryUser.name,
                        subtitle: primaryUser.email,
                        status: 'Active Session',
                        updatedAt: '2026-06-05T02:35:00.000Z',
                      },
                    ]}
                    title="My Profile"
                  />
                ),
              },
            ],
          },
        ],
      },
      { path: routePaths.accessDenied, element: <AccessDeniedPage /> },
      { path: routePaths.notFound, element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]
