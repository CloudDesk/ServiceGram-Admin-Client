# UI/UX Development Standards Guide

**Project:** Admin Portal Web Application

**Purpose:** Ensure a consistent, predictable, accessible, and user-friendly interface across all modules.

---

## 1. Page Layout Standards

All application pages must adhere to a strict, unified layout structure to ensure navigation predictability and prevent layout shifting.

### Requirements

* **Header:** Must remain fixed at the very top of the viewport.
* **Sidebar:** Must remain fixed on the left side of the viewport.
* **Content Area:** Page content must scroll exclusively within its dedicated viewport boundary.
* **Scroll Behavior:** The application must use a single controlled scroll-container strategy. In the standard app-shell layout, `body` should remain non-scrolling and the main content viewport should handle page scrolling. If overlays or platform-specific behavior require a different implementation, the result must still preserve one visible scroll context. **Double scrollbars are strictly prohibited.**
* **Page Title:** Must always remain visible at the top of the content area or within the header context.
* **Breadcrumbs:** Mandatory for deep navigation hierarchies (3+ levels deep).
* **Page Actions:** Primary and secondary page-level actions must be positioned consistently across all screens (e.g., top-right corner of the content header).
* **Shared Dimensions:** Layout and component dimensions must be defined through the design system and shared component library. These values must be maintained centrally and must not be hardcoded across modules.

### Goals

* Consistent navigation experience.
* Predictable user interaction pathways.
* Reduced cognitive load during cross-module multitasking.

---

## 2. Header Standards

The global header acts as the persistent utility anchor across all system modules.

### Requirements

* **Position:** Fixed top.
* **Header Height:** Must be defined through the design system and shared component library, not hardcoded in individual modules.
* **Left Section:** Displays the application branding/logo, active page title, and immediate breadcrumb context.
* **Right Section:** Reserved for global tools: Notifications, Help/Documentation, User Profile dropdown, and Global Search/Actions.
* **Scroll Rules:** Must never scroll out of view with page content.
* **Typography:** Page title must never be empty. Long titles must truncate gracefully with text ellipsis (`...`) and reveal full text via hover tooltip if necessary.

### Structural Examples

> * `Orders / Chennai Zone / Order Management`
> * `Customers / Premium Members / Customer Details`
> * `Reports / Finance / Monthly Revenue Report`
> 
> 

---

## 3. Sidebar Standards

The primary navigation sidebar must be dynamic, role-aware, and responsive.

### Requirements

* **Sidebar Width:** Expanded and collapsed widths must be defined through the design system and shared component library, not hardcoded in individual modules.
* **State Highlighting:** The currently active menu item must be visually emphasized using a distinct background tint or left-border accent.
* **Role-Based Security:** Unauthorized menu links must be stripped from the DOM entirely, not just disabled.
* **Alignment:** Icons and text labels must perfectly align horizontally.
* **Collapsed State:** When collapsed to icon-only mode, every item must trigger a descriptive tooltip on hover.
* **Consistency:** Menu ordering must remain identical across different user roles, simply hiding items the user doesn't have access to rather than rearranging the list.

---

## 4. Button Standards

Buttons must have deterministic scaling, clear visual hierarchy, and action-oriented syntax.

### Sizing Specification

Button dimensions must be maintained centrally through the design system and shared component library. Individual modules must consume predefined button size variants rather than defining local height, width, padding, or sizing values.

Examples of centrally managed button dimensions:

* Button sizes
* Icon button sizes
* Minimum button widths
* Button padding and density variants

| Button Type | Size Source | Behavior Rules |
| --- | --- | --- |
| **Standard Button** | Shared component size variant | Text should remain on a single line in standard cases. For constrained layouts, long labels, or localization, use approved truncation or responsive sizing rules from the shared component library instead of hardcoded overrides. |
| **Icon-Only Button** | Shared component icon size variant | Must contain an `aria-label` for screen readers. |

### Visual Hierarchy & Intent

