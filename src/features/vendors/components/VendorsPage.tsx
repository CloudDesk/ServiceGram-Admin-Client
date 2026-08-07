import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCheck2,
  FileWarning,
  Filter,
  Landmark,
  MapPin,
  MessageSquarePlus,
  MoreHorizontal,
  PauseCircle,
  Phone,
  RefreshCcw,
  RotateCcw,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react'
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { ListHeaderSearch } from '../../../components/ui/ListHeaderSearch'
import {
  LIST_SELECTION_COLUMN_WIDTH,
  ListSelectionCheckbox,
  ListSelectionToolbar,
} from '../../../components/ui/ListSelection'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import {
  QuickPreviewActions,
  QuickPreviewFact,
  QuickPreviewFactGrid,
  QuickPreviewTabs,
  type QuickPreviewAction,
} from '../../../components/ui/QuickPreview'
import { Skeleton } from '../../../components/ui/Skeleton'
import {
  inferMediaViewerKind,
  isOpenableMediaUrl,
  useMediaViewer,
  type MediaViewerItem,
} from '../../../components/media'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { readLookupOptionsFromSearchParams } from '../../../utils/buildQueryParams'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { searchCategoryLookupOptions } from '../../lookups/adminLookups'
import { vendorService } from '../services/vendor.service'
import {
  VendorActionModal,
  type VendorActionFormValues,
  type VendorActionKind,
  type VendorActionSelection,
} from './VendorActionModal'
import type {
  VendorListItem,
  VendorListQueryParams,
  VendorOnboardingStatus,
  VendorPagination,
  VendorStatus,
} from '../types/vendor.types'

type VendorViewMode = 'active' | 'onboarding'
type VendorTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type VendorQueueKey =
  | 'active'
  | 'onboarding'
  | 'underReview'
  | 'documentsPending'
  | 'rejected'
  | 'suspended'
type VendorListActionKind = Extract<
  VendorActionKind,
  | 'ADD_NOTE'
  | 'APPROVE'
  | 'REACTIVATE'
  | 'REJECT'
  | 'REQUEST_DOCUMENTS'
  | 'SUSPEND'
>
type VendorRowPrimaryAction =
  | {
      kind: 'APPROVE' | 'REACTIVATE'
      label: string
      mode: 'action'
      title: string
      variant: 'primary' | 'secondary'
    }
  | {
      label: string
      mode: 'details'
      title: string
      variant: 'secondary'
    }
interface VendorRowOverflowAction {
  icon: ReactNode
  key: string
  kind: VendorListActionKind
  label: string
  tone?: 'danger' | 'success' | 'warning'
}
type VendorPreviewTab = 'summary' | 'review' | 'payout'

const DEFAULT_PAGE_SIZE = 10
const VENDOR_DEFAULT_COLUMN_WIDTH = 220
const VENDOR_GRID_COLUMN_GAP = 6
const VENDOR_GRID_INLINE_PADDING = 16
const VENDOR_ACTION_COLUMN_ID = 'actions'
const VENDOR_ACTION_COLUMN_DEFAULT_WIDTH = 176
const VENDOR_ACTION_COLUMN_MIN_WIDTH = 168
const VENDOR_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.vendor.columnWidths.v5'
const VENDOR_FILTER_CONTROL_CLASS_NAME =
  'h-9 w-full rounded-[0.65rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'
const vendorListActionKinds = [
  'ADD_NOTE',
  'APPROVE',
  'REACTIVATE',
  'REJECT',
  'REQUEST_DOCUMENTS',
  'SUSPEND',
] as const
const vendorRowOverflowActionOrder = [
  'REQUEST_DOCUMENTS',
  'REJECT',
  'SUSPEND',
  'REACTIVATE',
] as const
const VENDOR_ROW_ACTION_MENU_WIDTH = 216
const VENDOR_ROW_ACTION_MENU_GAP = 8
const VENDOR_ROW_ACTION_MENU_PADDING = 12
const VENDOR_ROW_ACTION_MENU_MIN_HEIGHT = 128
const VENDOR_ROW_ACTION_MENU_MAX_HEIGHT = 280

const vendorDataColumns = [
  { id: 'vendor', label: 'Vendor', defaultWidth: 270, minWidth: 220 },
  {
    id: 'category',
    label: 'Category / Location',
    defaultWidth: 190,
    minWidth: 160,
  },
  { id: 'city', label: 'City', defaultWidth: 180, minWidth: 145 },
  {
    id: 'vendorStatus',
    label: 'Vendor Status',
    defaultWidth: 160,
    minWidth: 155,
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    defaultWidth: 145,
    minWidth: 130,
  },
  {
    id: 'payout',
    label: 'Payout Account',
    defaultWidth: 170,
    minWidth: 150,
  },
  {
    id: 'documents',
    label: 'Documents',
    defaultWidth: 150,
    minWidth: 135,
  },
  { id: 'updatedAt', label: 'Updated', defaultWidth: VENDOR_DEFAULT_COLUMN_WIDTH, minWidth: 155 },
] as const

type VendorColumnId = (typeof vendorDataColumns)[number]['id']
type VendorColumnWidthId = VendorColumnId | typeof VENDOR_ACTION_COLUMN_ID
type VendorColumnWidths = Partial<Record<VendorColumnWidthId, number>>

const defaultVendorColumns: VendorColumnId[] = [
  'vendor',
  'category',
  'onboarding',
  'payout',
  'documents',
]

type VendorTableRow = VendorListItem

interface VendorGridStyle extends CSSProperties {
  '--vendor-grid-template': string
  '--vendor-grid-min-width': string
}

interface VendorActionTarget {
  action: VendorActionSelection
  vendor: VendorTableRow
}

function isRejectedVendor(vendor: VendorTableRow) {
  return (
    vendor.onboardingStatus === 'REJECTED' &&
    vendor.vendorStatus === 'INACTIVE'
  )
}

function getVendorActionSource(vendor: VendorTableRow) {
  if (
    !isRejectedVendor(vendor) ||
    vendor.availableActions.includes('REACTIVATE')
  ) {
    return vendor.availableActions
  }

  return [...vendor.availableActions, 'REACTIVATE']
}

function isVendorListActionKind(action: string | null | undefined): action is VendorListActionKind {
  return vendorListActionKinds.includes(action as VendorListActionKind)
}

function getVisibleVendorActions(actions: string[]) {
  return actions.filter(isVendorListActionKind)
}

function getVendorStatusTone(status: VendorStatus): VendorTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'SUSPENDED') return 'danger'
  if (status === 'PENDING') return 'warning'
  return 'neutral'
}

function getOnboardingStatusTone(status: VendorOnboardingStatus): VendorTone {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'DOCUMENTS_PENDING' || status === 'UNDER_REVIEW') return 'warning'
  return 'info'
}

function getPayoutAccountTone(row: VendorTableRow): VendorTone {
  const summary = row.bankAccountSummary

  if (!summary || !summary.hasPrimary) return 'warning'
  if (summary.payoutReady || summary.primaryStatus === 'VERIFIED') return 'success'
  if (summary.primaryStatus === 'REJECTED' || summary.primaryStatus === 'DISABLED') {
    return 'danger'
  }

  return 'warning'
}

function getPayoutAccountLabel(row: VendorTableRow) {
  const summary = row.bankAccountSummary

  if (!summary) return 'Not available'
  if (!summary.hasPrimary) return 'Not submitted'
  if (summary.payoutReady) return 'Payout Ready'

  return summary.primaryStatus ? humanizeCode(summary.primaryStatus) : 'Review Needed'
}

function getPayoutAccountMeta(row: VendorTableRow) {
  const summary = row.bankAccountSummary

  if (!summary) return 'Bank summary unavailable'
  if (!summary.hasPrimary) return 'No primary account'

  return (
    [summary.primaryBankName, summary.primaryAccountNumberMasked]
      .filter(Boolean)
      .join(' · ') || `${summary.verified}/${summary.total} verified`
  )
}

function getDocumentSummaryLabel(vendor: VendorTableRow) {
  if (!vendor.documentSummary) return 'No documents'

  return `${vendor.documentSummary.verified}/${vendor.documentSummary.total} verified`
}

function getDocumentSummaryTone(vendor: VendorTableRow): VendorTone {
  const summary = vendor.documentSummary

  if (!summary || summary.total === 0) return 'warning'
  if (summary.rejected || summary.expired) return 'danger'
  if (summary.verified === summary.total) return 'success'
  return 'warning'
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Review vendor'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getVendorInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'
  return formatDate(value, true)
}

