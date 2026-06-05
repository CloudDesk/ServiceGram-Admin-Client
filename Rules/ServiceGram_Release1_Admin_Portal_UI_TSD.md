# ServiceGram Release 1 - Admin Portal Web App UI Technical Specification Document

**Document Type:** Technical Specification Document  
**Application:** Admin Portal Web App  
**Release:** Release 1 / Phase 1  
**Scope:** UI-only development specification  
**Backend Dependency:** Backend APIs will be integrated after backend development and API documentation are finalized  
**Prepared For:** Texve Service Media Pvt Ltd  
**Project:** ServiceGram / Texve Service Media Platform  
**Document Status:** Development Baseline  

---

## 1. Purpose

This document defines the technical specification for developing the Release 1 Admin Portal Web App UI.

The Admin Portal is the internal operations interface used by authorized admin users to manage vendors, customers, orders, manual logistics statuses, payments, payouts, reels, notifications, content, reports, users, and platform settings.

This document is intentionally focused on the web UI layer only. Backend API integration will be added after backend development is completed and the backend API documentation is available.

---

## 2. Finalized Admin Portal Technology Stack

| Area | Final Decision |
|---|---|
| Web Framework | React + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | Custom Tailwind components only |
| Routing | React Router |
| Server State | TanStack Query |
| Local UI State | Zustand |
| Forms | React Hook Form |
| Validation | Zod |
| Tables | Custom table components using TanStack Table internally |
| Charts | Recharts or lightweight custom chart wrappers |
| Icons | Lucide React or equivalent lightweight icon set |
| Date Handling | date-fns |
| Admin Hosting | Firebase Hosting |
| Backend Integration | REST APIs after backend API documentation is available |
| Auth Integration | Backend-issued JWT after API integration |
| Realtime Admin Updates | Server-Sent Events after backend API integration |

---

## 3. Phase 1 Admin Portal Scope

### 3.1 Included Modules

The Admin Portal UI must support the following Phase 1 modules:

1. Login
2. Dashboard
3. Admin User Management
4. Customer Management
5. Vendor Management
6. Vendor Onboarding Queue
7. Order Management
8. Manual Delivery / Logistics Control
9. Payment Management
10. Vendor Payout Management
11. Reel Moderation
12. Push Notification Center
13. Content Management
14. Reports
15. Platform Settings
16. Audit Log Views where applicable
17. Profile / Session Management

### 3.2 Not Included in Admin Portal UI Scope

The following UI modules must not be built for Release 1:

1. Offers module
2. Field Executive assignment module
3. Delivery Partner management
4. Root Cabs integration screens
5. Influencer management
6. Reel performance analytics dashboards
7. WhatsApp campaign center
8. AI moderation screens
9. Loyalty, rewards, subscriptions, or campaign center
10. Live driver tracking screens

---

## 4. Admin User Roles for UI Permission Handling

The UI must support role-aware navigation and action visibility.

### 4.1 Required Roles

| Role | UI Access Summary |
|---|---|
| Super Admin | Full access to all Phase 1 modules and settings |
| Operations Admin | Dashboard, customers, vendors, orders, manual logistics, reels, reports, settings view where allowed |
| Marketing Admin | Notifications, content, selected dashboard widgets, customer/vendor communication actions |
| Finance Admin | Payments, refunds, payouts, finance reports, finance dashboard widgets |
| Customer Support | Customers, orders, refunds initiation, customer notes, selected reports |
| Content Moderator | Reel moderation, content review, selected content management |

### 4.2 UI Permission Rules

1. Role restrictions must be enforced visually in the UI and authoritatively by the backend after API integration.
2. UI must hide actions that the user cannot perform.
3. UI must show read-only views where the role can view but not edit.
4. Unauthorized route access must redirect to an access denied page.
5. Navigation menu must only show allowed modules.
6. Destructive actions must require confirmation.
7. Sensitive financial data must be hidden for non-finance roles.
8. UI should never rely on frontend-only permission checks for security.

---

## 5. UI Development Strategy Before Backend API Availability

Since backend APIs will be integrated later, the Admin Portal must be developed using a clean API abstraction pattern.

### 5.1 Initial UI Development Mode

The UI should initially use mock service adapters and mock data files.

```txt
UI Components -> Feature Hooks -> Service Interface -> Mock Service Implementation
```

After backend API documentation is finalized, mock service implementations will be replaced with real API service implementations.

```txt
UI Components -> Feature Hooks -> Service Interface -> HTTP API Implementation
```

### 5.2 Mock Data Rules

1. Mock data must follow realistic Release 1 domain structures.
2. Mock data must include empty states, success states, pending states, error states, and permission-restricted states.
3. Mock IDs must resemble production IDs but must not expose real user/vendor data.
4. Mock services must simulate latency for loading states.
5. Mock services must simulate common failures for error UI testing.

### 5.3 API Integration Readiness Rules

1. All data access must go through feature services.
2. Components must not call `fetch` or `axios` directly.
3. API response mapping must be isolated in service layer mappers.
4. UI routes must not depend on backend URL structure directly.
5. Request/response types must be declared in feature-level `types` files and updated when backend API docs are available.

---

## 6. Application Architecture

### 6.1 Architecture Style

The Admin Portal must use a feature-based modular architecture.

```txt
src/
  app/
  assets/
  components/
  config/
  constants/
  features/
  hooks/
  layouts/
  lib/
  mock/
  providers/
  routes/
  services/
  styles/
  types/
  utils/
```

### 6.2 Layer Responsibilities

| Layer | Responsibility |
|---|---|
| app | App bootstrap, providers, app shell setup |
| routes | Route definitions and guards |
| layouts | Admin layout, auth layout, module layouts |
| features | Feature-specific pages, components, hooks, services, types |
| components | Shared reusable UI components |
| services | Global HTTP client, mock adapter, API adapter |
| providers | Query provider, auth provider, theme provider, toast provider |
| utils | Generic helpers and formatters |
| constants | Global static values |
| config | Environment and app config |
| styles | Tailwind base and global styles |
| mock | Mock datasets and mock API handlers |

---

## 7. Recommended Folder Structure

