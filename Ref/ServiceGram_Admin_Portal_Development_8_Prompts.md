# ServiceGram Release 1 - Admin Portal Development Prompts

Use these prompts one by one while developing the Admin Portal Web App.

Each prompt is written in simple plain English. When using any prompt, also provide the Admin Portal UI TSD document as the detailed technical reference. Do not paste the full TSD into the prompt unless needed.

---

## Prompt 1 - Project Setup and UI Foundation

Build the Admin Portal frontend foundation for ServiceGram Release 1 using the Admin Portal UI TSD as the main reference.

Set up the project with React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Zustand, and the agreed custom Tailwind component system.

Create the industry-standard folder structure exactly as described in the TSD. Keep it feature-based and scalable. Add shared folders for components, layouts, hooks, utils, constants, types, services, guards, mock APIs, and theme tokens.

Create the base app shell with login layout, authenticated dashboard layout, sidebar, top bar, breadcrumb area, page header, loading states, empty states, error states, toast system, modal system, drawer system, and reusable table shell.

Do not connect real backend APIs yet. Use mock services and mock data. The code should be clean, reusable, typed, and ready for backend API integration later.

Acceptance goal: the Admin Portal should run locally with a clean layout, route structure, reusable components, mock API layer, and base design system ready for feature development.

---

## Prompt 2 - Authentication, Session UI, and Dynamic RBAC UI

Develop the Admin Portal authentication and dynamic role-based access control UI using the Admin Portal UI TSD as the main reference.

Build the login screen, forgot password placeholder screen if required, protected route handling, auth state store, mock session handling, logout flow, and session expiry UI.

Create a scalable frontend RBAC system that supports roles, permissions, modules, actions, scopes, user-level overrides, and access checks. Use permission keys such as `orders.order.view`, `vendors.profile.approve`, and `payouts.payout.mark_paid`.

Build reusable permission helpers and UI guards such as route guards, module guards, action guards, and permission gate components. The sidebar, routes, buttons, export actions, and sensitive finance fields must respect permissions.

Create Admin User Management screens, Role Management screens, Permission Matrix screens, Policy Override screens, and Access Preview screens as described in the TSD.

Use mock data only. The backend will enforce real permissions later, but the UI must already be ready for dynamic permission payloads.

Acceptance goal: admin users can log in through mock auth, see menus based on permissions, manage mock roles, view a permission matrix, and see proper user-friendly access denied messages.

---

## Prompt 3 - Dashboard and Common Admin Experience

Build the Admin Dashboard and common admin user experience using the Admin Portal UI TSD as the main reference.

Create the dashboard page with KPI cards, pending actions, active orders summary, pending vendor approvals, pending reel approvals, payment failures, refund queue, category-wise order count, zone-wise order count, and finance-role-based GMV card.

Add mock chart components, dashboard filters, date range selector, refresh action, status badges, alert cards, and quick links to important modules.

Add reusable components for KPI cards, stat tiles, chart cards, activity lists, timeline previews, status badges, filter bars, and section headers.

The dashboard should use mock data and must be permission-aware. Finance widgets should only appear when the logged-in mock user has finance permissions. Reel moderation widgets should only appear when the user has reel moderation permissions.

Also implement common UI behaviors: skeleton loading, empty state, API error state, retry button, no-permission state, and responsive layout for desktop and tablet widths.

Acceptance goal: the dashboard gives a complete Phase 1 operational overview using mock data and shared reusable components.

---

## Prompt 4 - Customer Management UI

Develop the Customer Management module for the Admin Portal using the Admin Portal UI TSD as the main reference.

Build the customer list page with search, filters, sorting, pagination, status badges, export button placeholder, and customer table columns defined in the TSD.

Build the customer detail page with tabs for overview, orders, payments, wallet, refunds, notifications, notes, and activity log. Use mock data for all sections.

Add admin actions such as block customer, unblock customer, add internal note, send notification, initiate refund, and credit wallet. These actions should open confirmation modals or forms and must respect permissions.

Create detailed user-friendly validation and error messages for invalid form actions, missing reasons, permission restrictions, failed mock requests, and unavailable customer data.

Use reusable components wherever possible: DataTable, FilterPanel, DetailHeader, StatusBadge, NotesPanel, ActivityTimeline, ConfirmDialog, DrawerForm, and PermissionGate.

Acceptance goal: admin users can browse mock customers, open a customer detail page, view all customer information, and perform permission-aware mock actions.

---

## Prompt 5 - Vendor Management, Vendor Onboarding, and Service Catalogue UI

Develop the Vendor Management and Vendor Onboarding modules for the Admin Portal using the Admin Portal UI TSD as the main reference.

