import type { RouteObject } from 'react-router-dom'
import { routePaths } from '../config/routes'
import { routePermissions } from '../config/routePermissions'
import { AccessDeniedPage } from './AccessDeniedPage'
import { NotFoundPage } from './NotFoundPage'
import { AdminUserDetailPage } from '../features/admin-users/components/AdminUserDetailPage'
import { AdminUsersPage } from '../features/admin-users/components/AdminUsersPage'
import { CreateAdminUserPage } from '../features/admin-users/components/CreateAdminUserPage'
import { ProfilePage } from '../features/admin-users/components/ProfilePage'
import { CreateRolePage } from '../features/rbac/components/CreateRolePage'
import { RoleDetailPage } from '../features/rbac/components/RoleDetailPage'
import { RolesPage } from '../features/rbac/components/RolesPage'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage'
import { AuditLogsPage } from '../features/audit/components/AuditLogsPage'
import { ContentDetailPage } from '../features/content/components/ContentDetailPage'
import { ContentPage } from '../features/content/components/ContentPage'
import { CreateContentPage } from '../features/content/components/CreateContentPage'
import { DashboardPage } from '../features/dashboard/pages/DashboardPage'
import { InfluencerDetailPage } from '../features/influencers/components/InfluencerDetailPage'
import { InfluencersPage } from '../features/influencers/components/InfluencersPage'
import { CustomerWorkbenchPreviewPage } from '../features/customers/components/CustomerWorkbenchPreviewPage'
import { CustomerDetailPage } from '../features/customers/components/CustomerDetailPage'
import { CustomersPage } from '../features/customers/components/CustomersPage'
import { ManualLogisticsPage } from '../features/orders/components/ManualLogisticsPage'
import { OrderDetailPage } from '../features/orders/components/OrderDetailPage'
import { OrdersPage } from '../features/orders/components/OrdersPage'
import { NotificationComposerPage } from '../features/notifications/components/NotificationComposerPage'
import { NotificationDetailPage } from '../features/notifications/components/NotificationDetailPage'
import { NotificationsPage } from '../features/notifications/components/NotificationsPage'
import { PaymentDetailPage } from '../features/payments/components/PaymentDetailPage'
import { PaymentsPage } from '../features/payments/components/PaymentsPage'
import { RefundDetailPage } from '../features/payments/components/RefundDetailPage'
import { RefundsPage } from '../features/payments/components/RefundsPage'
import { PayoutDetailPage } from '../features/payouts/components/PayoutDetailPage'
import { PayoutsPage } from '../features/payouts/components/PayoutsPage'
import { ReelDetailPage } from '../features/reels/components/ReelDetailPage'
import { ReelsPage } from '../features/reels/components/ReelsPage'
import { ReportDetailPage } from '../features/reports/components/ReportDetailPage'
import { ReportExportDetailPage } from '../features/reports/components/ReportExportDetailPage'
import { ReportsPage } from '../features/reports/components/ReportsPage'
import { SettingsDetailPage } from '../features/settings/components/SettingsDetailPage'
import { SettingsPage } from '../features/settings/components/SettingsPage'
import { VendorOnboardingPage } from '../features/vendors/components/VendorOnboardingPage'
import { VendorsPage } from '../features/vendors/components/VendorsPage'
import { VendorDetailPage } from '../features/vendors/components/VendorDetailPage'
import { AdminLayout } from '../layouts/AdminLayout'
import { ModuleLayout } from '../layouts/ModuleLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicRoute } from './PublicRoute'
import { PermissionGuard } from '../components/ui/PermissionGuard'

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
                element: <PermissionGuard permission={routePermissions.dashboard} />,
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
                element: <PermissionGuard permission={routePermissions.roles} />,
                children: [
                  {
                    path: routePaths.roles,
                    element: <RolesPage />,
                  },
                  {
                    path: `${routePaths.roles}/new`,
                    element: <CreateRolePage />,
                  },
                  {
                    path: `${routePaths.roles}/:roleId`,
                    element: <RoleDetailPage />,
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
                    path: routePaths.customerWorkbenchPreview,
                    element: <CustomerWorkbenchPreviewPage />,
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
                    element: <VendorOnboardingPage />,
                  },
                  {
                    path: `${routePaths.vendorOnboarding}/:vendorId`,
                    element: (
                      <VendorDetailPage
                        listHref={routePaths.vendorOnboarding}
                        listLabel="Vendor Onboarding"
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
                    element: <ManualLogisticsPage />,
                  },
                  {
                    path: `${routePaths.orders}/:orderId/logistics`,
                    element: (
                      <OrderDetailPage
                        listHref={routePaths.manualLogistics}
                        listLabel="Manual Logistics"
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
                element: <PermissionGuard permission={routePermissions.refunds} />,
                children: [
                  {
                    path: routePaths.refunds,
                    element: <RefundsPage />,
                  },
                  {
                    path: `${routePaths.refunds}/:refundId`,
                    element: <RefundDetailPage />,
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
                element: <PermissionGuard permission={routePermissions.influencers} />,
                children: [
                  {
                    path: routePaths.influencers,
                    element: <InfluencersPage />,
                  },
                  {
                    path: `${routePaths.influencers}/:profileId`,
                    element: <InfluencerDetailPage />,
                  },
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.notifications} />,
                children: [
                  {
                    path: routePaths.notifications,
                    element: <NotificationsPage />,
                  },
                  {
                    path: `${routePaths.notifications}/new`,
                    element: <NotificationComposerPage />,
                  },
                  {
                    path: `${routePaths.notifications}/:notificationId`,
                    element: <NotificationDetailPage />,
                  },
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.content} />,
                children: [
                  {
                    path: routePaths.content,
                    element: <ContentPage />,
                  },
                  {
                    path: `${routePaths.content}/new`,
                    element: <CreateContentPage />,
                  },
                  {
                    path: `${routePaths.content}/:contentId`,
                    element: <ContentDetailPage />,
                  },
                ],
              },
              {
                element: <PermissionGuard permission={routePermissions.reports} />,
                children: [
                  {
                    path: routePaths.reports,
                    element: <ReportsPage />,
                  },
                  {
                    path: `${routePaths.reports}/exports/:exportId`,
                    element: <ReportExportDetailPage />,
                  },
                  {
                    path: `${routePaths.reports}/:reportKey`,
                    element: <ReportDetailPage />,
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
                    element: <AuditLogsPage />,
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