```txt
servicegram-admin-portal/
  public/
    favicon.ico
    logo.svg
    mock-images/

  src/
    app/
      App.tsx
      main.tsx
      AppProviders.tsx
      ErrorBoundary.tsx

    assets/
      images/
      icons/

    components/
      ui/
        Button/
          Button.tsx
          Button.types.ts
          index.ts
        Input/
        Select/
        Textarea/
        Checkbox/
        Radio/
        Switch/
        DatePicker/
        FileUpload/
        Modal/
        Drawer/
        Badge/
        Card/
        Tabs/
        Table/
        Pagination/
        Tooltip/
        Dropdown/
        Toast/
        Skeleton/
        EmptyState/
        ErrorState/
        ConfirmDialog/
        StatusTimeline/
        StatCard/
        FilterPanel/
        SearchInput/
        PageHeader/
        Breadcrumbs/
        Stepper/
        Avatar/
        Tag/
        CopyText/
        MoneyText/
        DateTimeText/
        RoleGuard/
      layout/
        Sidebar.tsx
        Topbar.tsx
        MobileSidebar.tsx
        ModuleHeader.tsx
        PageContainer.tsx
      feedback/
        GlobalLoadingBar.tsx
        InlineAlert.tsx
        FormErrorSummary.tsx

    config/
      env.ts
      routes.ts
      featureFlags.ts
      permissions.ts
      navigation.ts

    constants/
      roles.ts
      statuses.ts
      pagination.ts
      dateFormats.ts
      messages.ts

    features/
      auth/
        pages/
          LoginPage.tsx
          ForgotPasswordPage.tsx
          ResetPasswordPage.tsx
        components/
          LoginForm.tsx
          PasswordInput.tsx
        hooks/
          useLogin.ts
          useAuthSession.ts
        services/
          auth.service.ts
          auth.mock.ts
        types/
          auth.types.ts
        schemas/
          auth.schema.ts
        utils/
          authTokens.ts

      dashboard/
        pages/
          DashboardPage.tsx
        components/
          DashboardKpiGrid.tsx
          OrdersByStatusCard.tsx
          PendingActionsCard.tsx
          PaymentSummaryCard.tsx
          CategoryOrderChart.tsx
          ZoneOrderChart.tsx
        hooks/
          useDashboardData.ts
        services/
          dashboard.service.ts
          dashboard.mock.ts
        types/
          dashboard.types.ts

      admin-users/
        pages/
          AdminUsersListPage.tsx
          AdminUserDetailPage.tsx
          AdminUserCreatePage.tsx
        components/
          AdminUsersTable.tsx
          AdminUserForm.tsx
          RoleSelector.tsx
          LoginHistoryTable.tsx
        hooks/
          useAdminUsers.ts
        services/
          adminUsers.service.ts
          adminUsers.mock.ts
        types/
          adminUsers.types.ts
        schemas/
          adminUsers.schema.ts

      customers/
        pages/
          CustomersListPage.tsx
          CustomerDetailPage.tsx
        components/
          CustomersTable.tsx
          CustomerFilters.tsx
          CustomerProfileCard.tsx
          CustomerOrdersTab.tsx
          CustomerPaymentsTab.tsx
          CustomerWalletTab.tsx
          CustomerNotesTab.tsx
          CustomerActivityTab.tsx
          CustomerActionBar.tsx
        hooks/
          useCustomers.ts
          useCustomerDetail.ts
        services/
          customers.service.ts
          customers.mock.ts
        types/
          customers.types.ts
        schemas/
          customerNotes.schema.ts

      vendors/
        pages/
          VendorsListPage.tsx
          VendorDetailPage.tsx
        components/
          VendorsTable.tsx
          VendorFilters.tsx
          VendorProfileCard.tsx
          VendorServicesTab.tsx
          VendorOrdersTab.tsx
          VendorDocumentsTab.tsx
          VendorPaymentsTab.tsx
          VendorReelsTab.tsx
          VendorNotesTab.tsx
          VendorStatusActions.tsx
        hooks/
          useVendors.ts
          useVendorDetail.ts
        services/
          vendors.service.ts
          vendors.mock.ts
        types/
          vendors.types.ts
        schemas/
          vendor.schema.ts

      vendor-onboarding/
        pages/
          VendorOnboardingQueuePage.tsx
          VendorOnboardingDetailPage.tsx
        components/
          OnboardingKanban.tsx
          OnboardingCard.tsx
          OnboardingStageColumn.tsx
          DocumentReviewPanel.tsx
          MissingDocumentDialog.tsx
          VendorApprovalDialog.tsx
          VendorRejectionDialog.tsx
        hooks/
          useOnboardingQueue.ts
        services/
          onboarding.service.ts
          onboarding.mock.ts
        types/
          onboarding.types.ts
        schemas/
          onboarding.schema.ts

      orders/
        pages/
          OrdersListPage.tsx
          OrderDetailPage.tsx
        components/
          OrdersTable.tsx
          OrderFilters.tsx
          OrderHeaderCard.tsx
          OrderTimeline.tsx
          OrderCustomerCard.tsx
          OrderVendorCard.tsx
          OrderServiceDetailsCard.tsx
          OrderPaymentCard.tsx
          OrderNotesPanel.tsx
          OrderStatusBadge.tsx
          OrderActionBar.tsx
          CancelOrderDialog.tsx
          OverrideStatusDialog.tsx
        hooks/
          useOrders.ts
          useOrderDetail.ts
        services/
          orders.service.ts
          orders.mock.ts
        types/
          orders.types.ts
        schemas/
          orders.schema.ts

      manual-logistics/
        pages/
          ManualLogisticsPage.tsx
        components/
          LogisticsStatusPanel.tsx
          LogisticsUpdateDialog.tsx
          ProofImageUploader.tsx
          PackageIssueDialog.tsx
          DeliveryOtpDialog.tsx
          LogisticsHistoryTable.tsx
        hooks/
          useManualLogistics.ts
        services/
          manualLogistics.service.ts
          manualLogistics.mock.ts
        types/
          manualLogistics.types.ts
        schemas/
          manualLogistics.schema.ts

      payments/
        pages/
          PaymentsOverviewPage.tsx
          PaymentDetailPage.tsx
        components/
          PaymentSummaryCards.tsx
          TransactionsTable.tsx
          PaymentFilters.tsx
          RefundDialog.tsx
          PaymentStatusBadge.tsx
          RazorpayReferencePanel.tsx
        hooks/
          usePayments.ts
        services/
          payments.service.ts
          payments.mock.ts
        types/
          payments.types.ts
        schemas/
          payments.schema.ts

      payouts/
        pages/
          PayoutsPage.tsx
          PayoutDetailPage.tsx
        components/
          PayoutQueueTable.tsx
          PayoutHistoryTable.tsx
          HeldPayoutsTable.tsx
          PayoutActionDialog.tsx
          PayoutStatusBadge.tsx
        hooks/
          usePayouts.ts
        services/
          payouts.service.ts
          payouts.mock.ts
        types/
          payouts.types.ts
        schemas/
          payouts.schema.ts

      reels/
        pages/
          ReelModerationPage.tsx
          ReelDetailPage.tsx
        components/
          PendingReelGrid.tsx
          ReelReviewCard.tsx
          ReelVideoPreview.tsx
          ReelApprovalDialog.tsx
          ReelRejectionDialog.tsx
          LiveReelGrid.tsx
          ReelStatusBadge.tsx
        hooks/
          useReels.ts
        services/
          reels.service.ts
          reels.mock.ts
        types/
          reels.types.ts
        schemas/
          reels.schema.ts

      notifications/
        pages/
          NotificationsPage.tsx
          NotificationCreatePage.tsx
          NotificationDetailPage.tsx
        components/
          NotificationListTable.tsx
          NotificationComposer.tsx
          AudienceBuilder.tsx
          NotificationPreview.tsx
          NotificationSchedulePanel.tsx
          NotificationTemplateSelector.tsx
        hooks/
          useNotifications.ts
        services/
          notifications.service.ts
          notifications.mock.ts
        types/
          notifications.types.ts
        schemas/
          notifications.schema.ts

      content/
        pages/
          ContentManagementPage.tsx
          ContentEditorPage.tsx
        components/
          ContentListTable.tsx
          ContentEditor.tsx
          ContentPreview.tsx
          VersionHistoryPanel.tsx
          PublishDialog.tsx
          RollbackDialog.tsx
        hooks/
          useContent.ts
        services/
          content.service.ts
          content.mock.ts
        types/
          content.types.ts
        schemas/
          content.schema.ts

      reports/
        pages/
          ReportsPage.tsx
          ReportDetailPage.tsx
        components/
          ReportCatalog.tsx
          ReportFilters.tsx
          ReportDataTable.tsx
          ReportExportDialog.tsx
          ReportStatusBadge.tsx
        hooks/
          useReports.ts
        services/
          reports.service.ts
          reports.mock.ts
        types/
          reports.types.ts
        schemas/
          reports.schema.ts

      settings/
        pages/
          SettingsPage.tsx
        components/
          CategorySettingsPanel.tsx
          ZoneSettingsPanel.tsx
          VendorSettingsPanel.tsx
          OrderSettingsPanel.tsx
          PaymentSettingsPanel.tsx
          NotificationSettingsPanel.tsx
          ReelSettingsPanel.tsx
          SettingsAuditPanel.tsx
        hooks/
          useSettings.ts
        services/
          settings.service.ts
          settings.mock.ts
        types/
          settings.types.ts
        schemas/
          settings.schema.ts

      audit/
        pages/
          AuditLogPage.tsx
        components/
          AuditLogTable.tsx
          AuditLogFilters.tsx
          AuditEventDetailDrawer.tsx
        hooks/
          useAuditLogs.ts
        services/
          audit.service.ts
          audit.mock.ts
        types/
          audit.types.ts

      profile/
        pages/
          MyProfilePage.tsx
        components/
          ProfileForm.tsx
          ChangePasswordForm.tsx
          SessionList.tsx
        hooks/
          useProfile.ts
        services/
          profile.service.ts
          profile.mock.ts
        types/
          profile.types.ts
        schemas/
          profile.schema.ts

    hooks/
      useDebounce.ts
      useDisclosure.ts
      usePagination.ts
      usePermission.ts
      useQueryParams.ts
      useTableState.ts
      useToast.ts
      usePrevious.ts

    layouts/
      AuthLayout.tsx
      AdminLayout.tsx
      ModuleLayout.tsx
      ErrorLayout.tsx

    lib/
      queryClient.ts
      table.ts
      date.ts
      money.ts
      logger.ts
      storage.ts
      download.ts
      permissions.ts
      formatters.ts

    mock/
      db/
        customers.mock.ts
        vendors.mock.ts
        orders.mock.ts
        payments.mock.ts
        payouts.mock.ts
        reels.mock.ts
        users.mock.ts
      delay.ts
      errors.ts
      mockConfig.ts

    providers/
      AuthProvider.tsx
      QueryProvider.tsx
      ToastProvider.tsx
      PermissionProvider.tsx

    routes/
      AppRoutes.tsx
      ProtectedRoute.tsx
      PublicRoute.tsx
      AccessDeniedPage.tsx
      NotFoundPage.tsx
      routeConfig.tsx

    services/
      apiClient.ts
      mockClient.ts
      serviceFactory.ts
      apiErrorMapper.ts
      fileDownload.service.ts
      realtime.service.ts

    styles/
      globals.css
      tailwind.css

    types/
      common.types.ts
      api.types.ts
      table.types.ts
      permissions.types.ts
      status.types.ts

    utils/
      cn.ts
      formatDate.ts
      formatMoney.ts
      formatPhone.ts
      buildQueryParams.ts
      safeJson.ts
      downloadFile.ts
      validation.ts

  .env.example
  .gitignore
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.ts
  postcss.config.js
  eslint.config.js
  prettier.config.js
  firebase.json
  README.md
```

