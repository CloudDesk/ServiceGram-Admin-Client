# Frontend Development Standards & Architecture Guidelines

## 1. Application Architecture

The application must follow a layered architecture to ensure maintainability, scalability, and ease of backend integration.

```text
Pages
 ↓
Feature Components
 ↓
Hooks
 ↓
Services
 ↓
API Client
 ↓
Backend APIs
```

### Rules

* Pages should only compose screens and manage page flow.
* Components should focus on UI rendering.
* Business logic should be placed in hooks and services.
* Components must never directly call APIs.
* Backend communication must always go through services.

---

## 2. Routing Standards

### Route Structure

Routes must represent resources and actions clearly.

#### Preferred

```text
/customers
/customers/create
/customers/:customerId
/customers/:customerId/edit

/vendors
/vendors/create
/vendors/:vendorId

/orders
/orders/:orderId
```

#### Avoid

```text
/customers?action=create
/customers?action=edit
/vendors?action=view
```

### Nested Routes

For modules with sub-sections:

```text
/settings
/settings/profile
/settings/security
/settings/roles
```

Use React Router nested routes.

### Tab Navigation

Where tabs exist inside a detail page, tab state must be URL-driven.

#### Example

```text
/orders/123?tab=overview
/orders/123?tab=timeline
/orders/123?tab=payments
```

or

```text
/orders/123/overview
/orders/123/timeline
/orders/123/payments
```

This ensures refresh, sharing, and browser navigation work correctly.

### Centralized Route Management

All routes must be maintained in a single route configuration.

```text
src/config/routes.ts
```

Do not hardcode route paths inside components.

---

## 3. Folder Structure

Recommended project structure:

```text
src/

├── app/
├── routes/
├── layouts/
├── pages/
├── features/
├── components/
├── services/
├── hooks/
├── store/
├── utils/
├── constants/
├── types/
├── config/
├── assets/
└── styles/
```

---

## 4. Component Standards

Components should be small, reusable, and focused.

### Avoid

```text
CustomerManagement.tsx
3000+ lines
```

### Preferred

```text
CustomerPage

├── CustomerFilters
├── CustomerTable
├── CustomerFormModal
├── CustomerActions
```

### Component Rules

* One component should have one responsibility.
* Avoid business logic inside UI components.
* Shared components should be reusable across modules.
* Use TypeScript interfaces for all props.
* Avoid using `any`.

Example:

```tsx
interface CustomerCardProps {
  customer: Customer;
  onEdit: (id: string) => void;
}
```

---

## 5. State Management Standards

### TanStack Query

Use for:

* API responses
* List pages
* Dashboard data
* Detail pages
* Search results
* Pagination

### Zustand

Use only for client-side UI state.

Examples:

```text
Theme
Sidebar State
Modal State
Transient UI Filters
```

Use Zustand for client-owned session helpers only when they are derived from backend-authenticated data and are not treated as the source of truth for API data, permissions, or authorization decisions.

Do not store API response data in Zustand.

### Authentication and Access Control State

Use Zustand as the runtime access layer for authenticated UI state that must be read globally across the application.

Allowed examples:

```text
Current User
Role
Permission List
Derived Access Helpers such as can()
Authenticated UI Flags
```

Rules:

* The backend remains the source of truth for authentication, authorization, roles, and permissions.
* The frontend may store the authenticated user, role, and permission set in Zustand for runtime access across routes, layouts, menus, and components.
* Route guards, menu visibility, and action-level access checks should read from Zustand selectors or shared access helpers, not directly from persistence APIs such as `localStorage`.
* Frontend permission checks are a UX concern only and must never be treated as security enforcement. All access control must also be validated by the backend.

### Token and Session Persistence

Persistence strategy must be treated separately from runtime state management.

Rules:

* Prefer secure `httpOnly` cookies for access/session tokens when backend architecture supports them.
* If browser storage is required, use it only as a persistence mechanism for session recovery, not as the live state source used throughout the UI.
* On application startup, hydrate the auth/access Zustand store from the approved persistence mechanism or session bootstrap API.
* Do not scatter token, role, or permission reads across modules. Centralize hydration and access logic in the auth/session layer.

### Prop Drilling Rule

Avoid passing props through multiple component levels.

#### Avoid

```text
Page
 └─ Component
      └─ Component
           └─ Component
```

#### Use

* Zustand
* Custom Hooks
* Context (where appropriate)

---

## 6. API Standards

### Single API Client

The application must use one centralized API client.

```text
src/services/apiClient.ts
```

Responsibilities:

* Authorization Token Handling
* Request Interceptors
* Response Interceptors
* Error Handling
* File Upload Support
* File Download Support

### Token Handling Rule