* **Primary:** Reserved for the singular main objective of a workflow or page section.
* *Usage:* Save Changes, Approve Request, Create Vendor, Complete.


* **Secondary:** Used for alternative or safe navigation actions.
* *Usage:* Cancel, Back, Preview, Save Draft.


* **Danger:** Destructive or irreversible actions.
* *Usage:* Delete, Reject, Disable, Cancel Subscription.


* **Icon Button:** In-line contextual actions or space-constrained areas.
* *Usage:* View, Edit, Download, More Actions (`...`).

### Labeling Standards

Button labels must clearly describe the action that will occur when clicked.

Preferred:

* Save Changes
* Create Vendor
* Approve Request

Avoid:

* Submit
* Process
* Execute

Action-specific labels improve usability by reducing ambiguity and setting accurate expectations before the user commits an action.

---

## 5. Form Standards

Forms must prioritize data-entry efficiency, scan-ability, and real-time defensive validation.

### Requirements

* **Label Positioning:** Labels must always sit **above** their corresponding input fields.
* **Required Fields:** Must be denoted by a clear visual indicator (e.g., a red asterisk `*`).
* **Spacing:** Use uniform vertical stacking margins (e.g., `16px` or `24px` spacing between form groups).
* **Inline Validation:** Validation error messages must render directly beneath the invalid input field.
* **State Differentiation:** Disabled fields must be greyed out with a `not-allowed` cursor. Read-only fields should appear cleanly integrated without input borders but remain selectable.
* **Layout Structure:** Long forms must be grouped into logical sections using sub-headings or cards.
* **Sticky Actions:** Long forms should utilize a sticky footer action bar so "Save" or "Cancel" are always accessible without scrolling back to the bottom.
* **Unsaved Change Detection:** Forms must detect unsaved changes and warn users before accidental navigation or dismissal.
* **Submission Loading State:** Forms must visibly communicate submission progress while requests are in flight.
* **Duplicate Submission Prevention:** Submit actions must lock appropriately during in-flight requests to prevent duplicate records or repeated API calls.
* **Keyboard Accessibility:** All form controls and submission flows must remain fully usable with keyboard-only interaction.

### Validation Principles

* Errors must show contextually next to the field; avoid top-of-page error blocks or browser alerts.
* Avoid cryptic technical or system database messages (e.g., use *"Please enter a valid email"* instead of *"Regex validation failed on input string"*).
* Validation copy must be actionable, explicitly guiding the user on how to resolve the issue.

---

## 6. Table Standards

Data grids require predictable patterns to make large data sets easy to manipulate.

### Requirements

* **Controls Layout:** Global search and filter controls must live directly above the table header.
* **Sticky Header:** Table headers must pin to the top of the grid viewport when scrolling vertically through rows.
* **Pagination:** Component must sit cleanly below the table container.
* **Statuses:** Rendered exclusively within stylized status badges.
* **Text Truncation:** Long text strings must truncate gracefully; full strings should be accessible via a tooltip or a detailed slide-out panel.
* **Loading State:** Every table must define a loading presentation appropriate to the current layout.
* **Empty State:** Every table must define a meaningful empty state with next-step guidance.
* **Error State:** Every table must define an error state with a recovery path where possible.
* **Sorting:** Tables must support sorting where users need to reorder records for comparison, prioritization, or analysis.
* **Filtering:** Tables must support filtering appropriate to the dataset and user goals.
* **Export:** Tables must support export where business workflows require downstream reporting, reconciliation, compliance sharing, or offline analysis.

### Pagination Defaults

* **Default Set:** 10 rows per page.
* **User-Selectable Options:** 10, 20, 50, 100 rows.

### Common Inline Row Actions

* View, Edit, Approve, Reject, Download, Delete.

---

## 7. Status Display Standards

System and database-level status strings must be translated into human-readable, friendly representations before rendering.

### Formatting Protocol

* Never expose raw backend enumerations, database keys, or snake_case system variables.
* Use globally standardized color coding for status badges (e.g., Green = Success/Active, Amber = Pending/Warning, Red = Danger/Error/Disabled).