---

## 8. Route Structure

All protected routes must use the Admin Layout.

```txt
/login
/forgot-password
/reset-password

/app/dashboard
/app/admin-users
/app/admin-users/new
/app/admin-users/:adminUserId

/app/customers
/app/customers/:customerId

/app/vendors
/app/vendors/:vendorId

/app/vendor-onboarding
/app/vendor-onboarding/:vendorId

/app/orders
/app/orders/:orderId
/app/orders/:orderId/logistics

/app/payments
/app/payments/:paymentId

/app/payouts
/app/payouts/:payoutId

/app/reels
/app/reels/:reelId

/app/notifications
/app/notifications/new
/app/notifications/:notificationId

/app/content
/app/content/:contentId

/app/reports
/app/reports/:reportKey

/app/settings
/app/audit-logs
/app/profile

/access-denied
/not-found
```

---

## 9. Navigation Structure

### 9.1 Sidebar Navigation

```txt
Dashboard
Customers
Vendors
Vendor Onboarding
Orders
Manual Logistics
Payments
Payouts
Reels
Notifications
Content
Reports
Settings
Admin Users
Audit Logs
```

### 9.2 Navigation Rules

1. Navigation must be generated from a typed route config.
2. Each item must define label, route, icon, permission, and active route pattern.
3. Menu items must not be hardcoded inside layout components.
4. Collapsible sidebar must be supported.
5. Current route must be highlighted.
6. Mobile viewport must use drawer-style sidebar.
7. Breadcrumbs must be generated from route metadata.

---

## 10. Design System

### 10.1 Design Principles

1. Fast internal operations over decorative UI.
2. High readability for table-heavy screens.
3. Clear status visibility.
4. Low-click operational actions.
5. Strong empty, loading, and error states.
6. Consistent spacing and typography.
7. Accessibility-friendly components.
8. Mobile-responsive enough for tablet and small laptop views, but optimized for desktop operations.

### 10.2 Tailwind Token Strategy

Use Tailwind design tokens for:

1. Colors
2. Typography
3. Spacing
4. Border radius
5. Shadows
6. Status colors
7. Z-index
8. Layout widths
9. Breakpoints

### 10.3 Required Global CSS Variables

```css
:root {
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-border: #e2e8f0;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-success: #16a34a;
  --color-warning: #f59e0b;
  --color-danger: #dc2626;
  --color-info: #0284c7;
}
```

Brand colors can be updated after final Texve visual identity approval.

---

## 11. Shared UI Components

### 11.1 Component Development Rules

1. Every shared component must be typed.
2. Every shared component must support disabled, loading, and error states where relevant.
3. Components must not include feature-specific business logic.
4. Components must accept className overrides through a controlled `cn()` utility.
5. Components must be accessible by keyboard where applicable.
6. Components must be documented with usage examples in the repo README or a component index.
7. Components must not fetch data internally.

### 11.2 Required Components

