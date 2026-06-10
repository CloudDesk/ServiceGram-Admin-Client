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
import { routePermissions } from '../config/routePermissions'
import { AccessDeniedPage } from './AccessDeniedPage'
import { NotFoundPage } from './NotFoundPage'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage'
import { DashboardPage } from '../features/dashboard/pages/DashboardPage'
import { VendorsPage } from '../features/vendors/components/VendorsPage'
import { VendorDetailPage } from '../features/vendors/components/VendorDetailPage'
import { AdminLayout } from '../layouts/AdminLayout'
import { ModuleLayout } from '../layouts/ModuleLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicRoute } from './PublicRoute'
import { ModulePageFactory, RecordDetailPage } from './RouteScaffolds'
import { Button } from '../components/ui/Button'
import { PermissionGuard } from '../components/ui/PermissionGuard'

const [primaryUser] = mockUsers
const [primaryCustomer] = mockCustomers
const [, secondaryVendor] = mockVendors
const [primaryOrder] = mockOrders
const [primaryPayment] = mockPayments
const [primaryPayout] = mockPayouts
const [primaryReel] = mockReels

if (
  !primaryUser ||
  !primaryCustomer ||
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
              {
                element: <PermissionGuard />,
                children: [{ path: routePaths.dashboard, element: <DashboardPage /> }],
              },
              {
                element: <PermissionGuard permission={routePermissions.adminUsers} />,
                children: [
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
                        listHref={routePaths.adminUsers}
                        listLabel="Users"
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
                        listHref={routePaths.adminUsers}
                        listLabel="Users"
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
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.customers} />,
                children: [
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
                        listHref={routePaths.customers}
                        listLabel="Customers"
                        record={primaryCustomer}
                        title="Customer Detail"
                      />
                    ),
                  },
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.vendors} />,
                children: [
                  {
                    path: routePaths.vendors,
                    element: <VendorsPage />,
                  },
                  {
                    path: `${routePaths.vendors}/:vendorId`,
                    element: <VendorDetailPage />,
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
                        listHref={routePaths.vendorOnboarding}
                        listLabel="Vendor Onboarding"
                        record={secondaryVendor}
                        title="Onboarding Detail"
                      />
                    ),
                  },
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.orders} />,
                children: [
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
                        listHref={routePaths.orders}
                        listLabel="Orders"
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
                        listHref={routePaths.manualLogistics}
                        listLabel="Manual Logistics"
                        record={primaryOrder}
                        title="Manual Logistics Detail"
                      />
                    ),
                  },
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.payments} />,
                children: [
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
                        listHref={routePaths.payments}
                        listLabel="Payments"
                        record={primaryPayment}
                        title="Payment Detail"
                      />
                    ),
                  },
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.payouts} />,
                children: [
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
                        listHref={routePaths.payouts}
                        listLabel="Payouts"
                        record={primaryPayout}
                        title="Payout Detail"
                      />
                    ),
                  },
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.reels} />,
                children: [
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
                        listHref={routePaths.reels}
                        listLabel="Reels"
                        record={primaryReel}
                        title="Reel Detail"
                      />
                    ),
                  },
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.notifications} />,
                children: [
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
                        listHref={routePaths.notifications}
                        listLabel="Notifications"
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
                        listHref={routePaths.notifications}
                        listLabel="Notifications"
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
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.content} />,
                children: [
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
                        listHref={routePaths.content}
                        listLabel="Content"
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
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.reports} />,
                children: [
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
                        listHref={routePaths.reports}
                        listLabel="Reports"
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
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.settings} />,
                children: [
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
              {
                element: <PermissionGuard permission={routePermissions.audit} />,
                children: [
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
                ],
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
