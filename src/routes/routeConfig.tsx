import type { RouteObject } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { mockOrders } from '../mock/db/orders.mock'
import { mockPayments } from '../mock/db/payments.mock'
import { mockPayouts } from '../mock/db/payouts.mock'
import { mockVendors } from '../mock/db/vendors.mock'
import { routePaths } from '../config/routes'
import { routePermissions } from '../config/routePermissions'
import { AccessDeniedPage } from './AccessDeniedPage'
import { NotFoundPage } from './NotFoundPage'
import { AdminUserDetailPage } from '../features/admin-users/components/AdminUserDetailPage'
import { AdminUsersPage } from '../features/admin-users/components/AdminUsersPage'
import { CreateAdminUserPage } from '../features/admin-users/components/CreateAdminUserPage'
import { ProfilePage } from '../features/admin-users/components/ProfilePage'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage'
import { DashboardPage } from '../features/dashboard/pages/DashboardPage'
import { CustomerDetailPage } from '../features/customers/components/CustomerDetailPage'
import { CustomersPage } from '../features/customers/components/CustomersPage'
import { OrderDetailPage } from '../features/orders/components/OrderDetailPage'
import { OrdersPage } from '../features/orders/components/OrdersPage'
import { PaymentDetailPage } from '../features/payments/components/PaymentDetailPage'
import { PaymentsPage } from '../features/payments/components/PaymentsPage'
import { PayoutDetailPage } from '../features/payouts/components/PayoutDetailPage'
import { PayoutsPage } from '../features/payouts/components/PayoutsPage'
import { ReelDetailPage } from '../features/reels/components/ReelDetailPage'
import { ReelsPage } from '../features/reels/components/ReelsPage'
import { SettingsDetailPage } from '../features/settings/components/SettingsDetailPage'
import { SettingsPage } from '../features/settings/components/SettingsPage'
import { VendorsPage } from '../features/vendors/components/VendorsPage'
import { VendorDetailPage } from '../features/vendors/components/VendorDetailPage'
import { AdminLayout } from '../layouts/AdminLayout'
import { ModuleLayout } from '../layouts/ModuleLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicRoute } from './PublicRoute'
import { ModulePageFactory, RecordDetailPage } from './RouteScaffolds'
import { Button } from '../components/ui/Button'
import { PermissionGuard } from '../components/ui/PermissionGuard'

const [, secondaryVendor] = mockVendors
const [primaryOrder] = mockOrders
const [primaryPayment] = mockPayments
const [primaryPayout] = mockPayouts

if (
  !secondaryVendor ||
  !primaryOrder ||
  !primaryPayment ||
  !primaryPayout
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
                    element: <AdminUsersPage />,
                  },
                  {
                    path: `${routePaths.adminUsers}/new`,
                    element: <CreateAdminUserPage />,
                  },
                  {
                    path: `${routePaths.adminUsers}/:adminUserId`,
                    element: <AdminUserDetailPage />,
                  },
                ],
              },
              {
                element: <PermissionGuard />,
                children: [{ path: routePaths.profile, element: <ProfilePage /> }],
              },
              {
                element: <PermissionGuard permission={routePermissions.customers} />,
                children: [
                  {
                    path: routePaths.customers,
                    element: <CustomersPage />,
                  },
                  {
                    path: `${routePaths.customers}/:customerId`,
                    element: <CustomerDetailPage />,
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
                    element: <OrdersPage />,
                  },
                  {
                    path: `${routePaths.orders}/:orderId`,
                    element: <OrderDetailPage />,
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
                    element: <PaymentsPage />,
                  },
                  {
                    path: `${routePaths.payments}/:paymentId`,
                    element: <PaymentDetailPage />,
                  },
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.payouts} />,
                children: [
                  {
                    path: routePaths.payouts,
                    element: <PayoutsPage />,
                  },
                  {
                    path: `${routePaths.payouts}/:payoutId`,
                    element: <PayoutDetailPage />,
                  },
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.reels} />,
                children: [
                  {
                    path: routePaths.reels,
                    element: <ReelsPage />,
                  },
                  {
                    path: `${routePaths.reels}/:reelId`,
                    element: <ReelDetailPage />,
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
                    element: <SettingsPage />,
                  },
                  {
                    path: `${routePaths.settings}/:type/:recordId`,
                    element: <SettingsDetailPage />,
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