| Component | Purpose |
|---|---|
| Button | Primary, secondary, destructive, ghost, link actions |
| Input | Text, phone, email, amount, numeric input |
| Select | Single select field |
| MultiSelect | Multi-value filters and role assignments |
| Textarea | Notes, rejection reasons, comments |
| Checkbox | Row selection and settings toggles |
| RadioGroup | Status/action options |
| Switch | Boolean settings |
| DatePicker | Date selection |
| DateRangePicker | Report/filter ranges |
| FileUpload | Documents, proof images, content files |
| Modal | Confirmation and forms |
| Drawer | Detail preview panels |
| Badge | Status and category labels |
| Card | Dashboard and detail sections |
| Tabs | Detail pages with multiple sections |
| Table | List pages and reports |
| Pagination | Server-side pagination UI |
| FilterPanel | Advanced filters |
| SearchInput | Debounced search |
| EmptyState | No-data state |
| ErrorState | Recoverable failure state |
| Skeleton | Loading placeholders |
| Toast | Success/error alerts |
| ConfirmDialog | Destructive action confirmation |
| StatusTimeline | Order/logistics lifecycle display |
| StatCard | Dashboard KPI cards |
| PageHeader | Title, subtitle, primary action |
| Breadcrumbs | Route context |
| RoleGuard | Conditional rendering by permission |
| MoneyText | Currency display |
| DateTimeText | Date/time display |
| CopyText | Copyable IDs/references |
| Avatar | User/vendor/customer identity |
| Tooltip | Secondary information |
| Dropdown | Row action menus |

---

## 12. Status Design System

Statuses must use consistent labels, colors, and icons across the Admin Portal.

### 12.1 Order Statuses

| Status | UI Label | Visual Tone |
|---|---|---|
| order_placed | Order Placed | Info |
| vendor_acceptance_pending | Vendor Acceptance Pending | Warning |
| vendor_accepted | Vendor Accepted | Success |
| pickup_scheduled | Pickup Scheduled | Info |
| picked_up_from_customer | Picked Up from Customer | Info |
| handed_over_to_vendor | Handed Over to Vendor | Info |
| item_received_by_vendor | Item Received by Vendor | Success |
| service_in_progress | Service In Progress | Info |
| service_completed | Service Completed | Success |
| collected_from_vendor | Collected from Vendor | Info |
| out_for_delivery | Out for Delivery | Info |
| delivered | Delivered | Success |
| cancelled | Cancelled | Neutral/Danger |
| delivery_failed | Delivery Failed | Danger |
| customer_unavailable | Customer Unavailable | Warning |
| item_damaged | Item Damaged | Danger |
| item_lost | Item Lost | Danger |
| wrong_item | Wrong Item | Danger |
| rescheduled_delivery | Rescheduled Delivery | Warning |

### 12.2 Vendor Statuses

| Status | UI Label | Visual Tone |
|---|---|---|
| pending | Pending | Warning |
| documents_pending | Documents Pending | Warning |
| under_review | Under Review | Info |
| approved | Approved | Success |
| active | Active | Success |
| inactive | Inactive | Neutral |
| suspended | Suspended | Danger |
| rejected | Rejected | Danger |

### 12.3 Reel Statuses

| Status | UI Label | Visual Tone |
|---|---|---|
| pending_review | Pending Review | Warning |
| approved | Approved | Success |
| rejected | Rejected | Danger |
| edit_requested | Edit Requested | Warning |
| paused | Paused | Neutral |
| removed | Removed | Danger |

### 12.4 Payment Statuses

| Status | UI Label | Visual Tone |
|---|---|---|
| pending | Pending | Warning |
| success | Successful | Success |
| failed | Failed | Danger |
| refunded | Refunded | Info |
| partially_refunded | Partially Refunded | Info |
| cod_pending | COD Pending | Warning |

### 12.5 Payout Statuses

| Status | UI Label | Visual Tone |
|---|---|---|
| pending | Pending | Warning |
| under_review | Under Review | Info |
| held | Held | Warning |
| approved | Approved | Success |
| paid | Paid | Success |
| failed | Failed | Danger |
| adjusted | Adjusted | Info |
| cancelled | Cancelled | Neutral |

---

## 13. Page Specifications

## 13.1 Login Page

### Purpose

Allow admin users to log in using email and password.

### UI Elements

1. ServiceGram logo
2. Email input
3. Password input
4. Show/hide password
5. Login button
6. Forgot password link
7. Error message area
8. Loading state

### Validation

| Field | Rule |
|---|---|
| Email | Required, valid email format |
| Password | Required, minimum length based on backend policy |

### States

1. Empty form
2. Invalid input
3. Submitting
4. Invalid credentials
5. Account disabled
6. Login successful
7. Server unavailable

### User-Friendly Error Messages

| Scenario | Message |
|---|---|
| Empty email | Please enter your email address. |
| Invalid email | Please enter a valid email address. |
| Empty password | Please enter your password. |
| Invalid credentials | The email or password is incorrect. Please check and try again. |
| Account inactive | Your admin account is inactive. Please contact a Super Admin. |
| Network error | We could not connect to the server. Please check your internet connection and try again. |

---

## 13.2 Dashboard Page

### Purpose

Provide a quick operational overview of the platform.

### UI Sections

1. KPI cards
2. Pending actions
3. Orders by status
4. Category-wise order count
5. Zone-wise order count
6. Payment summary for authorized roles
7. Pending vendor approvals
8. Pending reel approvals
9. Recent order activity

### KPI Cards

1. Today’s orders
2. Active vendors
3. New customers
4. Pending vendor approvals
5. Pending reel approvals
6. Active orders
7. Completed orders
8. Pending refunds
9. Payment failures
10. GMV for finance-authorized roles

### Required Interactions

1. Click KPI to navigate to filtered list.
2. Date range selector.
3. Role-based hidden finance widgets.
4. Refresh button.
5. Loading skeletons.
6. Empty states.

### UI Performance Requirement

Dashboard must render skeleton layout immediately and load data sections independently.

---

## 13.3 Admin User Management

### Purpose

Manage admin users, roles, session visibility, and access status.

### List Page Columns

1. Admin name
2. Email
3. Role
4. Status
5. Last login
6. Created date
7. Actions

### Detail Page Tabs

1. Profile
2. Role and access
3. Login history
4. Session history
5. Audit activity

### Actions

1. Create admin user
2. Edit admin user
3. Activate/deactivate user
4. Change role
5. Force logout
6. View audit log

### Dialog Rules

1. Role change requires confirmation.
2. Deactivation requires reason.
3. Force logout requires confirmation.

---

## 13.4 Customer Management

### Customer List Columns

1. Customer ID
2. Name
3. Phone
4. City/zone
5. Registration date
6. Order count
7. Total spent
8. Status
9. Last active
10. Actions

### Filters

1. Search by name, phone, customer ID
2. City
3. Zone
4. Status
5. Registration date range
6. Order count range
7. Spend range

### Customer Detail Tabs

1. Overview
2. Orders
3. Payments
4. Wallet
5. Refunds
6. Notifications
7. Notes
8. Activity log

### Admin Actions

1. Block/unblock customer
2. Add internal note
3. Send notification
4. Initiate refund, role-based
5. Credit wallet, role-based
6. Export customer data, role-based