| Avoid (Backend Codes) | Use (User-Facing Text) |
| --- | --- |
| `ORDER_PENDING_APPROVAL` | Pending Approval |
| `PAYMENT_INITIATED` | Payment Initiated |
| `CUSTOMER_ACCOUNT_DISABLED` | Account Disabled |

---

## 8. Modal Standards

Modals intercept the user's workflow and must be constrained to short, focused interactions.

### Requirements

* **Structure:** Fixed header (Title + Close Button), scrollable body content area, and a fixed footer containing actions.
* **Keyboard Support:** Pressing the `ESC` key must close standard, non-destructive modals.
* **Destructive Modals:** Confirmation modals for destructive actions must clearly describe the consequence, require an explicit confirm action, and provide an obvious cancel path. Dismiss behavior such as backdrop click or `ESC` may be restricted where appropriate, but the user must never be trapped without a clear, accessible way to cancel.

### Recommended Usage vs. Avoidance

* ✅ **Do Use For:** Quick confirmation prompts, workflow approvals/rejections, brief item previews, or single/two-field fast entry forms.
* ❌ **Do NOT Use For:** Large business workflows, complex multi-step processes, or massive, full-page data forms.

---

## 9. Drawer Standards (Slide-outs)

Drawers provide a non-obtrusive, right-side panel layout perfect for maintaining context while diving deeper into data details.

### Requirements

* **Drawer Width:** Desktop and mobile drawer widths must be defined through the design system and shared component library, not hardcoded in individual modules.
* **Mobile Behavior:** Must use the shared responsive drawer variant for full-width mobile presentation.
* **Structure:** Fixed header, fixed footer, scrollable inner body.

### Recommended Usage vs. Avoidance

* ✅ **Do Use For:** Deep-dive detail previews (e.g., clicking a table row to see full profile metrics), viewing activity audit logs, or system timelines.
* ❌ **Do NOT Use For:** Multi-step business setups or deeply nested administrative tasks.

---

## 10. Empty State Standards

Blank screens or raw empty white blocks damage confidence and leave users confused. Every empty state must turn a lack of data into an onboarding opportunity.

### Mandatory Elements

1. **What is missing:** Clear statement of what component or dataset is empty.
2. **Why it is empty:** Explanation (e.g., no data created yet, or active filters found nothing).
3. **Next clear step:** Call to action telling the user exactly how to fix it.

### Approved Copy Examples

> **No records found.** > *Try changing your filter settings or create a new record using the button above.*

> **No activity available.** > *System activity and logs will appear automatically here once operational actions are performed.*

---

## 11. Loading State Standards

Visual reassurance must be provided instantaneously during any network request or computational delay.

### Requirements

* **Prefer Skeletons:** Use targeted structural skeleton loaders matching the exact shape of the incoming data components (Table, Card, or Form skeletons). Avoid generic, full-screen opaque loading blockers.
* **Prevent Double Submission:** Disable interaction on action buttons immediately upon clicking to prevent multiple duplicate API payloads.

---

## 12. Error Handling Standards

Error displays must be secure, graceful, and informative.

### Requirements

* **Scoping:** Field errors go directly beneath inputs. Global/System errors belong in an alert banner near the top of the page viewport.
* **State Preservation:** When a form submission fails, user-entered data must be preserved in the fields—**never clear a form on failure.**
* **Security:** Never dump stack traces, raw SQL, or cloud infrastructure error strings into the client UI.

### Approved Copy Example

> **Unable to save changes.** > *Please review the highlighted fields below and try again.*

---

## 13. Dashboard Standards

SaaS dashboards must act as operational control centers that prompt decisions, rather than passive, read-only analytics dumping grounds.

### Recommended Grid Architecture

1. **Key Metrics Grid:** High-level key performance highlights.
2. **Pending Actions Queue:** Tasks requiring immediate user intervention.
3. **Recent Activity / Audit Feed:** Real-time log of tenant occurrences.
4. **Alerts Panel:** System anomalies or threshold warnings.