function formatRefreshTime(value: number) {
  if (!value) return 'Not refreshed yet'

  return `Last refreshed ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))}`
}

function vendorNeedsAttention(vendor: VendorTableRow) {
  return (
    vendor.vendorStatus === 'SUSPENDED' ||
    vendor.onboardingStatus !== 'APPROVED' ||
    vendor.warnings.length > 0 ||
    Boolean(visibleRecommendedAction(vendor)) ||
    getPayoutAccountTone(vendor) !== 'success'
  )
}

function visibleRecommendedAction(vendor: VendorTableRow) {
  const action = vendor.nextRecommendedAction?.toUpperCase()

  if (!isVendorListActionKind(action)) {
    return null
  }

  return action
}

function mapRecommendedAction(vendor: VendorTableRow): VendorListActionKind | null {
  const action =
    visibleRecommendedAction(vendor) ??
    (isRejectedVendor(vendor) ? 'REACTIVATE' : null)

  if (
    action === 'ADD_NOTE' ||
    action === 'APPROVE' ||
    action === 'REACTIVATE' ||
    action === 'REJECT' ||
    action === 'REQUEST_DOCUMENTS' ||
    action === 'SUSPEND'
  ) {
    if (
      action === 'ADD_NOTE' ||
      getVisibleVendorActions(getVendorActionSource(vendor)).includes(action)
    ) {
      return action
    }
  }

  return null
}

function primaryActionLabel(vendor: VendorTableRow) {
  const action = mapRecommendedAction(vendor)

  if (action) return humanizeCode(action)
  if (vendor.onboardingStatus !== 'APPROVED') return 'Review vendor'
  if (vendor.vendorStatus === 'SUSPENDED') return 'Review suspension'
  if (getPayoutAccountTone(vendor) !== 'success') return 'Review payout'

  return 'View details'
}

function getVendorRowPrimaryAction(vendor: VendorTableRow): VendorRowPrimaryAction {
  const recommendedAction = mapRecommendedAction(vendor)
  const visibleActions = getVisibleVendorActions(getVendorActionSource(vendor))

  if (recommendedAction === 'APPROVE') {
    return {
      kind: 'APPROVE',
      label: 'Approve',
      mode: 'action',
      title: 'Approve this vendor',
      variant: 'primary',
    }
  }

  if (
    recommendedAction === 'REACTIVATE' ||
    ((isRejectedVendor(vendor) || vendor.vendorStatus === 'SUSPENDED') &&
      visibleActions.includes('REACTIVATE'))
  ) {
    return {
      kind: 'REACTIVATE',
      label: 'Reactivate',
      mode: 'action',
      title: 'Reactivate this vendor',
      variant: 'secondary',
    }
  }

  if (vendorNeedsAttention(vendor)) {
    return {
      label: 'Review',
      mode: 'details',
      title: primaryActionLabel(vendor),
      variant: 'secondary',
    }
  }

  return {
    label: 'Open',
    mode: 'details',
    title: 'Open vendor detail',
    variant: 'secondary',
  }
}

function buildVendorRowOverflowActions({
  primaryAction,
  visibleActions,
}: {
  primaryAction: VendorRowPrimaryAction
  visibleActions: VendorListActionKind[]
}): VendorRowOverflowAction[] {
  return vendorRowOverflowActionOrder
    .filter((kind) => {
      if (!visibleActions.includes(kind)) return false
      return primaryAction.mode !== 'action' || primaryAction.kind !== kind
    })
    .map((kind) => {
      if (kind === 'REQUEST_DOCUMENTS') {
        return {
          icon: <FileWarning className="size-4" />,
          key: 'request-documents',
          kind,
          label: 'Request docs',
          tone: 'warning' as const,
        }
      }

      if (kind === 'REJECT') {
        return {
          icon: <XCircle className="size-4" />,
          key: 'reject',
          kind,
          label: 'Reject',
          tone: 'danger' as const,
        }
      }

      if (kind === 'SUSPEND') {
        return {
          icon: <PauseCircle className="size-4" />,
          key: 'suspend',
          kind,
          label: 'Suspend',
          tone: 'danger' as const,
        }
      }

      return {
        icon: <RotateCcw className="size-4" />,
        key: 'reactivate',
        kind,
        label: 'Reactivate',
        tone: 'success' as const,
      }
    })
}

function getApprovalBlockMessage(vendor: VendorTableRow) {
  const summary = vendor.documentSummary

  if (!summary || summary.total === 0) {
    return 'Approval is blocked until the vendor uploads required documents.'
  }

  const unverifiedCount = Math.max(summary.total - summary.verified, 0)

  if (unverifiedCount === 0) return null

  return `Approval is blocked until ${unverifiedCount} document${unverifiedCount === 1 ? '' : 's'} are verified.`
}

function getDefaultVendorColumnWidths() {
  const widths: VendorColumnWidths = {
    [VENDOR_ACTION_COLUMN_ID]: VENDOR_ACTION_COLUMN_DEFAULT_WIDTH,
  }

  vendorDataColumns.forEach((column) => {
    widths[column.id] = column.defaultWidth
  })

  return widths
}

const defaultVendorColumnWidths = getDefaultVendorColumnWidths()

function getVendorColumnMinWidth(columnId: VendorColumnWidthId) {
  if (columnId === VENDOR_ACTION_COLUMN_ID) return VENDOR_ACTION_COLUMN_MIN_WIDTH
  return vendorDataColumns.find((column) => column.id === columnId)?.minWidth ?? 120
}

function getVendorColumnDefaultWidth(columnId: VendorColumnWidthId) {
  return defaultVendorColumnWidths[columnId] ?? getVendorColumnMinWidth(columnId)
}

function getVendorColumnWidth(
  columnWidths: VendorColumnWidths,
  columnId: VendorColumnWidthId,
) {
  return Math.max(
    getVendorColumnMinWidth(columnId),
    columnWidths[columnId] ?? getVendorColumnDefaultWidth(columnId),
  )
}

function normalizeVendorColumnWidths(value: unknown) {
  const widths = { ...defaultVendorColumnWidths }

  if (!value || typeof value !== 'object') return widths

  const record = value as Record<string, unknown>

  vendorDataColumns.forEach((column) => {
    const width = record[column.id]

    if (typeof width === 'number' && Number.isFinite(width)) {
      widths[column.id] = Math.max(column.minWidth, Math.round(width))
    }
  })

  const actionWidth = record[VENDOR_ACTION_COLUMN_ID]

  if (typeof actionWidth === 'number' && Number.isFinite(actionWidth)) {
    widths[VENDOR_ACTION_COLUMN_ID] = Math.max(
      VENDOR_ACTION_COLUMN_MIN_WIDTH,
      Math.round(actionWidth),
    )
  }

  return widths
}

function loadVendorColumnWidths() {
  if (typeof window === 'undefined') return defaultVendorColumnWidths

  try {
    return normalizeVendorColumnWidths(
      JSON.parse(
        window.localStorage.getItem(VENDOR_COLUMN_WIDTH_STORAGE_KEY) ?? 'null',
      ),
    )
  } catch {
    return defaultVendorColumnWidths
  }
}

function getVendorGridTemplate(
  visibleColumns: VendorColumnId[],
  columnWidths: VendorColumnWidths,
) {
  const selectedWidths = vendorDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => {
      const width = getVendorColumnWidth(columnWidths, column.id)

      return column.id === 'vendor' ? `minmax(${width}px, 1fr)` : `${width}px`
    })

  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...selectedWidths,
    `${getVendorColumnWidth(columnWidths, VENDOR_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getVendorGridMinWidth(
  visibleColumns: VendorColumnId[],
  columnWidths: VendorColumnWidths,
) {
  const visibleColumnCount = visibleColumns.length
  const gridColumnCount = visibleColumnCount + 2
  const gridGapWidth = Math.max(gridColumnCount - 1, 0) * VENDOR_GRID_COLUMN_GAP
  const visibleWidth = vendorDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .reduce(
      (total, column) => total + getVendorColumnWidth(columnWidths, column.id),
      0,
    )

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    getVendorColumnWidth(columnWidths, VENDOR_ACTION_COLUMN_ID) +
    gridGapWidth +
    VENDOR_GRID_INLINE_PADDING
  }px`
}