### UI Error Messages

| Scenario | Message |
|---|---|
| Customer not found | We could not find this customer. The account may have been removed or the link may be invalid. |
| Block failed | The customer could not be blocked. Please refresh and try again. |
| Note save failed | The note was not saved. Please check your connection and try again. |

---

## 13.5 Vendor Management

### Vendor List Columns

1. Vendor ID
2. Shop name
3. Category
4. Zone
5. Status
6. Order count
7. Referral ID
8. Rating placeholder if available later
9. Last active
10. Actions

### Filters

1. Search by vendor ID, shop name, phone
2. Category
3. Zone
4. Status
5. Referral ID
6. Registration date range

### Vendor Detail Tabs

1. Profile
2. Services
3. Pricing
4. Orders
5. Reels
6. Documents
7. Payments
8. Notes
9. Activity

### Vendor Actions

1. Approve vendor
2. Reject vendor
3. Suspend vendor
4. Reactivate vendor
5. Verify documents
6. Change status
7. Add admin note
8. Override service price if allowed
9. Download vendor profile

### Important UI Rules

1. Suspension action must request reason.
2. Rejection action must request reason.
3. Document verification must be visible per document.
4. Active vendor status must be visually obvious.
5. Vendor payment tab must be restricted by role.

---

## 13.6 Vendor Onboarding Queue

### Purpose

Track vendor onboarding and approval pipeline.

### Queue Stages

1. New Application
2. Documents Pending
3. Under Review
4. Service Menu Pending
5. Awaiting Activation
6. Approved
7. Rejected

### UI Layout

A Kanban-style queue is recommended for operations visibility.

### Vendor Card Fields

1. Shop name
2. Category
3. Zone
4. Vendor phone
5. Referral ID if available
6. Submitted date
7. Current stage
8. Missing document count
9. Action menu

### Actions

1. Move onboarding stage
2. Add rejection reason
3. Send reminder
4. Upload missing document if submitted through admin workflow
5. Approve activation
6. Reject application

### UI Rules

1. Moving to Approved must require required documents verified.
2. Rejection must require reason.
3. Stage changes must show confirmation when irreversible.

---

## 13.7 Order Management

### Order List Columns

1. Order ID
2. Customer
3. Vendor
4. Category
5. Zone
6. Order value
7. Payment status
8. Current order status
9. Created date
10. Expected pickup date/time
11. Expected delivery date/time
12. Actions

### Filters

1. Search by order ID, customer phone, vendor name
2. Order status
3. Payment status
4. Category
5. Zone
6. Created date range
7. Expected pickup date range
8. Expected delivery date range

### Order Detail Sections

1. Order header
2. Customer details
3. Vendor details
4. Service details
5. Pickup address
6. Return address
7. Payment summary
8. Order timeline
9. Manual logistics history
10. Uploaded photos/proofs
11. Internal notes
12. Action history

### Actions

1. Update manual logistics status
2. Override order stage with reason
3. Reassign vendor if allowed
4. Cancel order
5. Trigger notification
6. Initiate refund
7. Download order PDF
8. Add internal note

### Required UI Safety Rules

1. Order cancellation must require reason.
2. Status override must require reason.
3. Refund action must show payment context.
4. Delivery completion must require OTP validation UI.
5. Package issue statuses must request issue type and note.

---

## 13.8 Manual Delivery / Logistics Control

### Purpose

Allow admin users to manually update pickup, delivery, and package movement statuses.

### Status Actions

1. Schedule pickup
2. Mark picked up from customer
3. Mark handed over to vendor
4. Mark item received by vendor
5. Mark collected from vendor
6. Mark out for delivery
7. Mark delivered after OTP validation
8. Mark delivery failed
9. Mark customer unavailable
10. Report item damaged
11. Report item lost
12. Report wrong item
13. Reschedule delivery

### Logistics Update Form Fields

| Field | Requirement |
|---|---|
| New status | Required |
| Internal note | Optional for normal statuses, required for exception statuses |
| Proof image | Required where configured by status |
| Package condition | Required for package issue statuses |
| Customer notification | Optional toggle where allowed |
| Vendor notification | Optional toggle where allowed |
| OTP | Required only for delivered status |

### UI Rules

1. Delivery status must not be marked delivered without OTP field.
2. Exception statuses must have a clear red/danger visual tone.
3. Proof upload must preview selected files.
4. Previous logistics updates must be visible in chronological order.
5. Manual updates must show who updated and when after API integration.

---

## 13.9 Payment Management

### Payment Overview Sections

1. GMV summary
2. Successful payments
3. Failed payments
4. Refunds
5. COD orders
6. Wallet transactions
7. Vendor payable amount
8. Pending payouts

### Transaction Table Columns

1. Transaction ID
2. Order ID
3. Customer
4. Vendor
5. Amount
6. Method
7. Status
8. Razorpay reference
9. Refund status
10. Created date
11. Actions

### Actions

1. View transaction detail
2. Initiate refund
3. Approve refund, role-based
4. Export transactions
5. Reconcile transaction
6. Hold payment if required by dispute/business rule

### UI Rules

1. Payment actions visible only to authorized roles.
2. Refund dialogs must show amount, paid amount, refundable amount, and reason field.
3. Failed payments must show specific failure reason where available.

---

## 13.10 Vendor Payout Management

### Payout Page Tabs

1. Payout Queue
2. Held Payouts
3. Failed Payouts
4. Payout History
5. Bank Verification Status

### Payout Queue Columns

1. Payout ID
2. Vendor
3. Eligible orders
4. Gross amount
5. Deductions
6. Net payable
7. Status
8. Bank verification status
9. Created date
10. Actions

### Actions

1. Approve payout
2. Hold payout
3. Release hold
4. Adjust payout with reason
5. Mark as paid
6. Mark as failed
7. Export payout report

### UI Rules

1. Hold requires reason.
2. Adjustment requires reason and amount.
3. Mark as paid requires payment reference or UTR.
4. Payout financial fields must be hidden from unauthorized roles.

---

## 13.11 Reel Moderation

### Purpose

Review vendor-uploaded reels before they appear in the Customer App.

### Pending Reel Card Fields

1. Thumbnail
2. Vendor name
3. Category
4. Price indicator
5. Upload date
6. Current status
7. Action buttons

### Reel Detail View

1. Video preview
2. Vendor profile summary
3. Category tag
4. Caption
5. Price indicator
6. Moderation history
7. Approval/rejection actions

### Actions

1. Approve reel
2. Reject with reason
3. Request edit
4. Pause live reel
5. Remove live reel

### UI Rules

1. Reject requires reason.
2. Request edit requires instruction text.
3. Video preview must use Cloudflare Stream playback URL after backend integration.
4. Loading fallback must be shown for video preview.
5. Unsafe or unavailable video must display recoverable error state.

---

## 13.12 Push Notification Center

### Purpose

Allow authorized admins to create and manage customer/vendor push notifications and SMS templates where applicable.

### Notification Types