Build the vendor list page with search, filters, sorting, pagination, vendor status badges, category filter, zone filter, referral ID column, and last active information.

Build the vendor detail page with tabs for profile, services, pricing, orders, reels, documents, payments, notes, activity, and referral ID details. Use mock data.

Build the Vendor Onboarding Queue with stages such as New Application, Documents Pending, Under Review, Service Menu Pending, Awaiting Activation, Approved, and Rejected.

Add vendor admin actions such as approve vendor, reject vendor with reason, request missing documents, verify documents, suspend vendor, reactivate vendor, update onboarding stage, add admin note, and review service catalogue.

All sensitive actions must use confirmation dialogs, reason fields where required, permission checks, and clear user-friendly success/error messages.

Acceptance goal: admin users can manage mock vendors, review onboarding applications, verify documents, inspect service catalogue details, and perform permission-aware vendor actions.

---

## Prompt 6 - Orders and Manual Logistics UI

Develop the Order Management and Manual Logistics Control modules for the Admin Portal using the Admin Portal UI TSD as the main reference.

Build the order list page with search, filters, sorting, pagination, order status badges, payment status badges, current stage, customer, vendor, category, zone, order value, pickup time, delivery time, and created date.

Build the order detail page with sections for customer details, vendor details, service details, pickup address, return address, payment summary, order timeline, uploaded photos, notes, refund status, and manual logistics history.

Build the manual logistics UI inside order detail. Admin should be able to update statuses such as Pickup Scheduled, Picked Up from Customer, Handed Over to Vendor, Collected from Vendor, Out for Delivery, Delivered, Delivery Failed, Customer Unavailable, Item Damaged, Item Lost, Wrong Item, and Rescheduled Delivery.

Each manual status update form must capture status, note, optional proof image placeholder, customer notification toggle, vendor notification toggle, and reason where required.

Add delivery OTP verification UI for final delivery confirmation. Do not build driver tracking, driver assignment, Root Cabs, or delivery partner app features.

Acceptance goal: admin users can manage mock orders, inspect full order details, update manual logistics status, verify delivery OTP through mock flow, and see a complete timeline of all actions.

---

## Prompt 7 - Payments, Refunds, Vendor Payouts, Reels, Notifications, and Content UI

Develop the Payments, Refunds, Vendor Payouts, Reel Moderation, Push Notification Center, and Content Management modules using the Admin Portal UI TSD as the main reference.

For Payments, build the payment overview page, transaction list, failed payment list, refund list, COD list, wallet transactions list, and Razorpay reconciliation placeholder using mock data.

For Vendor Payouts, build payout queue, payout detail, held payouts, failed payouts, payout history, approve payout action, hold payout action, release hold action, mark as paid action, adjustment action, and UTR/reference entry UI.

For Reels, build pending reel queue, reel review page, live reel library, approve reel, reject with reason, request edit, pause live reel, and remove live reel actions. Use Cloudflare Stream playback placeholder or mock video cards.

For Notifications, build create notification, audience selector, schedule/send now options, preview, test notification, draft list, and sent history using mock data.

For Content, build content list, editor placeholder, preview, publish, archive, rollback, version history, FAQ, onboarding banners, app banners, terms, privacy policy, and SMS/push template UI.

All modules must be permission-aware and use consistent tables, filters, forms, confirmations, error states, empty states, and success messages.

Acceptance goal: the major operations, finance, marketing, content, and moderation screens are ready with mock data and can be wired to backend APIs later.

---

## Prompt 8 - Reports, Settings, API Integration Readiness, QA Polish, and Final UI Review

Complete the remaining Admin Portal UI work using the Admin Portal UI TSD as the main reference.

Build Reports screens for operations reports, vendor reports, customer reports, finance reports, and admin audit reports. Add filters, date range selector, export button placeholders, loading states, empty states, and permission-aware finance report visibility.

Build Platform Settings screens for category settings, zone settings, vendor settings, order settings, payment settings, notification settings, reel settings, app version settings, and general platform configuration. Use mock save actions and confirmation messages.

Prepare the API integration layer for future backend connection. Keep mock services isolated so they can be replaced by real services after backend API documentation is available. Add typed service files, DTO-like frontend types, response parsing helpers, and centralized error mapping.

Review the whole UI for consistency, accessibility, responsive behavior, keyboard navigation, loading states, empty states, error states, permission states, form validation, table usability, reusable component usage, and clean folder organization.

Add request timing placeholders, frontend action logging placeholders, and clear comments where backend integration is required later.

Acceptance goal: the Admin Portal UI is complete for Phase 1 using mock data, follows the TSD, is ready for backend API integration, and has clean reusable code with no hardcoded business logic scattered across pages.

