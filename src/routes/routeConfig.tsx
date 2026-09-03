import type { RouteObject } from "react-router-dom";
import { routePaths } from "../config/routes";
import { routePermissions } from "../config/routePermissions";
import { AccessDeniedPage } from "./AccessDeniedPage";
import { NotFoundPage } from "./NotFoundPage";
import { AdminUserDetailPage } from "../features/admin-users/components/AdminUserDetailPage";
import { AdminUsersPage } from "../features/admin-users/components/AdminUsersPage";
import { CreateAdminUserPage } from "../features/admin-users/components/CreateAdminUserPage";
import { ProfilePage } from "../features/admin-users/components/ProfilePage";
import { CreateRolePage } from "../features/rbac/components/CreateRolePage";
import { RoleDetailPage } from "../features/rbac/components/RoleDetailPage";
import { RolesPage } from "../features/rbac/components/RolesPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../features/auth/pages/ResetPasswordPage";
import { AuditLogsPage } from "../features/audit/components/AuditLogsPage";
import { ApprovalsPage } from "../features/approvals/components/ApprovalsPage";
import { ContentDetailPage } from "../features/content/components/ContentDetailPage";
import { ContentPage } from "../features/content/components/ContentPage";
import { CreateContentPage } from "../features/content/components/CreateContentPage";
import { CustomerAppHomePage } from "../features/content/components/CustomerAppHomePage";
import { CustomerAppHomeSlideDetailPage } from "../features/content/components/CustomerAppHomeSlideDetailPage";
import { DashboardPage } from "../features/dashboard/pages/DashboardPage";
import { CreateMarketingCampaignPage } from "../features/marketing-campaigns/components/CreateMarketingCampaignPage";
import { MarketingCampaignDetailPage } from "../features/marketing-campaigns/components/MarketingCampaignDetailPage";
import { MarketingCampaignsPage } from "../features/marketing-campaigns/components/MarketingCampaignsPage";
import { InfluencerCampaignsPage } from "../features/influencer-campaigns/components/InfluencerCampaignsPage";
import { InfluencerPayoutsPage } from "../features/influencer-payouts/components/InfluencerPayoutsPage";
import { InfluencerDetailPage } from "../features/influencers/components/InfluencerDetailPage";
import { InfluencersPage } from "../features/influencers/components/InfluencersPage";
import { CustomerDetailPage } from "../features/customers/components/CustomerDetailPage";
import { CustomersPage } from "../features/customers/components/CustomersPage";
import { ManualLogisticsPage } from "../features/orders/components/ManualLogisticsPage";
import { OrderDetailPage } from "../features/orders/components/OrderDetailPage";
import { OrdersPage } from "../features/orders/components/OrdersPage";
import { NotificationComposerPage } from "../features/notifications/components/NotificationComposerPage";
import { NotificationDetailPage } from "../features/notifications/components/NotificationDetailPage";
import { NotificationsPage } from "../features/notifications/components/NotificationsPage";
import { PaymentDetailPage } from "../features/payments/components/PaymentDetailPage";
import { PaymentsPage } from "../features/payments/components/PaymentsPage";
import { RefundDetailPage } from "../features/payments/components/RefundDetailPage";
import { RefundsPage } from "../features/payments/components/RefundsPage";
import { PayoutDetailPage } from "../features/payouts/components/PayoutDetailPage";
import { PayoutsPage } from "../features/payouts/components/PayoutsPage";
import { ReelDetailPage } from "../features/reels/components/ReelDetailPage";
import { ReelsPage } from "../features/reels/components/ReelsPage";
import { CreatorMusicPage } from "../features/creator-music/components/CreatorMusicPage";
import { ReportDetailPage } from "../features/reports/components/ReportDetailPage";
import { ReportExportDetailPage } from "../features/reports/components/ReportExportDetailPage";
import { ReportsPage } from "../features/reports/components/ReportsPage";
import { SettingsDetailPage } from "../features/settings/components/SettingsDetailPage";
import { SettingsPage } from "../features/settings/components/SettingsPage";
import { FeatureFlagDetailPage } from "../features/release2/components/FeatureFlagDetailPage";
import { FeatureFlagsPage } from "../features/release2/components/FeatureFlagsPage";
import { Release2OverviewPage } from "../features/release2/components/Release2OverviewPage";
import { Release2SettingDetailPage } from "../features/release2/components/Release2SettingDetailPage";
import { Release2SettingsPage } from "../features/release2/components/Release2SettingsPage";
import { CustomerRetentionPage } from "../features/customer-retention/components/CustomerRetentionPage";
import { VendorOnboardingPage } from "../features/vendors/components/VendorOnboardingPage";
import { VendorsPage } from "../features/vendors/components/VendorsPage";
import { VendorDetailPage } from "../features/vendors/components/VendorDetailPage";
import { VendorDocumentReviewDetailPage } from "../features/vendor-documents/components/VendorDocumentReviewDetailPage";
import { VendorDocumentsPage } from "../features/vendor-documents/components/VendorDocumentsPage";
import { AdminLayout } from "../layouts/AdminLayout";
import { ModuleLayout } from "../layouts/ModuleLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicRoute } from "./PublicRoute";
import { PermissionGuard } from "../components/ui/PermissionGuard";