1. Broadcast
2. Segment-based
3. One-to-one
4. Automated trigger, read/configure where allowed

### Notification Composer Fields

1. App target: Customer App or Vendor App
2. Channel: Push, SMS where configured
3. Title
4. Body
5. Audience
6. Schedule time
7. Send now
8. Save draft
9. Preview
10. Test notification
11. Frequency cap

### UI Rules

1. Customer and vendor audiences must not be mixed accidentally.
2. Character count must be shown for title and body.
3. Preview must show mobile-style notification card.
4. Send action must require confirmation.
5. Scheduled notifications must show local date/time clearly.

---

## 13.13 Content Management

### Content Types

1. Onboarding banners
2. App banners
3. FAQs
4. Help content
5. Notification templates
6. SMS templates
7. Terms and conditions
8. Privacy policy
9. Static pages

### Required Features

1. Create
2. Edit
3. Publish
4. Archive
5. Rollback
6. Preview
7. Version history

### UI Rules

1. Publish must require confirmation.
2. Rollback must display target version details.
3. Unsaved changes warning must be shown before navigation.
4. Preview must be separate from edit mode.

---

## 13.14 Reports

### Report Categories

1. Operations Reports
2. Vendor Reports
3. Customer Reports
4. Finance Reports
5. Admin Audit Reports

### Required Reports

#### Operations Reports

1. Order lifecycle report
2. Vendor inactivity report
3. Manual logistics report
4. Dispute report if enabled

#### Vendor Reports

1. Vendor list
2. Vendor onboarding pipeline
3. Vendor order performance
4. Vendor payout history

#### Customer Reports

1. Customer list
2. Booking history
3. Payment history
4. Wallet transactions
5. Refund history

#### Finance Reports

1. GMV
2. Payments
3. Refunds
4. Payouts
5. Failed transactions
6. COD orders
7. Razorpay reconciliation

#### Admin Audit Reports

1. Login history
2. Role changes
3. Manual order overrides
4. Payment actions
5. Vendor approval actions
6. Reel moderation actions
7. Settings changes

### UI Rules

1. Reports must have filters.
2. Reports must support export action UI.
3. Export status must be visible after backend integration.
4. Large reports must show “export will be prepared” style UI when background export is used.
5. Finance reports must be role-restricted.

---

## 13.15 Platform Settings

### Settings Sections

1. Category settings
2. Zone settings
3. Vendor settings
4. Order settings
5. Payment settings
6. Notification settings
7. Reel settings
8. Audit settings view

### Category Settings

1. Laundry
2. Tailoring
3. Gadget Repair
4. Shoe Cleaning

### Zone Settings

1. City
2. Service zone
3. Vendor serviceable area

### Vendor Settings

1. Approval rules
2. KYC requirements
3. Vendor active/inactive rules
4. Referral ID tracking

### Order Settings

1. Status flow display
2. Cancellation rules
3. Manual logistics stages
4. OTP rules

### Payment Settings

1. Razorpay configuration display placeholders
2. COD eligibility
3. Wallet rules
4. Refund rules
5. Payout schedule

### Notification Settings

1. SMS templates
2. Push templates
3. Quiet hours
4. Frequency limits

### Reel Settings

1. Maximum video duration: 60 seconds
2. Allowed categories
3. Moderation rules
4. Rejection reasons

### UI Rules

1. Sensitive keys must never be displayed in full.
2. Settings changes must require confirmation.
3. Risky settings must show warning messages.
4. Save button must be disabled until changes exist.
5. Changes must show success/error toast after API integration.

---

## 14. Table Standards

All list pages must follow common table behavior.

### Required Table Features

1. Server-side pagination-ready UI
2. Search
3. Column sorting UI where applicable
4. Filters
5. Row action menu
6. Empty state
7. Loading skeleton
8. Error state with retry
9. Export action where allowed
10. Sticky header for long data tables where useful
11. Horizontal scroll for smaller screens
12. Row selection only when bulk actions are implemented

### Pagination Standard

Default page size options:

```txt
10, 25, 50, 100
```

Default page size:

```txt
25
```

### Table Empty State Example

```txt
No customers found
Try changing the filters or search term.
```

### Table Error State Example

```txt
Unable to load customers
We could not load the customer list right now. Please refresh and try again.
```

---

## 15. Forms and Validation Standards

### 15.1 Form Stack

1. React Hook Form for form state
2. Zod for validation schemas
3. Shared form field components
4. Inline field-level errors
5. Optional form-level error summary

### 15.2 Form UX Rules

1. Required fields must be visibly marked.
2. Field errors must appear near the field.
3. Submit button must show loading state.
4. Submit button must be disabled during submission.
5. Destructive forms must require confirmation.
6. Long forms must be split into sections.
7. Unsaved change warnings must be supported for edit screens.
8. Validation messages must be user-friendly.

### 15.3 Common Validation Messages

| Scenario | Message |
|---|---|
| Required field | This field is required. |
| Invalid email | Please enter a valid email address. |
| Invalid phone | Please enter a valid 10-digit mobile number. |
| Invalid amount | Please enter a valid amount. |
| Amount too low | Amount must be greater than zero. |
| Missing reason | Please enter a reason before continuing. |
| Invalid date | Please select a valid date. |
| End date before start date | End date must be after the start date. |

---

## 16. Error Handling Standards

### 16.1 Error Types

| Error Type | UI Handling |
|---|---|
| Validation error | Inline field error |
| Authentication error | Redirect to login or show session expired |
| Authorization error | Access denied page or disabled action |
| Not found | Not found page or inline record not found state |
| Conflict | Show clear conflict message and refresh option |
| Network error | Show retry option |
| Server error | Show friendly error with support reference if available |

### 16.2 Global Error Messages

| Scenario | User-Friendly Message |
|---|---|
| Session expired | Your session has expired. Please log in again. |
| No permission | You do not have permission to perform this action. |
| Record not found | We could not find this record. It may have been removed or updated. |
| Update conflict | This record was changed by another user. Please refresh and try again. |
| Network failure | We could not connect to the server. Please check your internet connection and try again. |
| Server failure | Something went wrong while processing your request. Please try again. |
| File upload failed | The file could not be uploaded. Please check the file and try again. |
| Export failed | The report export could not be started. Please try again. |

### 16.3 Toast Standards

Success toast example:

```txt
Vendor approved successfully.
```

Error toast example:

```txt
Vendor could not be approved. Please check the details and try again.
```

Warning toast example:

```txt
Some changes may affect active orders. Please review before saving.
```

---

## 17. Loading, Empty, and Offline States

### 17.1 Loading States

1. Use skeletons for cards and tables.
2. Use button spinner for form submission.
3. Use inline loaders for dropdown options.
4. Avoid full-page loaders after initial app shell is loaded.

### 17.2 Empty States

Every list page must have meaningful empty states.

Examples:

```txt
No pending reels
All submitted reels have been reviewed.
```

```txt
No orders found
Try changing the filters or search term.
```

### 17.3 Offline / Network Failure State

If network request fails:

1. Show recoverable error state.
2. Provide retry button.
3. Do not clear existing screen data unnecessarily.
4. For mutation failures, keep form data intact.