function getVendorQuery(
  viewMode: VendorViewMode,
  vendorStatus: '' | VendorStatus,
): Pick<VendorListQueryParams, 'vendorStatus'> {
  if (vendorStatus) return { vendorStatus }
  if (viewMode === 'active') return { vendorStatus: 'ACTIVE' }
  return {}
}

interface ActiveFilterChip {
  key: string
  label: string
  onClear: () => void
}

function ActiveFilterChips({
  chips,
  onClearAll,
}: {
  chips: ActiveFilterChip[]
  onClearAll: () => void
}) {
  if (!chips.length) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          className="inline-flex min-h-7 max-w-full items-center gap-2 rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-foreground"
          key={chip.key}
        >
          <span className="truncate">{chip.label}</span>
          <button
            aria-label={`Clear ${chip.label}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground"
            type="button"
            onClick={chip.onClear}
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <button
        className="min-h-7 rounded-full px-2.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
        type="button"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  )
}

function VendorPreviewField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </span>
    </div>
  )
}

function vendorPreviewActionIcon(action: VendorListActionKind) {
  if (action === 'ADD_NOTE') return <MessageSquarePlus className="size-4" />
  if (action === 'APPROVE') return <CheckCircle2 className="size-4" />
  if (action === 'REQUEST_DOCUMENTS') return <FileWarning className="size-4" />
  if (action === 'REJECT') return <XCircle className="size-4" />
  if (action === 'SUSPEND') return <PauseCircle className="size-4" />
  if (action === 'REACTIVATE') return <RotateCcw className="size-4" />

  return <ArrowUpRight className="size-4" />
}

function vendorPreviewActionLabel(action: VendorListActionKind) {
  if (action === 'REQUEST_DOCUMENTS') return 'Request docs'
  return humanizeCode(action)
}

function vendorPreviewActionVariant(
  action: VendorListActionKind,
): QuickPreviewAction['variant'] {
  if (action === 'REJECT' || action === 'SUSPEND') return 'danger'
  if (action === 'APPROVE') return 'primary'
  return 'secondary'
}

function VendorPreviewPanel({
  isSubmitting,
  onClose,
  onOpenAction,
  onOpenDetails,
  vendor,
}: {
  isSubmitting: boolean
  onClose: () => void
  onOpenAction: (vendor: VendorTableRow, kind: VendorListActionKind) => void
  onOpenDetails: (vendor: VendorTableRow) => void
  vendor: VendorTableRow
}) {
  const recommendedAction = mapRecommendedAction(vendor)
  const visibleActions = getVisibleVendorActions(getVendorActionSource(vendor))
  const hasAction = (action: VendorListActionKind) => visibleActions.includes(action)
  const approvalBlockMessage = getApprovalBlockMessage(vendor)
  const warnings = [
    ...vendor.warnings,
    ...(vendor.bankAccountSummary?.warnings ?? []),
  ]
  const showAddNoteAction = recommendedAction !== 'ADD_NOTE'
  const showApproveAction = hasAction('APPROVE') && recommendedAction !== 'APPROVE'
  const showRequestDocumentsAction =
    hasAction('REQUEST_DOCUMENTS') && recommendedAction !== 'REQUEST_DOCUMENTS'
  const showRejectAction = hasAction('REJECT') && recommendedAction !== 'REJECT'
  const showSuspendAction = hasAction('SUSPEND') && recommendedAction !== 'SUSPEND'
  const showReactivateAction =
    hasAction('REACTIVATE') && recommendedAction !== 'REACTIVATE'
  const [activeTab, setActiveTab] = useState<VendorPreviewTab>('summary')
  const previewTabs: { key: VendorPreviewTab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'review', label: 'Review' },
    { key: 'payout', label: 'Payout' },
  ]
  const priorityLabel = recommendedAction
    ? vendorPreviewActionLabel(recommendedAction)
    : vendorNeedsAttention(vendor)
      ? 'Review vendor'
      : 'No active blocker'
  const priorityDescription = recommendedAction
    ? 'Backend workflow recommends this as the next operational step.'
    : vendorNeedsAttention(vendor)
      ? 'Check onboarding, payout, and warning signals before action.'
      : 'No visible list-level blocker for this vendor.'
  const primaryAction: QuickPreviewAction | null = recommendedAction
    ? {
        disabled:
          isSubmitting ||
          (recommendedAction === 'APPROVE' && Boolean(approvalBlockMessage)),
        icon: vendorPreviewActionIcon(recommendedAction),
        key: recommendedAction,
        label: vendorPreviewActionLabel(recommendedAction),
        onClick: () => onOpenAction(vendor, recommendedAction),
        title:
          recommendedAction === 'APPROVE'
            ? approvalBlockMessage ?? undefined
            : undefined,
        variant: vendorPreviewActionVariant(recommendedAction),
      }
    : null
  const detailAction: QuickPreviewAction = {
    icon: <Eye className="size-4" />,
    key: 'details',
    label: primaryAction ? 'Detail' : 'Open detail',
    onClick: () => onOpenDetails(vendor),
  }
  const secondaryActions: QuickPreviewAction[] = []

  if (showAddNoteAction) {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: vendorPreviewActionIcon('ADD_NOTE'),
      key: 'add-note',
      label: 'Add note',
      onClick: () => onOpenAction(vendor, 'ADD_NOTE'),
      variant: 'secondary',
    })
  }

  if (showApproveAction) {
    secondaryActions.push({
      disabled: isSubmitting || Boolean(approvalBlockMessage),
      icon: vendorPreviewActionIcon('APPROVE'),
      key: 'approve',
      label: 'Approve',
      onClick: () => onOpenAction(vendor, 'APPROVE'),
      title: approvalBlockMessage ?? undefined,
      variant: 'primary',
    })
  }

  if (showRequestDocumentsAction) {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: vendorPreviewActionIcon('REQUEST_DOCUMENTS'),
      key: 'request-docs',
      label: 'Request docs',
      onClick: () => onOpenAction(vendor, 'REQUEST_DOCUMENTS'),
      variant: 'secondary',
    })
  }

  if (showRejectAction) {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: vendorPreviewActionIcon('REJECT'),
      key: 'reject',
      label: 'Reject',
      onClick: () => onOpenAction(vendor, 'REJECT'),
      variant: 'danger',
    })
  }

  if (showSuspendAction) {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: vendorPreviewActionIcon('SUSPEND'),
      key: 'suspend',
      label: 'Suspend',
      onClick: () => onOpenAction(vendor, 'SUSPEND'),
      variant: 'secondary',
    })
  }

  if (showReactivateAction) {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: vendorPreviewActionIcon('REACTIVATE'),
      key: 'reactivate',
      label: 'Reactivate',
      onClick: () => onOpenAction(vendor, 'REACTIVATE'),
      variant: 'secondary',
    })
  }

  return (
    <>
      <button
        aria-label="Close vendor preview"
        className="fixed inset-0 z-40 bg-black/20 xl:hidden"
        type="button"
        onClick={onClose}
      />
      <aside className="fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:inset-x-auto xl:bottom-6 xl:right-6 xl:top-[calc(var(--spacing-topbar)+0.75rem)] xl:z-40 xl:w-[22rem]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted">
              Vendor preview
            </p>
            <div className="mt-2 flex min-w-0 items-start gap-3">
              <VendorLogoMark vendor={vendor} />
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {vendor.shopName}
                </h3>
                <p className="mt-1 break-all text-xs text-muted">
                  {vendor.publicVendorId}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={getVendorStatusTone(vendor.vendorStatus)}>
                    {vendor.vendorStatus}
                  </Badge>
                  <Badge tone={getOnboardingStatusTone(vendor.onboardingStatus)}>
                    {vendor.onboardingStatus}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <button
            aria-label="Close preview"
            className="btn-icon shrink-0"
            title="Close preview"
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <QuickPreviewTabs
          activeTab={activeTab}
          ariaLabel="Vendor preview sections"
          tabs={previewTabs}
          onChange={setActiveTab}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'summary' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border bg-surface-muted/45 p-3">
                <div className="flex items-start gap-2">
                  <FileCheck2
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      recommendedAction || vendorNeedsAttention(vendor)
                        ? 'text-warning'
                        : 'text-success',
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {priorityLabel}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {priorityDescription}
                    </p>
                  </div>
                </div>
              </div>

              <QuickPreviewFactGrid>
                <QuickPreviewFact
                  label="Owner"
                  value={vendor.ownerName ?? 'No owner'}
                />
                <QuickPreviewFact label="Mobile" value={vendor.mobileNumber} />
                <QuickPreviewFact
                  label="Documents"
                  value={getDocumentSummaryLabel(vendor)}
                />
                <QuickPreviewFact
                  label="Payout"
                  value={getPayoutAccountLabel(vendor)}
                />
              </QuickPreviewFactGrid>
            </div>
          ) : null}

          {activeTab === 'review' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Phone className="size-4 text-muted" />
                  Contact
                </div>
                <VendorPreviewField label="Owner" value={vendor.ownerName} />
                <VendorPreviewField label="Mobile" value={vendor.mobileNumber} />
                <VendorPreviewField
                  label="Email"
                  value={vendor.businessEmail ?? 'No email'}
                />
                <VendorPreviewField
                  label="Alternate"
                  value={vendor.alternativeMobileNumber}
                />
              </div>

              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileCheck2 className="size-4 text-muted" />
                  Review
                </div>
                <VendorPreviewField
                  label="Category"
                  value={vendor.category?.name ?? 'Unassigned'}
                />
                <VendorPreviewField
                  label="Documents"
                  value={getDocumentSummaryLabel(vendor)}
                />
                <VendorPreviewField
                  label="Rejected"
                  value={vendor.documentSummary?.rejected ?? 0}
                />
                <VendorPreviewField
                  label="Warnings"
                  value={
                    warnings.length ? warnings.map(humanizeCode).join(', ') : 'None'
                  }
                />
              </div>
            </div>
          ) : null}

          {activeTab === 'payout' ? (
            <div className="rounded-[0.75rem] border border-border p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Landmark className="size-4 text-muted" />
                Payout & Location
              </div>
              <VendorPreviewField
                label="Payout"
                value={getPayoutAccountLabel(vendor)}
              />
              <VendorPreviewField
                label="Bank"
                value={getPayoutAccountMeta(vendor)}
              />
              <VendorPreviewField
                label="City"
                value={vendor.address.city || 'No city'}
              />
              <VendorPreviewField
                label="Zone"
                value={vendor.address.zone?.zoneName ?? 'No zone'}
              />
            </div>
          ) : null}
        </div>

        <QuickPreviewActions
          detailAction={detailAction}
          primaryAction={primaryAction}
          secondaryActions={secondaryActions}
        />
      </aside>
    </>
  )
}

function VendorRowsSkeleton() {
  return (
    <div className="space-y-1.5 p-3">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="h-16 w-full rounded-[0.8rem]" key={index} />
      ))}
    </div>
  )
}

function VendorPagination({
  onPageChange,
  onPageSizeChange,
  pagination,
}: {
  onPageChange: (page: number) => void
  onPageSizeChange: (limit: number) => void
  pagination?: VendorPagination
}) {
  if (!pagination) return null

  const start =
    pagination.totalItems === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.totalItems)

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface-muted px-3 py-2.5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing {start}-{end} of {pagination.totalItems}
        </span>
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select
            aria-label="Rows per page"
            className="h-9 rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
            value={pagination.limit}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[10, 20, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3 sm:justify-end">
        <button
          aria-label="Previous page"
          className="btn-icon"
          disabled={!pagination.hasPreviousPage}
          type="button"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium text-foreground">
          Page {pagination.page} of {Math.max(1, pagination.totalPages)}
        </span>
        <button
          aria-label="Next page"
          className="btn-icon"
          disabled={!pagination.hasNextPage}
          type="button"
          onClick={() =>
            onPageChange(Math.min(pagination.totalPages, pagination.page + 1))
          }
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

interface VendorRowActionMenuPosition {
  maxHeight: number
  right: number
  top: number
}

function VendorRowActionMenu({
  actions,
  disabled,
  onSelect,
  vendorName,
}: {
  actions: VendorRowOverflowAction[]
  disabled: boolean
  onSelect: (kind: VendorListActionKind) => void
  vendorName: string
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<VendorRowActionMenuPosition | null>(
    null,
  )

  const closeMenu = () => {
    setOpen(false)
    setPosition(null)
  }

  const updatePosition = () => {
    const anchor = anchorRef.current

    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const availableBelow =
      window.innerHeight - rect.bottom - VENDOR_ROW_ACTION_MENU_PADDING
    const availableAbove = rect.top - VENDOR_ROW_ACTION_MENU_PADDING
    const shouldOpenAbove =
      availableBelow < VENDOR_ROW_ACTION_MENU_MIN_HEIGHT &&
      availableAbove > availableBelow
    const availableSpace = shouldOpenAbove ? availableAbove : availableBelow
    const maxHeight = Math.min(
      VENDOR_ROW_ACTION_MENU_MAX_HEIGHT,
      Math.max(
        VENDOR_ROW_ACTION_MENU_MIN_HEIGHT,
        availableSpace - VENDOR_ROW_ACTION_MENU_GAP,
      ),
    )
    const top = shouldOpenAbove
      ? Math.max(
          VENDOR_ROW_ACTION_MENU_PADDING,
          rect.top - VENDOR_ROW_ACTION_MENU_GAP - maxHeight,
        )
      : Math.min(
          Math.max(
            VENDOR_ROW_ACTION_MENU_PADDING,
            rect.bottom + VENDOR_ROW_ACTION_MENU_GAP,
          ),
          window.innerHeight - VENDOR_ROW_ACTION_MENU_PADDING - maxHeight,
        )
    const maxRight = Math.max(
      VENDOR_ROW_ACTION_MENU_PADDING,
      window.innerWidth -
        VENDOR_ROW_ACTION_MENU_PADDING -
        VENDOR_ROW_ACTION_MENU_WIDTH,
    )
    const right = Math.min(
      Math.max(VENDOR_ROW_ACTION_MENU_PADDING, window.innerWidth - rect.right),
      maxRight,
    )

    setPosition({ maxHeight, right, top })
  }

  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null

      if (
        target &&
        (anchorRef.current?.contains(target) || menuRef.current?.contains(target))
      ) {
        return
      }

      closeMenu()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    const handleClose = () => closeMenu()

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleClose)
    window.addEventListener('scroll', handleClose, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleClose)
      window.removeEventListener('scroll', handleClose, true)
    }
  }, [open])

  const menu =
    open && position && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="premium-common-surface fixed overflow-y-auto rounded-[0.8rem] border border-border bg-surface p-1 shadow-[var(--sg-shadow-overlay)]"
            ref={menuRef}
            role="menu"
            style={{
              maxHeight: position.maxHeight,
              right: position.right,
              top: position.top,
              width: VENDOR_ROW_ACTION_MENU_WIDTH,
              zIndex: 1000,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {actions.map((action) => (
              <button
                className={cn(
                  'flex w-full items-center gap-2 rounded-[0.65rem] px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60',
                  action.tone === 'danger' && 'text-danger hover:text-danger',
                  action.tone === 'success' && 'text-success hover:text-success',
                  action.tone === 'warning' && 'text-warning hover:text-warning',
                )}
                disabled={disabled}
                key={action.key}
                role="menuitem"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  closeMenu()
                  onSelect(action.kind)
                }}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null

  if (actions.length === 0) return null

  return (
    <div className="relative inline-flex">
      <span className="inline-flex" ref={anchorRef}>
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`More actions for ${vendorName}`}
          className="btn-icon size-8 min-h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          title="More actions"
          type="button"
          onClick={(event) => {
            event.stopPropagation()

            if (open) {
              closeMenu()
              return
            }

            updatePosition()
            setOpen(true)
          }}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </span>
      {menu}
    </div>
  )
}

function getVendorLogoUrl(vendor: VendorTableRow) {
  return vendor.brandLogo?.url ?? vendor.brandLogo?.downloadUrl ?? null
}

function buildVendorListLogoMediaItem(
  vendor: VendorTableRow,
): MediaViewerItem | null {
  const logoUrl = getVendorLogoUrl(vendor)

  if (!isOpenableMediaUrl(logoUrl)) return null

  return {
    description: 'Brand logo shown across vendor records.',
    downloadUrl: vendor.brandLogo?.downloadUrl ?? logoUrl,
    expiresAt: vendor.brandLogo?.expiresAt,
    fileName: vendor.brandLogo?.fileName,
    id: `${vendor.vendorId}-brand-logo`,
    kind: inferMediaViewerKind({
      fileName: vendor.brandLogo?.fileName,
      mimeType: vendor.brandLogo?.mimeType,
      src: logoUrl,
    }),
    mimeType: vendor.brandLogo?.mimeType,
    ownerLabel: vendor.shopName,
    providerStatus: vendor.brandLogo?.providerStatus,
    sizeBytes: vendor.brandLogo?.sizeBytes,
    sourceLabel: 'Vendor brand logo',
    src: logoUrl,
    title: `${vendor.shopName} brand logo`,
    warnings: vendor.brandLogo?.warnings ?? [],
  }
}

function VendorLogoMark({
  onOpen,
  vendor,
}: {
  onOpen?: () => void
  vendor: VendorTableRow
}) {
  const logoUrl = getVendorLogoUrl(vendor)
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)
  const canShowLogo = Boolean(logoUrl && failedLogoUrl !== logoUrl)
  const toneClass =
    vendor.vendorStatus === 'SUSPENDED'
      ? 'border-danger/25 text-danger'
      : vendorNeedsAttention(vendor)
        ? 'border-warning/25 text-warning'
        : 'border-success/25 text-success'
  const markClassName = cn(
    'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-surface text-xs font-semibold',
    toneClass,
    onOpen && canShowLogo
      ? 'transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      : null,
  )
  const content =
    canShowLogo && logoUrl ? (
      <img
        alt={`${vendor.shopName} logo`}
        className="size-full object-contain p-1"
        loading="lazy"
        src={logoUrl}
        onError={() => setFailedLogoUrl(logoUrl)}
      />
    ) : (
      getVendorInitials(vendor.shopName)
    )

  if (onOpen && canShowLogo) {
    return (
      <button
        aria-label={`View ${vendor.shopName} logo`}
        className={markClassName}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onOpen()
        }}
      >
        {content}
      </button>
    )
  }

  return <div className={markClassName}>{content}</div>
}

function VendorRow({
  isPreviewed,
  isSelected,
  isSubmitting,
  onOpenAction,
  onOpenDetails,
  onOpenLogo,
  onPreview,
  onSelect,
  vendor,
  visibleColumns,
}: {
  isPreviewed: boolean
  isSelected: boolean
  isSubmitting: boolean
  onOpenAction: (vendor: VendorTableRow, kind: VendorListActionKind) => void
  onOpenDetails: (vendor: VendorTableRow) => void
  onOpenLogo: (vendor: VendorTableRow) => void
  onPreview: (vendor: VendorTableRow) => void
  onSelect: (vendor: VendorTableRow, selected: boolean) => void
  vendor: VendorTableRow
  visibleColumns: VendorColumnId[]
}) {
  const primaryAction = getVendorRowPrimaryAction(vendor)
  const visibleActions = getVisibleVendorActions(getVendorActionSource(vendor))
  const approvalBlockMessage = getApprovalBlockMessage(vendor)
  const showColumn = (columnId: VendorColumnId) => visibleColumns.includes(columnId)
  const warningCount =
    vendor.warnings.length + (vendor.bankAccountSummary?.warnings.length ?? 0)
  const overflowActions = buildVendorRowOverflowActions({
    primaryAction,
    visibleActions,
  })
  const primaryActionDisabled =
    isSubmitting ||
    (primaryAction.mode === 'action' &&
      primaryAction.kind === 'APPROVE' &&
      Boolean(approvalBlockMessage))

  const runPrimaryAction = () => {
    if (primaryAction.mode === 'action') {
      onOpenAction(vendor, primaryAction.kind)
      return
    }

    onOpenDetails(vendor)
  }

  return (
    <article
      aria-label={`Preview ${vendor.shopName}`}
      aria-selected={isPreviewed || isSelected}
      className={cn(
        'workbench-grid-row grid min-w-0 cursor-pointer gap-2 border-b border-border bg-surface px-3 py-2 transition last:border-b-0 hover:bg-surface-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset xl:grid-cols-[var(--vendor-grid-template)] xl:items-center',
        isPreviewed && 'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
        isSelected && 'bg-primary/5 hover:bg-primary/10',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onPreview(vendor)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPreview(vendor)
        }
      }}
    >
      <div className="flex min-w-0 items-start xl:items-center">
        <ListSelectionCheckbox
          checked={isSelected}
          label={`Select ${vendor.shopName}`}
          onChange={(selected) => onSelect(vendor, selected)}
        />
      </div>
      {showColumn('vendor') ? (
        <div className="flex min-w-0 items-start gap-2.5">
          <VendorLogoMark
            vendor={vendor}
            onOpen={
              buildVendorListLogoMediaItem(vendor)
                ? () => onOpenLogo(vendor)
                : undefined
            }
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                {vendor.shopName}
              </p>
              <span className="shrink-0">
                <Badge tone={getVendorStatusTone(vendor.vendorStatus)}>
                  {vendor.vendorStatus}
                </Badge>
              </span>
              {warningCount > 0 ? (
                <span
                  className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-warning/10 px-1.5 text-xs font-semibold text-warning"
                  title={[...vendor.warnings, ...(vendor.bankAccountSummary?.warnings ?? [])]
                    .map(humanizeCode)
                    .join(', ')}
                >
                  <FileCheck2 className="size-3" />
                  {warningCount}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-x-1.5 overflow-hidden text-xs text-muted">
              <span className="shrink-0">{vendor.publicVendorId}</span>
              <span className="shrink-0 text-border">/</span>
              <span className="min-w-0 truncate">
                {vendor.ownerName ?? vendor.mobileNumber}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {showColumn('category') ? (
        <div className="space-y-0.5 text-sm">
          <p className="truncate text-foreground">
            {vendor.category?.name ?? 'Unassigned'}
          </p>
          <p className="truncate text-xs text-muted">
            {[vendor.address.city || null, vendor.address.zone?.zoneName ?? null]
              .filter(Boolean)
              .join(' / ') || 'No location'}
          </p>
        </div>
      ) : null}

      {showColumn('city') ? (
        <div className="space-y-0.5 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <MapPin className="size-3.5 text-muted" />
            <span className="truncate">{vendor.address.city || 'No city'}</span>
          </div>
          <p className="truncate pl-5 text-xs text-muted">
            {vendor.address.zone?.zoneName ?? 'No zone'}
          </p>
        </div>
      ) : null}

      {showColumn('vendorStatus') ? (
        <div className="space-y-0.5 text-sm">
          <Badge tone={getVendorStatusTone(vendor.vendorStatus)}>
            {vendor.vendorStatus}
          </Badge>
        </div>
      ) : null}

      {showColumn('onboarding') ? (
        <div className="space-y-0.5 text-sm">
          <Badge tone={getOnboardingStatusTone(vendor.onboardingStatus)}>
            {vendor.onboardingStatus}
          </Badge>
        </div>
      ) : null}

      {showColumn('payout') ? (
        <div className="space-y-0.5 text-sm">
          <Badge tone={getPayoutAccountTone(vendor)}>
            {getPayoutAccountLabel(vendor)}
          </Badge>
          <p className="truncate text-xs text-muted">
            {getPayoutAccountMeta(vendor)}
          </p>
        </div>
      ) : null}

      {showColumn('documents') ? (
        <div className="space-y-0.5 text-sm">
          <Badge tone={getDocumentSummaryTone(vendor)}>
            {getDocumentSummaryLabel(vendor)}
          </Badge>
          <p className="text-xs text-muted">
            {(vendor.documentSummary?.pending ?? 0) +
              (vendor.documentSummary?.rejected ?? 0)}{' '}
            pending/rejected
          </p>
        </div>
      ) : null}

      {showColumn('updatedAt') ? (
        <div className="text-sm">
          <p className="truncate text-foreground">
            {formatDateSafe(vendor.updatedAt)}
          </p>
          <p className="mt-0.5 text-xs text-muted">Updated</p>
        </div>
      ) : null}

      <div className="workbench-sticky-action-cell flex flex-nowrap items-center gap-1.5 pl-2 xl:justify-end">
        <Button
          className="h-8 min-h-8 min-w-[4.5rem] whitespace-nowrap px-2.5"
          disabled={primaryActionDisabled}
          size="sm"
          title={
            primaryAction.mode === 'action' && primaryAction.kind === 'APPROVE'
              ? approvalBlockMessage ?? primaryAction.title
              : primaryAction.title
          }
          type="button"
          variant={primaryAction.variant}
          onClick={(event) => {
            event.stopPropagation()
            runPrimaryAction()
          }}
        >
          {primaryAction.mode === 'action' && primaryAction.kind === 'APPROVE' ? (
            <CheckCircle2 className="mr-1.5 size-3.5" />
          ) : primaryAction.mode === 'action' &&
            primaryAction.kind === 'REACTIVATE' ? (
            <RotateCcw className="mr-1.5 size-3.5" />
          ) : (
            <Eye className="mr-1.5 size-3.5" />
          )}
          {primaryAction.label}
        </Button>
        <button
          aria-label={`Add note for ${vendor.shopName}`}
          className="btn-icon size-8 min-h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          title="Add note"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpenAction(vendor, 'ADD_NOTE')
          }}
        >
          <MessageSquarePlus className="size-3.5" />
        </button>
        <VendorRowActionMenu
          actions={overflowActions}
          disabled={isSubmitting}
          vendorName={vendor.shopName}
          onSelect={(kind) => onOpenAction(vendor, kind)}
        />
      </div>
    </article>
  )
}

interface VendorQueueCounts {
  active: number
  onboarding: number
  underReview: number
  documentsPending: number
  rejected: number
  suspended: number
}

function buildStableQueueItems(counts?: VendorQueueCounts) {
  return [
    {
      key: 'active' as const,
      label: 'Active',
      count: counts?.active,
    },
    {
      key: 'onboarding' as const,
      label: 'Onboarding',
      count: counts?.onboarding,
    },
    {
      key: 'underReview' as const,
      label: 'Under review',
      count: counts?.underReview,
    },
    {
      key: 'documentsPending' as const,
      label: 'Documents pending',
      count: counts?.documentsPending,
    },
    {
      key: 'rejected' as const,
      label: 'Rejected',
      count: counts?.rejected,
    },
    {
      key: 'suspended' as const,
      label: 'Suspended',
      count: counts?.suspended,
    },
  ]
}

export function VendorsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { openMediaViewer } = useMediaViewer()
  const seededCategories = readLookupOptionsFromSearchParams(
    searchParams,
    'categoryId',
    'categoryLabel',
  )
  const [viewMode, setViewMode] = useState<VendorViewMode>('active')
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [categoryId, setCategoryId] = useState(() => seededCategories[0]?.value ?? '')
  const [categoryLookupLabel, setCategoryLookupLabel] = useState(
    () => seededCategories[0]?.label ?? '',
  )
  const [onboardingStatus, setOnboardingStatus] = useState<
    '' | VendorOnboardingStatus
  >('')
  const [vendorStatus, setVendorStatus] = useState<'' | VendorStatus>('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<VendorActionTarget | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [previewVendorId, setPreviewVendorId] = useState<string | null>(null)
  const [visibleColumns, setVisibleColumns] =
    useState<VendorColumnId[]>(defaultVendorColumns)
  const [columnWidths, setColumnWidths] =
    useState<VendorColumnWidths>(loadVendorColumnWidths)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        VENDOR_COLUMN_WIDTH_STORAGE_KEY,
        JSON.stringify(columnWidths),
      )
    } catch {
      // Width persistence is optional; the table still works without storage.
    }
  }, [columnWidths])

  useEffect(() => {
    if (!columnsOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && columnsMenuRef.current?.contains(target)) {
        return
      }

      setColumnsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setColumnsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [columnsOpen])

  const startColumnResize = (
    columnId: VendorColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getVendorColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          getVendorColumnMinWidth(columnId),
          Math.round(nextWidth),
        ),
      }))
    }

    const stopResize = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', stopResize)
      document.removeEventListener('pointercancel', stopResize)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', stopResize)
    document.addEventListener('pointercancel', stopResize)
  }

  const resetColumnWidth = (columnId: VendorColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: getVendorColumnDefaultWidth(columnId),
    }))
  }

  const adjustColumnWidth = (columnId: VendorColumnWidthId, delta: number) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: Math.max(
        getVendorColumnMinWidth(columnId),
        getVendorColumnWidth(currentWidths, columnId) + delta,
      ),
    }))
  }

  const resetToFirstPage = () => setPage(1)

  const query = useMemo<VendorListQueryParams>(
    () => ({
      page,
      limit,
      ...getVendorQuery(viewMode, vendorStatus),
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryId.trim() || undefined,
      onboardingStatus: onboardingStatus || undefined,
    }),
    [
      categoryId,
      city,
      limit,
      onboardingStatus,
      page,
      search,
      vendorStatus,
      viewMode,
    ],
  )

  const queueCountBaseQuery = useMemo<VendorListQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryId.trim() || undefined,
    }),
    [categoryId, city, search],
  )

  const vendorQuery = useQuery({
    queryKey: ['vendors', viewMode, query],
    queryFn: () =>
      viewMode === 'onboarding'
        ? vendorService.getVendorOnboardingQueue(query)
        : vendorService.getVendorList(query),
  })
  const queueCountsQuery = useQuery({
    queryKey: ['vendors', 'queue-counts', queueCountBaseQuery],
    queryFn: async (): Promise<VendorQueueCounts> => {
      const [
        active,
        onboarding,
        underReview,
        documentsPending,
        rejected,
        suspended,
      ] = await Promise.all([
        vendorService.getVendorList({
          ...queueCountBaseQuery,
          vendorStatus: 'ACTIVE',
        }),
        vendorService.getVendorOnboardingQueue(queueCountBaseQuery),
        vendorService.getVendorOnboardingQueue({
          ...queueCountBaseQuery,
          onboardingStatus: 'UNDER_REVIEW',
        }),
        vendorService.getVendorOnboardingQueue({
          ...queueCountBaseQuery,
          onboardingStatus: 'DOCUMENTS_PENDING',
        }),
        vendorService.getVendorOnboardingQueue({
          ...queueCountBaseQuery,
          onboardingStatus: 'REJECTED',
        }),
        vendorService.getVendorList({
          ...queueCountBaseQuery,
          vendorStatus: 'SUSPENDED',
        }),
      ])

      return {
        active: active.pagination.totalItems,
        onboarding: onboarding.pagination.totalItems,
        underReview: underReview.pagination.totalItems,
        documentsPending: documentsPending.pagination.totalItems,
        rejected: rejected.pagination.totalItems,
        suspended: suspended.pagination.totalItems,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const vendors = vendorQuery.data?.data ?? []
  const tableVendors: VendorTableRow[] = vendors
  const pagination = vendorQuery.data?.pagination
  const previewVendor =
    tableVendors.find((vendor) => vendor.vendorId === previewVendorId) ?? null
  const vendorSelection = useListSelection(tableVendors, (vendor) => vendor.vendorId)
  const isInitialLoading = vendorQuery.isLoading && !vendorQuery.data
  const isRefreshing = vendorQuery.isFetching && Boolean(vendorQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing'
    : formatRefreshTime(vendorQuery.dataUpdatedAt)

  const queueItems = buildStableQueueItems(queueCountsQuery.data)

  const vendorGridStyle = useMemo<VendorGridStyle>(
    () => ({
      '--vendor-grid-template': getVendorGridTemplate(visibleColumns, columnWidths),
      '--vendor-grid-min-width': getVendorGridMinWidth(visibleColumns, columnWidths),
    }),
    [columnWidths, visibleColumns],
  )

  const hasQueueFilter = Boolean(
    viewMode !== 'active' ||
      onboardingStatus ||
      (vendorStatus && vendorStatus !== 'ACTIVE'),
  )
  const hasActiveFilters = Boolean(search || city || categoryId || hasQueueFilter)
  const hasAdvancedFilters = Boolean(city || categoryId || onboardingStatus)
  const showFilters = filtersOpen || hasAdvancedFilters

  const clearSeededVendorParams = () => {
    const seededKeys = [
      'categoryId',
      'categoryLabel',
      'city',
      'onboardingStatus',
      'search',
      'vendorStatus',
    ] as const

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const clearVendorFilters = () => {
    clearSeededVendorParams()
    setViewMode('active')
    setSearch('')
    setCity('')
    setCategoryId('')
    setCategoryLookupLabel('')
    setOnboardingStatus('')
    setVendorStatus('')
    setFiltersOpen(false)
    setPage(1)
  }

  const applyQueue = (queue: VendorQueueKey) => {
    clearSeededVendorParams()

    if (queue === 'active') {
      setViewMode('active')
      setVendorStatus('ACTIVE')
      setOnboardingStatus('')
    }

    if (queue === 'onboarding') {
      setViewMode('onboarding')
      setVendorStatus('')
      setOnboardingStatus('')
    }

    if (queue === 'underReview') {
      setViewMode('onboarding')
      setVendorStatus('')
      setOnboardingStatus('UNDER_REVIEW')
    }

    if (queue === 'documentsPending') {
      setViewMode('onboarding')
      setVendorStatus('')
      setOnboardingStatus('DOCUMENTS_PENDING')
    }

    if (queue === 'rejected') {
      setViewMode('onboarding')
      setVendorStatus('')
      setOnboardingStatus('REJECTED')
    }

    if (queue === 'suspended') {
      setViewMode('active')
      setVendorStatus('SUSPENDED')
      setOnboardingStatus('')
    }

    setPage(1)
  }

  const isQueueActive = (queue: VendorQueueKey) => {
    if (queue === 'active') {
      return viewMode === 'active' && (vendorStatus === '' || vendorStatus === 'ACTIVE')
    }

    if (queue === 'onboarding') {
      return viewMode === 'onboarding' && !onboardingStatus && !vendorStatus
    }

    if (queue === 'underReview') {
      return viewMode === 'onboarding' && onboardingStatus === 'UNDER_REVIEW'
    }

    if (queue === 'documentsPending') {
      return viewMode === 'onboarding' && onboardingStatus === 'DOCUMENTS_PENDING'
    }

    if (queue === 'rejected') {
      return viewMode === 'onboarding' && onboardingStatus === 'REJECTED'
    }

    return vendorStatus === 'SUSPENDED'
  }

  const activeQueue = queueItems.find((queue) => isQueueActive(queue.key))
  const activeFilterChips: ActiveFilterChip[] = []

  if (search.trim()) {
    activeFilterChips.push({
      key: 'search',
      label: `Search: ${search.trim()}`,
      onClear: () => {
        clearSeededVendorParams()
        setSearch('')
        setPage(1)
      },
    })
  }

  if (activeQueue && activeQueue.key !== 'active') {
    activeFilterChips.push({
      key: `queue-${activeQueue.key}`,
      label: `Queue: ${activeQueue.label}`,
      onClear: () => {
        setViewMode('active')
        setVendorStatus('')
        setOnboardingStatus('')
        setPage(1)
      },
    })
  } else if (vendorStatus && vendorStatus !== 'ACTIVE') {
    activeFilterChips.push({
      key: 'vendorStatus',
      label: `Vendor status: ${vendorStatus}`,
      onClear: () => {
        setVendorStatus('')
        setPage(1)
      },
    })
  }

  if (city.trim()) {
    activeFilterChips.push({
      key: 'city',
      label: `City: ${city.trim()}`,
      onClear: () => {
        clearSeededVendorParams()
        setCity('')
        setPage(1)
      },
    })
  }

  if (categoryId.trim()) {
    activeFilterChips.push({
      key: 'category',
      label: `Category: ${categoryLookupLabel || categoryId}`,
      onClear: () => {
        clearSeededVendorParams()
        setCategoryId('')
        setCategoryLookupLabel('')
        setPage(1)
      },
    })
  }

  if (onboardingStatus && (!activeQueue || activeQueue.key === 'active')) {
    activeFilterChips.push({
      key: 'onboardingStatus',
      label: `Onboarding: ${onboardingStatus}`,
      onClear: () => {
        setOnboardingStatus('')
        setPage(1)
      },
    })
  }

  const toggleColumn = (columnId: VendorColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return currentColumns

        return currentColumns.filter((currentColumn) => currentColumn !== columnId)
      }

      return [...currentColumns, columnId]
    })
  }

  const viewDetails = (vendor: VendorTableRow) => {
    navigate(`${routePaths.vendors}/${vendor.vendorId}`)
  }

  const viewVendorLogo = (vendor: VendorTableRow) => {
    const logoMediaItem = buildVendorListLogoMediaItem(vendor)

    if (logoMediaItem) {
      openMediaViewer({ items: [logoMediaItem] })
    }
  }

  const openAction = (vendor: VendorTableRow, kind: VendorListActionKind) => {
    setActionError(null)
    setActionTarget({ action: { kind }, vendor })
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      target,
      values,
    }: {
      target: VendorActionTarget
      values: VendorActionFormValues
    }) => {
      const { action, vendor } = target

      if (action.kind === 'APPROVE') {
        const approvalBlockMessage = getApprovalBlockMessage(vendor)

        if (approvalBlockMessage) {
          throw new Error(approvalBlockMessage)
        }

        return vendorService.approveVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REJECT') {
        if (!values.reason) throw new Error('Rejection reason is required.')

        return vendorService.rejectVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REQUEST_DOCUMENTS') {
        if (!values.reason) throw new Error('Document request reason is required.')

        return vendorService.requestVendorDocuments(vendor.vendorId, {
          reason: values.reason,
          requestedDocumentTypes: values.requestedDocumentTypes,
        })
      }

      if (action.kind === 'SUSPEND') {
        if (!values.reason) throw new Error('Suspension reason is required.')

        return vendorService.suspendVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REACTIVATE') {
        if (!values.reason) throw new Error('Reactivation reason is required.')

        return vendorService.reactivateVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) throw new Error('Internal note is required.')

        return vendorService.addVendorNote(vendor.vendorId, {
          note: values.note,
        })
      }

      throw new Error('Unsupported vendor action from list view.')
    },
    onMutate: () => setActionError(null),
    onSuccess: (_data, variables) => {
      setActionTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['vendors'] })
      void queryClient.invalidateQueries({
        queryKey: ['vendor-detail', variables.target.vendor.vendorId],
      })
      void queryClient.invalidateQueries({ queryKey: ['vendor-onboarding'] })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Vendor action failed.',
      )
    },
  })

  const submitAction = (values: VendorActionFormValues) => {
    if (!actionTarget) return

    void actionMutation.mutateAsync({
      target: actionTarget,
      values,
    })
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        layout="workspace"
        placement="topbar"
        title="Vendors"
      />

      <main className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1">
        <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(10rem,auto)_minmax(22rem,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Vendors</h2>
              <span
                className={cn(
                  'rounded-full border border-border bg-surface-muted/65 px-2 py-0.5 text-xs font-medium',
                  isRefreshing ? 'text-primary' : 'text-muted',
                )}
              >
                {refreshStatusLabel}
              </span>
            </div>

            <ListHeaderSearch
              className="w-full min-w-0"
              placeholder="Search vendors..."
              value={search}
              onChange={(nextSearch) => {
                clearSeededVendorParams()
                setSearch(nextSearch)
                resetToFirstPage()
              }}
            />

            <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
              <Button
                aria-expanded={showFilters}
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <Filter className="mr-2 size-4" />
                Filters
                {activeFilterChips.length ? (
                  <span className="ml-1 size-2 rounded-full bg-primary" />
                ) : null}
              </Button>
              <div className="relative" ref={columnsMenuRef}>
                <Button
                  aria-expanded={columnsOpen}
                  aria-haspopup="menu"
                  className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setColumnsOpen((current) => !current)}
                >
                  <SlidersHorizontal className="mr-2 size-4" />
                  Columns
                  {visibleColumns.length ? (
                    <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                      {visibleColumns.length}
                    </span>
                  ) : null}
                </Button>

                {columnsOpen ? (
                  <div
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-60 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
                    role="menu"
                  >
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-normal text-muted">
                      Visible columns
                    </p>
                    {vendorDataColumns.map((column) => {
                      const isChecked = visibleColumns.includes(column.id)
                      const isRequiredLastColumn =
                        isChecked && visibleColumns.length === 1

                      return (
                        <label
                          className={cn(
                            'flex min-h-9 cursor-pointer items-center gap-2 rounded-[0.65rem] px-2 text-sm text-foreground hover:bg-surface-muted',
                            isRequiredLastColumn && 'cursor-not-allowed opacity-60',
                          )}
                          key={column.id}
                        >
                          <input
                            checked={isChecked}
                            className="size-4 accent-[color:var(--adaptive-primary)]"
                            disabled={isRequiredLastColumn}
                            type="checkbox"
                            onChange={() => toggleColumn(column.id)}
                          />
                          <span>{column.label}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : null}
              </div>
              <Button
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => void vendorQuery.refetch()}
              >
                <RefreshCcw
                  className={cn(
                    'mr-2 size-4',
                    isRefreshing && 'animate-spin motion-reduce:animate-none',
                  )}
                />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto rounded-[0.875rem] border border-border bg-surface-muted/40 p-1">
            {queueItems.map((queue) => {
              const isActive = isQueueActive(queue.key)

              return (
                <button
                  aria-pressed={isActive}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-2 rounded-[0.65rem] border px-2.5 text-sm font-medium transition',
                    isActive
                      ? 'border-primary/30 bg-surface text-primary shadow-[var(--sg-shadow-surface)]'
                      : 'border-transparent text-muted hover:bg-surface hover:text-foreground',
                  )}
                  key={queue.key}
                  type="button"
                  onClick={() => applyQueue(queue.key)}
                >
                  <span>{queue.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface text-muted',
                    )}
                  >
                    {queue.count ?? '...'}
                  </span>
                </button>
              )
            })}
          </div>

          <ActiveFilterChips
            chips={activeFilterChips}
            onClearAll={clearVendorFilters}
          />

          {showFilters ? (
            <div className="mt-2 rounded-[0.75rem] border border-border bg-surface-muted/45 p-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(13rem,1fr)_minmax(11rem,0.8fr)_minmax(10rem,0.8fr)_auto] lg:items-end">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">City</span>
                  <Input
                    className={VENDOR_FILTER_CONTROL_CLASS_NAME}
                    placeholder="Chennai"
                    value={city}
                    onChange={(event) => {
                      clearSeededVendorParams()
                      setCity(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>
                <LookupSelect
                  fetchOptions={searchCategoryLookupOptions}
                  label="Category"
                  placeholder="Search category"
                  queryKey={['lookup', 'categories']}
                  selectedLabel={categoryLookupLabel}
                  value={categoryId}
                  onChange={(value, option) => {
                    clearSeededVendorParams()
                    setCategoryId(value)
                    setCategoryLookupLabel(option?.label ?? '')
                    resetToFirstPage()
                  }}
                />
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Onboarding
                  </span>
                  <select
                    className={VENDOR_FILTER_CONTROL_CLASS_NAME}
                    value={onboardingStatus}
                    onChange={(event) => {
                      clearSeededVendorParams()
                      setOnboardingStatus(
                        event.target.value as '' | VendorOnboardingStatus,
                      )
                      resetToFirstPage()
                    }}
                  >
                    <option value="">All</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="DOCUMENTS_PENDING">DOCUMENTS_PENDING</option>
                    <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Vendor status
                  </span>
                  <select
                    className={VENDOR_FILTER_CONTROL_CLASS_NAME}
                    value={vendorStatus}
                    onChange={(event) => {
                      clearSeededVendorParams()
                      setVendorStatus(event.target.value as '' | VendorStatus)
                      resetToFirstPage()
                    }}
                  >
                    <option value="">Default</option>
                    <option value="PENDING">PENDING</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </label>
                <Button
                  className="w-full lg:w-auto"
                  disabled={!hasActiveFilters}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={clearVendorFilters}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {vendorQuery.isError ? (
          <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <ErrorState
              description="Retry the vendor list."
              title="Vendor data unavailable"
              onRetry={() => void vendorQuery.refetch()}
            />
          </div>
        ) : isInitialLoading ? (
          <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <VendorRowsSkeleton />
          </div>
        ) : tableVendors.length === 0 ? (
          <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <EmptyState
              actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
              description={
                hasActiveFilters
                  ? 'No matches.'
                  : viewMode === 'active'
                    ? 'No active vendors.'
                    : 'Queue is empty.'
              }
              title="No vendors"
              onAction={hasActiveFilters ? clearVendorFilters : undefined}
            />
          </div>
        ) : (
          <div
            className={cn(
              'grid xl:min-h-0 xl:flex-1',
              previewVendor &&
                'xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-3 xl:p-3',
            )}
          >
            <div className="flex min-w-0 flex-col xl:min-h-0">
              <div className="overflow-x-auto overscroll-contain xl:min-h-0 xl:flex-1 xl:overflow-auto">
                <div
                  className="min-w-0 xl:min-w-[var(--vendor-grid-min-width)]"
                  style={vendorGridStyle}
                >
                  <div className="sticky top-0 z-30 hidden gap-2 grid-cols-[var(--vendor-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted shadow-[0_1px_0_var(--adaptive-border)] xl:grid">
                    <div className="flex min-w-0 items-center">
                      <ListSelectionCheckbox
                        checked={vendorSelection.allVisibleSelected}
                        indeterminate={vendorSelection.someVisibleSelected}
                        label="Select visible vendors"
                        onChange={vendorSelection.setVisibleSelected}
                      />
                    </div>
                    {vendorDataColumns
                      .filter((column) => visibleColumns.includes(column.id))
                      .map((column) => (
                        <div
                          className="relative flex min-w-0 items-center pr-3"
                          key={column.id}
                        >
                          <span className="truncate">{column.label}</span>
                          <button
                            aria-label={`Resize ${column.label} column`}
                            className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Drag to resize"
                            type="button"
                            onDoubleClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              resetColumnWidth(column.id)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'ArrowLeft') {
                                event.preventDefault()
                                adjustColumnWidth(column.id, -16)
                              }

                              if (event.key === 'ArrowRight') {
                                event.preventDefault()
                                adjustColumnWidth(column.id, 16)
                              }
                            }}
                            onPointerDown={(event) =>
                              startColumnResize(column.id, event)
                            }
                          >
                            <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                          </button>
                        </div>
                      ))}
                    <div className="workbench-sticky-action-head relative flex min-w-0 pr-3">
                      <span className="truncate">Actions</span>
                      <button
                        aria-label="Resize actions column"
                        className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Drag to resize"
                        type="button"
                        onDoubleClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          resetColumnWidth(VENDOR_ACTION_COLUMN_ID)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowLeft') {
                            event.preventDefault()
                            adjustColumnWidth(VENDOR_ACTION_COLUMN_ID, -16)
                          }

                          if (event.key === 'ArrowRight') {
                            event.preventDefault()
                            adjustColumnWidth(VENDOR_ACTION_COLUMN_ID, 16)
                          }
                        }}
                        onPointerDown={(event) =>
                          startColumnResize(VENDOR_ACTION_COLUMN_ID, event)
                        }
                      >
                        <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                      </button>
                    </div>
                  </div>
                  <ListSelectionToolbar
                    allVisibleSelected={vendorSelection.allVisibleSelected}
                    selectedCount={vendorSelection.selectedCount}
                    visibleCount={vendorSelection.visibleCount}
                    onClear={vendorSelection.clearSelection}
                    onSelectVisible={() => vendorSelection.setVisibleSelected(true)}
                  />

                  <div>
                    {tableVendors.map((vendor) => (
                      <VendorRow
                        isPreviewed={previewVendorId === vendor.vendorId}
                        isSelected={vendorSelection.isSelected(vendor.vendorId)}
                        isSubmitting={actionMutation.isPending}
                        key={vendor.vendorId}
                        vendor={vendor}
                        visibleColumns={visibleColumns}
                        onOpenDetails={viewDetails}
                        onOpenAction={openAction}
                        onOpenLogo={viewVendorLogo}
                        onPreview={(previewedVendor) =>
                          setPreviewVendorId(previewedVendor.vendorId)
                        }
                        onSelect={(selectedVendor, selected) =>
                          vendorSelection.setItemSelected(
                            selectedVendor.vendorId,
                            selected,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>

              <VendorPagination
                pagination={pagination}
                onPageChange={setPage}
                onPageSizeChange={(nextLimit) => {
                  setLimit(nextLimit)
                  setPage(1)
                }}
              />
            </div>

            {previewVendor ? (
              <VendorPreviewPanel
                isSubmitting={actionMutation.isPending}
                vendor={previewVendor}
                onClose={() => setPreviewVendorId(null)}
                onOpenAction={openAction}
                onOpenDetails={viewDetails}
              />
            ) : null}
          </div>
        )}
      </main>

      {actionTarget ? (
        <VendorActionModal
          action={actionTarget.action}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          vendor={actionTarget.vendor}
          onClose={() => {
            if (!actionMutation.isPending) {
              setActionTarget(null)
              setActionError(null)
            }
          }}
          onSubmit={submitAction}
        />
      ) : null}
    </PageContainer>
  )
}