### Core Principles

* Display actionable or high-priority items at the top.
* Visually flag overdue, failing, or bottlenecked workflows first.

---

## 14. Responsive Design Standards

The administrative application must gracefully scale across distinct system viewports.

* **Desktop:** Standard multi-column layouts, full sidebars, intensive data grids.
* **Laptop:** Dense data-grids compress to prioritize essential columns; non-critical columns hide gracefully.
* **Tablet:** Sidebar collapses to an icon menu or hamburger toggle; tables introduce horizontal swipe properties or switch to card structures.
* **Mobile:** Strict single-column stack layout. Large tables convert to customized card components. Primary action triggers pin to the bottom or top headers for easier thumb access.

---

## 15. Accessibility (a11y) Standards

Building for inclusion ensures accessibility, programmatic compliance, and enhanced usability.

### Requirements

* **Keyboard Navigation:** All interactive elements must be accessible via `Tab` and executable via `Enter` or `Spacebar`.
* **Focus Ring:** Visible focus indicator outlines must never be stripped away via CSS (`outline: none` is forbidden unless replaced with an equally clear custom focus style).
* **Semantic Markup:** Use native HTML tags properly (`<button>`, `<nav>`, `<main>`, `<aside>`).
* **Color Independence:** Never use color as the *only* means of conveying critical information. Status badges must rely on text strings, icons, or labels alongside their color profiles.

---

## 16. Theme Standards

Theme implementation must remain centralized so visual identity changes can be rolled out without module-level rewrites.

### Requirements

* No hardcoded colors in components or feature modules.
* No inline styling for branding, color, or theming concerns.
* Use centralized design tokens for colors, borders, text, backgrounds, and interactive states.
* Theme changes and future rebranding must be supported through configuration only.

### Preferred Token Usage

* `bg-primary`
* `text-primary`
* `border-primary`

### Avoid

* `style={{ color: "#123456" }}`

---

## 17. Code Quality Standards

Code quality rules must prevent unnecessary code, unsafe shortcuts, and avoidable production noise from entering the codebase.

### Build-Blocking Rules

Builds must fail for:

* TypeScript errors
* Unused imports
* Unused variables
* Unused parameters

### Requirements

* Avoid `any` unless a narrowly justified exception is documented and unavoidable.
* Avoid `console.log` in production code.
* Dead code must be removed rather than left commented out or unused in the module.
* Linting and type-checking rules must be enforced consistently in local development and CI.

---

## 18. Common UI Completion Checklist

Before passing any administrative screen from development into Quality Assurance (QA) or staging, verify every item below:

* [ ] Header uses the shared height token and pinning specs.
* [ ] Sidebar updates active states perfectly and collapses cleanly.
* [ ] Page title is dynamic and correctly populated.
* [ ] Buttons use shared component size variants and don't wrap text.
* [ ] Button labels clearly describe actions and avoid ambiguous verbs.
* [ ] Forms use proper vertical spacing, inline errors, top-aligned labels, and protect against accidental data loss or duplicate submission.
* [ ] Tables provide loading, empty, error, pagination, filtering, and applicable sorting/export states.
* [ ] Status variables use friendly text styling rather than backend code strings.
* [ ] Loading states (Skeletons) trigger seamlessly on async actions.
* [ ] Empty states render fully informative copy and clear next actions.
* [ ] Form and page error handling preserves recoverable user state and does not clear form data on failure.
* [ ] Actions requiring missing user privileges are hidden from view.
* [ ] Double scrollbars are eliminated completely.
* [ ] No visual text clipping or layout overflow exists.
* [ ] Responsive layouts function properly across desktop, tablet, and mobile viewports.
* [ ] Basic keyboard and screen-reader accessibility metrics are met.
* [ ] Theme usage relies on centralized design tokens without hardcoded colors or inline branding styles.
* [ ] Build checks fail on unused code, TypeScript errors, and other enforced code quality violations.