---

## 18. Data Fetching and State Management

### 18.1 TanStack Query Rules

1. Use TanStack Query for all async server-state data.
2. Use query keys from centralized query key factories.
3. Use stale time based on data type.
4. Invalidate affected queries after mutation.
5. Use optimistic updates only for low-risk UI actions.
6. Avoid storing server data in Zustand.

### 18.2 Zustand Usage

Use Zustand only for client-side UI state such as:

1. Sidebar collapsed state
2. Active filters before apply
3. Draft notification composer state if needed
4. Global modal state if required
5. Local table preferences

### 18.3 Query Key Pattern

```ts
export const customerQueryKeys = {
  all: ['customers'] as const,
  list: (filters: CustomerFilters) => ['customers', 'list', filters] as const,
  detail: (customerId: string) => ['customers', 'detail', customerId] as const,
};
```

---

## 19. Mock Service Standards

### 19.1 Service Interface Pattern

Each feature should expose services using the same method names that will later map to backend APIs.

Example:

```ts
export interface CustomersService {
  getCustomers(params: CustomerListParams): Promise<PaginatedResult<CustomerListItem>>;
  getCustomerById(customerId: string): Promise<CustomerDetail>;
  blockCustomer(customerId: string, reason: string): Promise<ActionResult>;
  unblockCustomer(customerId: string): Promise<ActionResult>;
  addCustomerNote(customerId: string, payload: AddNotePayload): Promise<ActionResult>;
}
```

### 19.2 Mock Error Simulation

Mock services should support optional error simulation through config.

```ts
export const mockConfig = {
  latencyMs: 500,
  simulateNetworkError: false,
  simulateUnauthorized: false,
};
```

---

## 20. API Integration Placeholder Standards

Backend API integration will happen after backend development and API docs are available.

### 20.1 Expected Integration Inputs

1. OpenAPI/Swagger documentation
2. Authentication API details
3. Role and permission payload structure
4. Pagination format
5. Error response format
6. File upload signed URL flow
7. SSE event documentation
8. Export/report job documentation

### 20.2 UI Must Be Ready For

1. Access token storage policy
2. Refresh token flow
3. Protected API calls
4. Standard error mapping
5. Backend pagination
6. Backend sorting/filtering
7. File upload using signed URLs
8. SSE subscriptions for dashboard updates
9. Download URLs for report exports

---

## 21. Authentication UI and Session Handling

### 21.1 Session Rules

1. Login screen is public.
2. All `/app/*` routes are protected.
3. Unknown auth state must show app-level loading.
4. Expired session must redirect to login.
5. Manual logout must clear local session state.
6. User role and permissions must be loaded after login.

### 21.2 Token Storage Placeholder

Final token storage method will follow backend auth implementation. Until then, mock session state may be stored in local storage only for development.

Production token storage decision must consider XSS risk and backend auth design.

---

## 22. Accessibility Requirements

### 22.1 Required Standards

1. Keyboard navigation for forms, dialogs, dropdowns, and tables.
2. Visible focus states.
3. Proper labels for form fields.
4. `aria` attributes for dialogs and menus.
5. Table headers must be semantic.
6. Statuses must not rely only on color.
7. Error messages must be screen-reader discoverable.
8. Modals must trap focus.
9. Escape key should close dismissible dialogs.
10. Destructive confirmations must be clear.

### 22.2 Accessibility for Custom Components

Since custom Tailwind components are selected, accessibility must be intentionally implemented.

For complex components such as dialogs, dropdowns, popovers, date pickers, and command menus, use well-tested accessibility primitives if needed instead of building all behavior manually.

---

## 23. Performance Requirements

### 23.1 UI Performance Targets

| Metric | Target |
|---|---|
| Initial app shell load | Less than 3 seconds on normal broadband |
| Route transition | Less than 500ms after assets loaded |
| Table filter interaction | Debounced and responsive |
| Large table rendering | Paginated, not full dataset render |
| Dashboard render | Skeleton immediately, data progressively loaded |
| Bundle size | Keep vendor chunks optimized |

### 23.2 Performance Practices

1. Use route-level code splitting.
2. Lazy load heavy modules such as reports and charts.
3. Paginate all large lists.
4. Debounce search input.
5. Memoize expensive table column definitions.
6. Avoid unnecessary global state.
7. Avoid rendering hidden tabs with heavy data unless needed.
8. Use image thumbnails in lists.
9. Load full media only in detail views or preview modal.
10. Use virtualized lists only if pagination is not enough.

### 23.3 Vite Build Optimization

1. Use manual chunks if bundle grows.
2. Analyze production bundle before launch.
3. Remove unused icons/components.
4. Avoid importing whole utility libraries.
5. Prefer named imports.

---

## 24. Logging and UI Diagnostics

### 24.1 Client-Side Logging Scope

Since Phase 1 uses Google Cloud Logging/Monitoring for backend, the Admin UI should keep lightweight client diagnostics.

Log locally in development:

1. Route errors
2. Failed API requests
3. Unexpected component errors
4. Permission mismatches
5. File upload failures

Production logging can be extended later if frontend error monitoring is added.

### 24.2 Error Boundary

The app must include a root error boundary and route-level recoverable error states.

Root error boundary message:

```txt
Something went wrong while loading this page. Please refresh the page or contact support if the issue continues.
```

### 24.3 Request Timing After API Integration

API client wrapper must measure request duration and make it available in development logs.

Example fields:

```txt
method
url
status
requestId
responseTimeMs
errorCode
```

---

## 25. Security Requirements for UI

### 25.1 UI Security Rules

1. Never store secrets in frontend code.
2. Never expose backend keys or provider credentials.
3. Never trust frontend role checks as final authorization.
4. Sanitize or safely render rich content.
5. Avoid dangerouslySetInnerHTML unless content is sanitized.
6. Sensitive IDs and references can be shown only where required by admin operations.
7. Mask sensitive values such as payment references where role does not allow full view.
8. Log out user on session expiry.
9. Disable browser autocomplete for sensitive password fields where appropriate.
10. Validate user input before submission.

### 25.2 Environment Variables

Only public frontend variables may be used in Vite.

Allowed examples:

```txt
VITE_API_BASE_URL
VITE_APP_ENV
VITE_ENABLE_MOCK_API
VITE_FIREBASE_HOSTING_ENV
```

Disallowed examples:

```txt
RAZORPAY_SECRET
EXOTEL_SECRET
JWT_SECRET
DATABASE_URL
CLOUDFLARE_API_TOKEN
GCP_SERVICE_ACCOUNT_KEY
```

---

## 26. Firebase Hosting Deployment

### 26.1 Build Output

React + Vite build output:

```txt
dist/
```

### 26.2 Firebase Hosting Requirements

1. SPA rewrite to `index.html`.
2. HTTPS enabled.
3. Environment-specific build variables.
4. Preview channels for staging/review.
5. Production deployment approval process.