export const appRoutes: RouteObject[] = [
  {
    element: <PublicRoute />,
    children: [
      { path: "/", element: <LoginPage /> },
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
                element: (
                  <PermissionGuard permission={routePermissions.dashboard} />
                ),
                children: [
                  { path: routePaths.dashboard, element: <DashboardPage /> },
                ],
              },
              {
                element: (
                  <PermissionGuard permission={routePermissions.approvals} />
                ),
                children: [
                  { path: routePaths.approvals, element: <ApprovalsPage /> },
                ],
              },
              {
                element: (
                  <PermissionGuard permission={routePermissions.adminUsers} />
                ),
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
                element: (
                  <PermissionGuard permission={routePermissions.roles} />
                ),
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
                children: [
                  { path: routePaths.profile, element: <ProfilePage /> },
                ],
              },
              {
                element: (
                  <PermissionGuard permission={routePermissions.customers} />
                ),
                children: [
                  {
                    path: routePaths.customers,
                    element: <CustomersPage />,
                  },
                  {
                    path: `${routePaths.customers}/:customerId`,
                    element: <CustomerDetailPage />,
                  },
                  {
                    path: `${routePaths.customers}/:customerId/:tab`,
                    element: <CustomerDetailPage />,
                  },
                ],
              },
              {
                element: (
                  <PermissionGuard permission={routePermissions.vendors} />
                ),
                children: [
                  {
                    path: routePaths.vendors,
                    element: <VendorsPage />,
                  },
                  {
                    path: routePaths.vendorDocuments,
                    element: <VendorDocumentsPage />,
                  },
                  {
                    path: routePaths.vendorDocumentReview,
                    element: <VendorDocumentReviewDetailPage />,
                  },
                  {
                    path: `${routePaths.vendors}/:vendorId`,
                    element: <VendorDetailPage />,
                  },
                  {
                    path: `${routePaths.vendors}/:vendorId/tab/:tab`,
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
                element: (
                  <PermissionGuard permission={routePermissions.orders} />
                ),
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
                    path: `${routePaths.orders}/:orderId/tab/:tab`,
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
                element: (
                  <PermissionGuard permission={routePermissions.payments} />
                ),
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
                element: (
                  <PermissionGuard permission={routePermissions.refunds} />
                ),
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
                element: (
                  <PermissionGuard permission={routePermissions.payouts} />
                ),
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
                element: (
                  <PermissionGuard permission={routePermissions.reels} />
                ),
                children: [
                  {
                    path: routePaths.reels,
                    element: <ReelsPage />,
                  },
                  {
                    path: `${routePaths.reels}/:reelId`,
                    element: <ReelDetailPage />,
                  },
                  {
                    path: `${routePaths.reels}/:reelId/tab/:tab`,
                    element: <ReelDetailPage />,
                  },
                ],
              },
              {
                element: (
                  <PermissionGuard permission={routePermissions.creatorMusic} />
                ),
                children: [
                  {
                    path: routePaths.creatorMusic,
                    element: <CreatorMusicPage />,
                  },
                ],
              },
              {
                element: (
                  <PermissionGuard permission={routePermissions.influencers} />
                ),
                children: [
                  {
                    path: routePaths.influencers,
                    element: <InfluencersPage />,
                  },
                  {
                    path: `${routePaths.influencers}/:profileId`,
                    element: <InfluencerDetailPage />,
                  },
                  {
                    path: `${routePaths.influencers}/:profileId/tab/:tab`,
                    element: <InfluencerDetailPage />,
                  },
                ],
              },
              {
                element: (
                  <PermissionGuard
                    permission={routePermissions.notifications}
                  />
                ),
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
                element: (
                  <PermissionGuard permission={routePermissions.content} />
                ),
                children: [
                  {
                    path: routePaths.content,
                    element: <ContentPage />,
                  },
                  {
                    path: routePaths.customerAppHome,
                    element: <CustomerAppHomePage />,
                  },
                  {
                    path: routePaths.customerAppHomeCarouselSlide,
                    element: <CustomerAppHomeSlideDetailPage />,
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
                element: (
                  <PermissionGuard
                    permission={routePermissions.marketingCampaigns}
                  />
                ),
                children: [
                  {
                    path: routePaths.marketingCampaigns,
                    element: <MarketingCampaignsPage />,
                  },
                  {
                    path: routePaths.marketingCampaignCreate,
                    element: <CreateMarketingCampaignPage />,
                  },
                  {
                    path: routePaths.marketingCampaignDetail,
                    element: <MarketingCampaignDetailPage />,
                  },
                ],
              },
              {
                element: (
                  <PermissionGuard permission={routePermissions.reports} />
                ),
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
                element: (
                  <PermissionGuard permission={routePermissions.settings} />
                ),
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
                // The overview asks the backend for both halves and renders the
                // permitted one, so it is guarded by login only.
                element: <PermissionGuard />,
                children: [
                  {
                    path: routePaths.release2Overview,
                    element: <Release2OverviewPage />,
                  },
                ],
              },
              {
                element: (
                  <PermissionGuard
                    permission={routePermissions.influencerCampaigns}
                  />
                ),
                children: [
                  {
                    path: routePaths.influencerCampaigns,
                    element: <InfluencerCampaignsPage />,
                  },
                ],
              },
              {
                element: (
                  <PermissionGuard
                    permission={routePermissions.influencerPayouts}
                  />
                ),
                children: [
                  {
                    path: routePaths.influencerPayouts,
                    element: <InfluencerPayoutsPage />,
                  },
                ],
              },
              {
                element: (
                  <PermissionGuard permission={routePermissions.featureFlags} />
                ),
                children: [
                  {
                    path: routePaths.featureFlags,
                    element: <FeatureFlagsPage />,
                  },
                  {
                    path: routePaths.featureFlagDetail,
                    element: <FeatureFlagDetailPage />,
                  },
                ],
              },
              {
                element: (
                  <PermissionGuard
                    permission={routePermissions.release2Settings}
                  />
                ),
                children: [
                  {
                    path: routePaths.release2Settings,
                    element: <Release2SettingsPage />,
                  },
                  {
                    path: routePaths.release2SettingDetail,
                    element: <Release2SettingDetailPage />,
                  },
                ],
              },
              {
                element: <PermissionGuard />,
                children: [
                  {
                    path: routePaths.customerRetention,
                    element: <CustomerRetentionPage />,
                  },
                ],
              },
              {
                element: (
                  <PermissionGuard permission={routePermissions.audit} />
                ),
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
  { path: "*", element: <NotFoundPage /> },
];