The API client must obtain authentication credentials from the centralized auth/session layer.

Rules:

* Token attachment and renewal logic must be implemented once in the API client and related auth/session services.
* Components, pages, and feature hooks must not manually read tokens from `localStorage`, cookies, or ad hoc globals.
* Permission data returned during login or session bootstrap may be stored in Zustand for runtime access, but backend APIs must still enforce authorization on every protected operation.

### Direct API Calls Prohibited

Never use:

```ts
axios.get()
axios.post()
fetch()
```

inside:

* Pages
* Components
* Hooks

All API calls must go through service files.

---

## 7. Service Layer Standards

Example structure:

```text
CustomerPage
    ↓
customer.service.ts
    ↓
apiClient.ts
```

Example methods:

```ts
customerService.getCustomers()

customerService.getCustomerById()

customerService.createCustomer()

customerService.updateCustomer()

customerService.deleteCustomer()
```

Benefits:

* Easier maintenance
* Easier testing
* Backend changes isolated

---

## 8. Shared Component Library

Reusable components must be created once and used throughout the application.

### Form Components

```text
Button
Input
Textarea
Select
MultiSelect
Checkbox
Radio
Switch
DatePicker
DateRangePicker
FileUpload
```

### Feedback Components

```text
Toast
Loader
Skeleton
EmptyState
ErrorState
```

### Overlay Components

```text
Modal
Drawer
ConfirmDialog
```

### Navigation Components

```text
Tabs
Breadcrumb
PageHeader
```

### Data Components

```text
DataTable
Pagination
SearchInput
FilterPanel
```

---

## 9. Theme Management Standards

No hardcoded colors.

### Avoid

```tsx
style={{ color: "#2563eb" }}
```

### Use

```tsx
bg-primary
text-primary
border-primary
```

All theme values must be managed centrally.

```text
Global Tailwind theme configuration
```

or

```css
Global CSS theme tokens
```

Example approved locations:

```text
tailwind.config.ts
src/styles.css via @theme or :root tokens
```

This allows future color changes without modifying components.

---

## 10. Utility Standards

Common reusable logic should be placed in utilities.

Examples:

```ts
formatDate()
formatCurrency()
formatPhone()
downloadFile()
debounce()
throttle()
buildQueryParams()
```

Avoid duplicate utility functions.

---

## 11. Constants Standards

Centralize:

```text
Routes
Roles
Permissions
Statuses
Date Formats
```

Centralize shared system messages, reusable status copy, and repeated domain constants.

Avoid moving ordinary one-off UI labels or local descriptive copy into constants files without a clear reuse or translation requirement.

---

## 12. Form Standards

Structured business forms must use:

```text
React Hook Form
+
Zod
```

This requirement applies to create, edit, approval, onboarding, and multi-field data-entry forms. It does not apply to lightweight search bars, table filters, or simple single-purpose query inputs unless they evolve into full validation-driven forms.

Requirements:

* Field-level validation
* Required field indication
* Loading state during submit
* Disable submit while processing
* User-friendly validation messages

---

## 13. TypeScript Standards

Enable strict mode.

```json
{
  "strict": true,
  "noImplicitAny": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

Build must fail for TypeScript errors.

---

## 14. Code Quality Standards

Builds must fail for:

* Unused imports
* Unused variables
* Unused parameters

Enforcement split:

* ESLint must fail on unused imports, unused variables, unused parameters, forbidden `any` usage where configured, and prohibited production logging.
* TypeScript must fail on compilation and type-checking errors.

Recommended rules:

```text
@typescript-eslint/no-unused-vars
@typescript-eslint/no-explicit-any
```

Production code must not contain:

```text
console.log()
```

---

## 15. Loading, Error & Empty States

Every page must implement:

### Loading

```text
Skeleton Components
```

### Error

```text
Retry Action
Friendly Error Message
```

### Empty

```text
Meaningful Empty State
```

No blank screens should be shown.

---

## 16. Performance Standards

Required:

* Route-level lazy loading
* Code splitting
* Debounced search
* Query caching
* Memoized table columns
* Server-side pagination ready

Avoid:

* Large global state
* Unnecessary re-renders
* Heavy hidden tab rendering
* Duplicate API requests

---

## 17. Development Checklist

Before completing any module:

* Uses centralized routes
* Uses shared components
* Uses service layer
* No direct API calls
* No TypeScript errors
* No unused imports
* No unused parameters
* Loading state implemented
* Error state implemented
* Empty state implemented
* Uses theme tokens
* Uses proper types

---

## Development Principle

The application must remain:

* Modular
* Reusable
* Theme-driven
* Service-oriented
* Backend-independent
* Easy to maintain
* Easy to scale
* Easy to replace APIs without UI changes