### 26.3 firebase.json Example

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public,max-age=31536000,immutable"
          }
        ]
      },
      {
        "source": "index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache"
          }
        ]
      }
    ]
  }
}
```

---

## 27. Environment Strategy

### 27.1 Required Environments

1. Local development
2. Staging
3. Production

### 27.2 Environment Behavior

| Environment | Data Source | Purpose |
|---|---|---|
| Local | Mock services by default | UI development |
| Staging | Backend staging API after available | QA and business review |
| Production | Backend production API | Live operations |

### 27.3 Mock Toggle

The app must support a mock mode flag:

```txt
VITE_ENABLE_MOCK_API=true
```

When true, feature services must use mock implementations.

---

## 28. Coding Standards

### 28.1 TypeScript Rules

1. Strict mode enabled.
2. Avoid `any` unless explicitly justified.
3. Use discriminated unions for statuses.
4. Use type-safe route params where practical.
5. Keep shared types in feature modules or global types when truly common.

### 28.2 Component Rules

1. Pages compose components.
2. Components should stay small and focused.
3. Business rules should live in hooks/services, not deep UI components.
4. Avoid prop drilling beyond two levels; use context or hooks when appropriate.
5. Use named exports for shared components.

### 28.3 Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Component | PascalCase | VendorStatusBadge |
| Hook | camelCase with use prefix | useVendorDetail |
| Service file | camelCase.service.ts | vendors.service.ts |
| Mock file | camelCase.mock.ts | vendors.mock.ts |
| Type file | camelCase.types.ts | vendors.types.ts |
| Schema file | camelCase.schema.ts | vendor.schema.ts |
| Constants | UPPER_SNAKE_CASE | ORDER_STATUS_LABELS |

---

## 29. Testing Strategy for UI

Testing strategy is currently a pending technical decision, but the UI should be structured to support testing.

### 29.1 Recommended Baseline

1. Unit tests for utils.
2. Component tests for shared UI components.
3. Integration tests for critical forms.
4. E2E tests for login, vendor approval, order status update, reel approval, and payout action after backend integration.

### 29.2 Testability Rules

1. Use semantic queries where possible.
2. Use stable test IDs only where semantic queries are insufficient.
3. Keep business logic testable outside components.
4. Mock service layer for component/page tests.

### 29.3 Testing Decision Status

Decision Pending.

---

## 30. Feature-Specific Mock Data Requirements

### 30.1 Dashboard Mock Data

Must include:

1. KPI values
2. Pending vendor approval count
3. Pending reel count
4. Active order count
5. Payment failure count
6. Category order distribution
7. Zone order distribution

### 30.2 Vendor Mock Data

Must include:

1. Active vendor
2. Pending vendor
3. Documents pending vendor
4. Suspended vendor
5. Rejected vendor
6. Vendor with referral ID
7. Vendor with incomplete service menu

### 30.3 Order Mock Data

Must include at least one order in each major status:

1. Order placed
2. Vendor acceptance pending
3. Vendor accepted
4. Pickup scheduled
5. Picked up from customer
6. Handed over to vendor
7. Item received by vendor
8. Service in progress
9. Service completed
10. Collected from vendor
11. Out for delivery
12. Delivered
13. Delivery failed
14. Item damaged
15. Item lost

### 30.4 Payment Mock Data

Must include:

1. Successful Razorpay payment
2. Failed payment
3. Refund pending
4. Refund processed
5. COD order
6. Wallet usage

### 30.5 Reel Mock Data

Must include:

1. Pending reel
2. Approved reel
3. Rejected reel
4. Edit requested reel
5. Paused reel
6. Removed reel

---

## 31. Acceptance Criteria

### 31.1 General UI Acceptance Criteria

1. Admin can log in using mock auth during UI development.
2. Sidebar displays role-aware navigation.
3. Dashboard shows KPI cards, charts, and pending action cards using mock data.
4. Customer list and detail pages are available.
5. Vendor list and detail pages are available.
6. Vendor onboarding queue is available.
7. Order list and detail pages are available.
8. Manual logistics status update UI is available.
9. Payment overview and transaction detail UI are available.
10. Payout queue and payout actions UI are available.
11. Reel moderation queue and reel detail UI are available.
12. Notification composer UI is available.
13. Content management UI is available.
14. Reports catalog and report detail UI are available.
15. Platform settings UI is available.
16. All major list pages support loading, empty, and error states.
17. All forms show user-friendly validation errors.
18. Destructive actions require confirmation dialogs.
19. Role-based UI restrictions are visible.
20. App is deployable to Firebase Hosting.

### 31.2 Backend Integration Readiness Acceptance Criteria

1. All feature data calls go through service interfaces.
2. Mock service can be replaced with HTTP service without changing page components.
3. Query keys are centralized.
4. API error mapping is centralized.
5. Route guards are implemented.
6. Permission guards are implemented.
7. File upload components support signed URL style integration.
8. SSE service placeholder exists for later backend events.
9. Environment config supports API base URL.
10. App can run in mock mode and API mode.

---

## 32. Development Milestones

### Milestone 1: Foundation

1. Vite + React + TypeScript setup
2. Tailwind setup
3. Router setup
4. Layout setup
5. Auth mock setup
6. Shared UI component foundation
7. Mock service architecture

### Milestone 2: Core Operations UI

1. Dashboard
2. Customers
3. Vendors
4. Vendor onboarding
5. Orders
6. Manual logistics

### Milestone 3: Finance and Content UI

1. Payments
2. Payouts
3. Reel moderation
4. Notifications
5. Content management

### Milestone 4: Reports, Settings, Hardening

1. Reports
2. Settings
3. Audit logs
4. Role restrictions
5. Empty/error/loading states
6. Responsive refinements
7. Firebase Hosting deployment

### Milestone 5: Backend API Integration

This milestone starts only after backend API documentation is ready.

1. Replace mock services with API services
2. Implement real auth flow
3. Integrate list/detail APIs
4. Integrate mutations/actions
5. Integrate file upload signed URLs
6. Integrate SSE updates
7. Test with staging backend

---

## 33. Pending Decisions

The following decisions are intentionally pending and must be finalized later:

1. Container registry decision
2. Branching and environment strategy
3. Testing framework and depth
4. Admin Portal API client generation strategy
5. Frontend crash/error reporting tool
6. Analytics tool for admin usage
7. Final token storage strategy after backend auth implementation
8. Final component accessibility primitive choices
9. Final chart library if Recharts is not accepted
10. Final production feature flag strategy

---

## 34. Summary

The Release 1 Admin Portal Web App will be developed as a React + Vite + TypeScript single-page application with custom Tailwind CSS components. The UI must be modular, feature-based, role-aware, and backend-integration ready.

The first development phase must use mock services and realistic mock data so the Admin Portal can be built in parallel with backend development. After the backend APIs are completed and documented, the service layer will be switched from mock implementations to real REST API integrations.

The Admin Portal must prioritize operational clarity, table/form consistency, user-friendly errors, strong status visibility, and low-friction admin workflows for vendor approval, order management, manual logistics, payment visibility, payout tracking, reel moderation, notifications, content, reports, settings, and admin user management.

