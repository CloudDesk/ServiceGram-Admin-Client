import {
  Activity,
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Edit3,
  Home,
  Mail,
  MapPin,
  MessageSquarePlus,
  Phone,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DynamicTable, type DynamicTableColumn } from '../../../components/ui/Table'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { featureFlags } from '../../../config/featureFlags'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { customerService } from '../services/customer.service'
import {
  CustomerActionModal,
  type CustomerActionFormValues,
  type CustomerActionKind,
  type CustomerActionSelection,
} from './CustomerActionModal'
import { CustomerProfileEditModal } from './CustomerProfileEditModal'
import type {
  AdminCustomerAddress,
  AdminCustomerDetail,
  AdminCustomerNote,
  AdminCustomerRecentOrder,
  AdminCustomerWalletCredit,
  CustomerProfileUpdatePayload,
} from '../types/customer.types'

const addressColumns: DynamicTableColumn<AdminCustomerAddress>[] = [
  {
    key: 'label',
    label: 'Address',
    minWidth: 260,
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.label ?? 'Address'}</p>
        <p className="text-xs text-muted">
          {row.addressLine1}
          {row.addressLine2 ? `, ${row.addressLine2}` : ''}
        </p>
      </div>
    ),
  },
  {
    key: 'contactName',
    label: 'Contact',
    minWidth: 180,
    renderCell: (row) => (
      <div>
        <p>{row.contactName}</p>
        <p className="text-xs text-muted">{row.contactMobile}</p>
      </div>
    ),
  },
  {
    key: 'city',
    label: 'City',
    minWidth: 180,
    renderCell: (row) => (
      <div>
        <p>{row.city}</p>
        <p className="text-xs text-muted">{row.zone?.zoneName ?? 'No zone'}</p>
      </div>
    ),
  },
  {
    key: 'isDefault',
    label: 'Default',
    format: 'status',
    minWidth: 120,
    getValue: (row) => (row.isDefault ? 'YES' : 'NO'),
  },
]

const recentOrderColumns: DynamicTableColumn<AdminCustomerRecentOrder>[] = [
  {
    key: 'publicOrderId',
    label: 'Order',
    minWidth: 180,
  },
  {
    key: 'vendor',
    label: 'Vendor',
    minWidth: 220,
    getValue: (row) => row.vendor.shopName,
    renderCell: (row) => (
      <div>
        <p>{row.vendor.shopName}</p>
        <p className="text-xs text-muted">{row.vendor.publicVendorId}</p>
      </div>
    ),
  },
  {
    key: 'orderStatus',
    label: 'Order Status',
    format: 'status',
    minWidth: 160,
  },
  {
    key: 'paymentStatus',
    label: 'Payment',
    format: 'status',
    minWidth: 150,
    placeholder: 'Not available',
  },
  {
    key: 'finalPricePaise',
    label: 'Final Price',
    minWidth: 160,
    renderCell: (row) => (
      <span>
        {row.finalPricePaise
          ? formatMoney(row.finalPricePaise / 100)
          : row.priceEstimatePaise
            ? formatMoney(row.priceEstimatePaise / 100)
            : 'Not available'}
      </span>
    ),
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

const noteColumns: DynamicTableColumn<AdminCustomerNote>[] = [
  {
    key: 'note',
    label: 'Note',
    minWidth: 320,
  },
  {
    key: 'adminId',
    label: 'Admin ID',
    minWidth: 220,
    placeholder: 'System',
  },
  {
    key: 'createdAt',
    label: 'Created',
    format: 'date',
    minWidth: 180,
  },
]

const walletCreditColumns: DynamicTableColumn<AdminCustomerWalletCredit>[] = [
  {
    key: 'amountPaise',
    label: 'Amount',
    minWidth: 160,
    renderCell: (row) => (
      <span>{formatMoney(row.amountPaise / 100, row.currency)}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    format: 'status',
    minWidth: 150,
  },
  {
    key: 'reason',
    label: 'Reason',
    minWidth: 260,
  },
  {
    key: 'createdAt',
    label: 'Created',
    format: 'date',
    minWidth: 180,
  },
]

type CustomerTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

function toneClasses(tone: CustomerTone) {
  if (tone === 'success') return 'border-border bg-surface text-success'
  if (tone === 'warning') return 'border-border bg-surface text-warning'
  if (tone === 'danger') return 'border-border bg-surface text-danger'
  if (tone === 'info') return 'border-border bg-surface text-primary'
  return 'border-border bg-surface text-muted'
}

function statusTone(status: AdminCustomerDetail['status']) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'BLOCKED') return 'danger'
  return 'warning'
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Review customer'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function signalLabel(warning: string) {
  const labels: Record<string, string> = {
    CUSTOMER_BLOCKED: 'Customer blocked',
    HAS_ACTIVE_ORDERS: 'Active orders',
    HAS_WALLET_CREDIT: 'Wallet credit',
    PROFILE_INCOMPLETE: 'Profile incomplete',
    ZONE_MISSING: 'Zone missing',
  }

  return labels[warning] ?? humanizeCode(warning)
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'
  return formatDate(value, true)
}

function formatPaise(value: number, currency = 'INR') {
  return formatMoney(value / 100, currency)
}

function isWalletAction(action: string | null | undefined) {
  return action?.toUpperCase() === 'WALLET_CREDIT'
}

function visibleWarnings(warnings: string[]) {
  return featureFlags.customerWallet
    ? warnings
    : warnings.filter((warning) => warning !== 'HAS_WALLET_CREDIT')
}

function visibleRecommendedAction(customer: AdminCustomerDetail) {
  if (!featureFlags.customerWallet && isWalletAction(customer.nextRecommendedAction)) {
    return null
  }

  return customer.nextRecommendedAction
}

function visibleAvailableActions(actions: string[]) {
  return featureFlags.customerWallet
    ? actions
    : actions.filter((action) => action !== 'WALLET_CREDIT')
}

function customerNeedsAttention(customer: AdminCustomerDetail) {
  return (
    customer.status !== 'ACTIVE' ||
    visibleWarnings(customer.warnings).length > 0 ||
    Boolean(visibleRecommendedAction(customer))
  )
}

function customerHealth(customer: AdminCustomerDetail) {
  let score = 100

  if (customer.status === 'BLOCKED') score -= 55
  if (customer.status === 'INCOMPLETE') score -= 25
  if (!customer.zone) score -= 12
  if (customer.orderSummary.activeOrders > 0) score -= 8
  if (featureFlags.customerWallet && customer.walletSummary.creditBalancePaise > 0) score -= 5
  score -= Math.min(visibleWarnings(customer.warnings).length * 10, 30)

  return Math.max(18, Math.min(98, score))
}

function healthColor(score: number) {
  if (score >= 80) return 'bg-success'
  if (score >= 55) return 'bg-warning'
  return 'bg-danger'
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function DetailMetricCard({
  icon,
  label,
  meta,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  tone: CustomerTone
  value: string
}) {
  return (
    <div
      className={cn(
        'min-h-[4.35rem] rounded-[0.75rem] border p-2.5',
        toneClasses(tone),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal opacity-80">
            {label}
          </p>
          <p className="mt-1 truncate text-lg font-semibold tracking-normal">
            {value}
          </p>
        </div>
        <span className="mt-0.5 shrink-0 opacity-80">{icon}</span>
      </div>
      <p className="mt-0.5 truncate text-xs leading-4 opacity-80">{meta}</p>
    </div>
  )
}

function DetailPanel({
  children,
  className,
  description,
  icon,
  title,
}: {
  children: ReactNode
  className?: string
  description?: string
  icon?: ReactNode
  title: string
}) {
  return (
    <section
      className={cn(
        'rounded-[0.875rem] border border-border bg-surface p-3 shadow-surface',
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary">{icon}</span> : null}
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          </div>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function DetailField({
  icon,
  label,
  value,
}: {
  icon?: ReactNode
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="rounded-[0.75rem] border border-border bg-surface-muted/45 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted">
        {icon ? <span className="text-muted">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 break-words text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </p>
    </div>
  )
}

function CustomerHeaderStatus({ customer }: { customer: AdminCustomerDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={statusTone(customer.status)}>{customer.status}</Badge>
      <Badge tone="neutral">{customer.userStatus}</Badge>
      {customerNeedsAttention(customer) ? (
        <Badge tone="warning">Action needed</Badge>
      ) : (
        <Badge tone="success">Healthy</Badge>
      )}
    </div>
  )
}

function CustomerHeaderActions({
  canCreditWallet,
  canUpdateCustomer,
  customer,
  isSubmitting,
  onEditProfile,
  onSelectAction,
}: {
  canCreditWallet: boolean
  canUpdateCustomer: boolean
  customer: AdminCustomerDetail
  isSubmitting: boolean
  onEditProfile: () => void
  onSelectAction: (kind: CustomerActionKind) => void
}) {
  const availableActions = visibleAvailableActions(customer.availableActions)
  const hasAction = (action: string) => availableActions.includes(action)

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canUpdateCustomer && hasAction('EDIT_PROFILE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={onEditProfile}
        >
          <Edit3 className="mr-2 size-4" />
          Edit Profile
        </Button>
      ) : null}
      {canUpdateCustomer && hasAction('BLOCK') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="danger"
          onClick={() => onSelectAction('BLOCK')}
        >
          <Ban className="mr-2 size-4" />
          Block
        </Button>
      ) : null}
      {canUpdateCustomer && hasAction('UNBLOCK') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction('UNBLOCK')}
        >
          <ShieldCheck className="mr-2 size-4" />
          Unblock
        </Button>
      ) : null}
      {featureFlags.customerWallet && canCreditWallet && hasAction('WALLET_CREDIT') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction('WALLET_CREDIT')}
        >
          <Wallet className="mr-2 size-4" />
          Wallet Credit
        </Button>
      ) : null}
      {canUpdateCustomer && hasAction('ADD_NOTE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction('ADD_NOTE')}
        >
          <MessageSquarePlus className="mr-2 size-4" />
          Add Note
        </Button>
      ) : null}
    </div>
  )
}

function CustomerIdentityPanel({ customer }: { customer: AdminCustomerDetail }) {
  const health = customerHealth(customer)

  return (
    <DetailPanel
      className="lg:col-span-2"
      description="Primary profile, contact, and service coverage from backend data."
      icon={<UserRound className="size-4" />}
      title="Customer profile"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 items-start gap-3 rounded-[0.75rem] border border-border bg-surface-muted/45 p-3">
          <div
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-full border bg-surface text-base font-semibold',
              customer.status === 'BLOCKED'
                ? 'border-danger/25 text-danger'
                : customerNeedsAttention(customer)
                  ? 'border-warning/25 text-warning'
                  : 'border-success/25 text-success',
            )}
          >
            {getInitials(customer.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-foreground">
                {customer.fullName}
              </h2>
              <Badge tone={statusTone(customer.status)}>{customer.status}</Badge>
            </div>
            <p className="mt-1 break-words text-xs text-muted">
              {customer.customerId}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField
                icon={<Phone className="size-3.5" />}
                label="Mobile"
                value={customer.mobileNumber}
              />
              <DetailField
                icon={<Mail className="size-3.5" />}
                label="Email"
                value={customer.email}
              />
              <DetailField
                icon={<MapPin className="size-3.5" />}
                label="City"
                value={customer.city || customer.zone?.city}
              />
              <DetailField
                icon={<Home className="size-3.5" />}
                label="Zone"
                value={customer.zone?.zoneName}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[0.75rem] border border-border bg-surface-muted/45 p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold uppercase tracking-normal text-muted">
              Health
            </span>
            <span className="font-semibold text-foreground">{health}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-surface">
            <div
              className={cn('h-2 rounded-full', healthColor(health))}
              style={{ width: `${health}%` }}
            />
          </div>
          <div className="mt-3 grid gap-2 text-xs text-muted">
            <div className="flex items-center justify-between">
              <span>Active orders</span>
              <span className="font-semibold text-foreground">
                {customer.orderSummary.activeOrders}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Warning signals</span>
              <span className="font-semibold text-foreground">
                {visibleWarnings(customer.warnings).length}
              </span>
            </div>
            {featureFlags.customerWallet ? (
              <div className="flex items-center justify-between">
                <span>Wallet credit</span>
                <span className="font-semibold text-foreground">
                  {formatPaise(customer.walletSummary.creditBalancePaise)}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </DetailPanel>
  )
}

function CustomerActionRail({
  canCreditWallet,
  canUpdateCustomer,
  customer,
  isSubmitting,
  onEditProfile,
  onSelectAction,
}: {
  canCreditWallet: boolean
  canUpdateCustomer: boolean
  customer: AdminCustomerDetail
  isSubmitting: boolean
  onEditProfile: () => void
  onSelectAction: (kind: CustomerActionKind) => void
}) {
  const availableActions = visibleAvailableActions(customer.availableActions)
  const hasAction = (action: string) => availableActions.includes(action)
  const firstWarning = visibleWarnings(customer.warnings)[0]
  const nextRecommendedAction = visibleRecommendedAction(customer)
  const healthy = !firstWarning && customer.status === 'ACTIVE'

  return (
    <aside className="space-y-3 xl:sticky xl:top-3 xl:self-start">
      <DetailPanel
        description="Recommended action and safe controls for this customer."
        icon={<ShieldAlert className="size-4" />}
        title="Operations"
      >
        <div
          className={cn(
            'rounded-[0.75rem] border p-3',
            healthy
              ? 'border-success/25 bg-success/10 text-success'
              : 'border-warning/25 bg-warning/10 text-warning',
          )}
        >
          <div className="flex items-start gap-2">
            {healthy ? (
              <CheckCircle2 className="mt-0.5 size-4" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {nextRecommendedAction
                  ? humanizeCode(nextRecommendedAction)
                  : healthy
                    ? 'No active warning'
                    : signalLabel(firstWarning ?? '')}
              </p>
              <p className="mt-1 text-xs leading-5 opacity-80">
                {nextRecommendedAction
                  ? 'Recommended by the backend workflow state.'
                  : healthy
                    ? 'This customer has no warnings in the current response.'
                    : 'Review the customer record before taking support action.'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {canUpdateCustomer && hasAction('EDIT_PROFILE') ? (
            <Button
              className="w-full justify-start"
              disabled={isSubmitting}
              size="sm"
              variant="secondary"
              onClick={onEditProfile}
            >
              <Edit3 className="mr-2 size-4" />
              Edit profile
            </Button>
          ) : null}
          {canUpdateCustomer && hasAction('BLOCK') ? (
            <Button
              className="w-full justify-start"
              disabled={isSubmitting}
              size="sm"
              variant="danger"
              onClick={() => onSelectAction('BLOCK')}
            >
              <Ban className="mr-2 size-4" />
              Block customer
            </Button>
          ) : null}
          {canUpdateCustomer && hasAction('UNBLOCK') ? (
            <Button
              className="w-full justify-start"
              disabled={isSubmitting}
              size="sm"
              variant="secondary"
              onClick={() => onSelectAction('UNBLOCK')}
            >
              <ShieldCheck className="mr-2 size-4" />
              Unblock customer
            </Button>
          ) : null}
          {featureFlags.customerWallet && canCreditWallet && hasAction('WALLET_CREDIT') ? (
            <Button
              className="w-full justify-start"
              disabled={isSubmitting}
              size="sm"
              variant="secondary"
              onClick={() => onSelectAction('WALLET_CREDIT')}
            >
              <Wallet className="mr-2 size-4" />
              Wallet credit
            </Button>
          ) : null}
          {canUpdateCustomer && hasAction('ADD_NOTE') ? (
            <Button
              className="w-full justify-start"
              disabled={isSubmitting}
              size="sm"
              variant="secondary"
              onClick={() => onSelectAction('ADD_NOTE')}
            >
              <MessageSquarePlus className="mr-2 size-4" />
              Add note
            </Button>
          ) : null}
        </div>
      </DetailPanel>

      <DetailPanel icon={<Activity className="size-4" />} title="Activity trail">
        <div className="space-y-3 text-sm">
          <div className="flex gap-2">
            <ReceiptText className="mt-0.5 size-4 text-muted" />
            <p>
              <span className="font-medium text-foreground">Last order</span>
              <br />
              <span className="text-xs text-muted">
                {formatDateSafe(customer.orderSummary.lastOrderAt)}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <MessageSquarePlus className="mt-0.5 size-4 text-muted" />
            <p>
              <span className="font-medium text-foreground">Last note</span>
              <br />
              <span className="text-xs text-muted">
                {formatDateSafe(customer.noteSummary.lastNoteAt)}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Clock3 className="mt-0.5 size-4 text-muted" />
            <p>
              <span className="font-medium text-foreground">Last login</span>
              <br />
              <span className="text-xs text-muted">
                {formatDateSafe(customer.lastLoginAt)}
              </span>
            </p>
          </div>
        </div>
      </DetailPanel>
    </aside>
  )
}

function CustomerSignalsPanel({ customer }: { customer: AdminCustomerDetail }) {
  const warnings = visibleWarnings(customer.warnings)
  const availableActions = visibleAvailableActions(customer.availableActions)
  const nextRecommendedAction = visibleRecommendedAction(customer)

  return (
    <DetailPanel
      description="Backend warnings and operational metadata."
      icon={<ShieldAlert className="size-4" />}
      title="Signals"
    >
      {warnings.length ? (
        <div className="flex flex-wrap gap-2">
          {warnings.map((warning) => (
            <Badge key={warning} tone="warning">
              {signalLabel(warning)}
            </Badge>
          ))}
        </div>
      ) : (
        <div className="rounded-[0.75rem] border border-success/20 bg-success/10 p-3 text-sm text-success">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4" />
            <p className="font-medium">No warning signals in the current response.</p>
          </div>
        </div>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <DetailField
          label="Available actions"
          value={
            availableActions.length
              ? availableActions.map(humanizeCode).join(', ')
              : null
          }
        />
        <DetailField
          label="Next action"
          value={
            nextRecommendedAction ? humanizeCode(nextRecommendedAction) : null
          }
        />
        <DetailField label="User status" value={customer.userStatus} />
        {featureFlags.customerWallet ? (
          <DetailField
            label="Wallet provider"
            value={customer.walletSummary.providerStatus}
          />
        ) : null}
      </div>
    </DetailPanel>
  )
}

function TableToolbar({
  count,
  description,
  icon,
  title,
}: {
  count: number
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <Badge tone="neutral">{count}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>
    </div>
  )
}

export function CustomerDetailPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canCreditWallet = usePermission('customers:wallet_credit')
  const canUpdateCustomer = usePermission('customers:update')
  const [actionError, setActionError] = useState<string | null>(null)
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] = useState<CustomerActionSelection | null>(null)

  const customerQuery = useQuery({
    enabled: Boolean(customerId),
    queryKey: ['customer-detail', customerId],
    queryFn: () => customerService.getCustomerById(customerId as string),
  })

  const customer = customerQuery.data?.data

  const refreshCustomer = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] }),
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
    ])
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: CustomerActionSelection
      values: CustomerActionFormValues
    }) => {
      if (!customer) {
        throw new Error('Customer details are unavailable.')
      }

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) {
          throw new Error('Internal note is required.')
        }

        return customerService.addCustomerNote(customer.customerId, {
          note: values.note,
        })
      }

      if (action.kind === 'BLOCK') {
        if (!values.reason) {
          throw new Error('Block reason is required.')
        }

        return customerService.blockCustomer(customer.customerId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'UNBLOCK') {
        if (!values.reason) {
          throw new Error('Unblock reason is required.')
        }

        return customerService.unblockCustomer(customer.customerId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'WALLET_CREDIT') {
        if (!featureFlags.customerWallet) {
          throw new Error('Wallet credit is currently disabled.')
        }

        if (!values.reason) {
          throw new Error('Wallet credit reason is required.')
        }

        if (!values.amountPaise) {
          throw new Error('Wallet credit amount is required.')
        }

        return customerService.creditCustomerWallet(customer.customerId, {
          amountPaise: values.amountPaise,
          currency: values.currency,
          reason: values.reason,
          referenceId: values.referenceId,
        })
      }

      throw new Error('Unsupported customer action.')
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setSelectedAction(null)
      void refreshCustomer()
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Customer action failed.',
      )
    },
  })

  const profileMutation = useMutation({
    mutationFn: async (values: CustomerProfileUpdatePayload) => {
      if (!customer) {
        throw new Error('Customer details are unavailable.')
      }

      return customerService.updateCustomerProfile(customer.customerId, values)
    },
    onMutate: () => setProfileError(null),
    onSuccess: () => {
      setIsProfileEditorOpen(false)
      void refreshCustomer()
    },
    onError: (error) => {
      setProfileError(
        error instanceof Error ? error.message : 'Customer profile update failed.',
      )
    },
  })

  const isSubmitting = actionMutation.isPending || profileMutation.isPending

  const openProfileEditor = () => {
    setActionError(null)
    setProfileError(null)
    setIsProfileEditorOpen(true)
  }

  const openAction = (kind: CustomerActionKind) => {
    setActionError(null)
    setProfileError(null)
    setSelectedAction({ kind })
  }

  const submitAction = (values: CustomerActionFormValues) => {
    if (!selectedAction) {
      return
    }

    void actionMutation.mutateAsync({
      action: selectedAction,
      values,
    })
  }

  const submitProfileUpdate = (values: CustomerProfileUpdatePayload) => {
    void profileMutation.mutateAsync(values)
  }

  if (!customerId) {
    return (
      <PageContainer>
        <ErrorState
          description="The customer route is missing a customer id."
          title="Customer not found"
        />
      </PageContainer>
    )
  }

  if (customerQuery.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[28rem] w-full" />
      </PageContainer>
    )
  }

  if (customerQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load this customer. Please retry."
          title="Customer unavailable"
          onRetry={() => void customerQuery.refetch()}
        />
      </PageContainer>
    )
  }

  if (!customer) {
    return (
      <PageContainer>
        <EmptyState
          description="The customer detail API returned no customer data."
          title="Customer not found"
        />
      </PageContainer>
    )
  }

  const health = customerHealth(customer)

  return (
    <PageContainer className="!px-3 !py-4 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <CustomerHeaderActions
            canCreditWallet={canCreditWallet}
            canUpdateCustomer={canUpdateCustomer}
            customer={customer}
            isSubmitting={isSubmitting}
            onEditProfile={openProfileEditor}
            onSelectAction={openAction}
          />
        }
        description={customer.email ?? customer.mobileNumber ?? customer.userId}
        listHref={routePaths.customers}
        listLabel="Customers"
        recordName={customer.fullName}
        titleMetaNode={<CustomerHeaderStatus customer={customer} />}
      />

      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <DetailMetricCard
          icon={<Activity className="size-4" />}
          label="Health"
          meta={
            customerNeedsAttention(customer)
              ? 'Review warning signals'
              : 'No active warnings'
          }
          tone={health >= 80 ? 'success' : health >= 55 ? 'warning' : 'danger'}
          value={String(health)}
        />
        <DetailMetricCard
          icon={<ReceiptText className="size-4" />}
          label="Orders"
          meta={`${customer.orderSummary.activeOrders} active orders`}
          tone={customer.orderSummary.activeOrders ? 'warning' : 'neutral'}
          value={String(customer.orderSummary.totalOrders)}
        />
        {featureFlags.customerWallet ? (
          <DetailMetricCard
            icon={<CreditCard className="size-4" />}
            label="Wallet credit"
            meta={customer.walletSummary.providerStatus}
            tone={
              customer.walletSummary.creditBalancePaise > 0 ? 'info' : 'neutral'
            }
            value={formatPaise(customer.walletSummary.creditBalancePaise)}
          />
        ) : null}
        <DetailMetricCard
          icon={<MessageSquarePlus className="size-4" />}
          label="Notes"
          meta={`Last note: ${formatDateSafe(customer.noteSummary.lastNoteAt)}`}
          tone={customer.noteSummary.totalNotes ? 'info' : 'neutral'}
          value={String(customer.noteSummary.totalNotes)}
        />
      </section>

      <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <CustomerIdentityPanel customer={customer} />

          <div className="grid gap-3 lg:grid-cols-2">
            <DetailPanel
              icon={<CalendarClock className="size-4" />}
              title="Lifecycle"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Customer ID" value={customer.customerId} />
                <DetailField label="User ID" value={customer.userId} />
                <DetailField
                  label="Last login"
                  value={formatDateSafe(customer.lastLoginAt)}
                />
                <DetailField
                  label="Created"
                  value={formatDateSafe(customer.createdAt)}
                />
                <DetailField
                  label="Updated"
                  value={formatDateSafe(customer.updatedAt)}
                />
                <DetailField
                  label="Lifetime spend"
                  value={formatPaise(customer.orderSummary.lifetimeSpendPaise)}
                />
              </div>
            </DetailPanel>

            <CustomerSignalsPanel customer={customer} />
          </div>

          <DynamicTable
            bodyMaxHeight={280}
            columns={recentOrderColumns}
            data={customer.recentOrders}
            emptyDescription="No recent orders were returned for this customer."
            emptyTitle="No recent orders"
            getRowId={(row) => row.orderId}
            stickyHeader
            title="Recent orders"
            toolbar={
              <TableToolbar
                count={customer.recentOrders.length}
                description="Latest order activity. Select a row to inspect the order."
                icon={<ReceiptText className="size-4" />}
                title="Recent orders"
              />
            }
            onRowClick={(row) => navigate(`${routePaths.orders}/${row.orderId}`)}
          />

          <DynamicTable
            bodyMaxHeight={280}
            columns={addressColumns}
            data={customer.addresses}
            emptyDescription="No addresses were returned for this customer."
            emptyTitle="No addresses"
            getRowId={(row) => row.addressId}
            stickyHeader
            title="Addresses"
            toolbar={
              <TableToolbar
                count={customer.addresses.length}
                description="Saved service addresses and zone mapping."
                icon={<MapPin className="size-4" />}
                title="Addresses"
              />
            }
          />

          <div
            className={cn(
              'grid gap-3',
              featureFlags.customerWallet && '2xl:grid-cols-2',
            )}
          >
            {featureFlags.customerWallet ? (
              <DynamicTable
                bodyMaxHeight={260}
                columns={walletCreditColumns}
                data={customer.walletCredits}
                emptyDescription="No wallet credits were returned for this customer."
                emptyTitle="No wallet credits"
                getRowId={(row) => row.walletCreditId}
                stickyHeader
                title="Wallet credits"
                toolbar={
                  <TableToolbar
                    count={customer.walletCredits.length}
                    description="Credit adjustments and wallet state."
                    icon={<CreditCard className="size-4" />}
                    title="Wallet credits"
                  />
                }
              />
            ) : null}

            <DynamicTable
              bodyMaxHeight={260}
              columns={noteColumns}
              data={customer.notes}
              emptyDescription="No internal notes were returned for this customer."
              emptyTitle="No notes"
              getRowId={(row) => row.noteId}
              stickyHeader
              title="Internal notes"
              toolbar={
                <TableToolbar
                  count={customer.notes.length}
                  description="Internal support notes for admin follow-up."
                  icon={<MessageSquarePlus className="size-4" />}
                  title="Internal notes"
                />
              }
            />
          </div>
        </div>

        <CustomerActionRail
          canCreditWallet={canCreditWallet}
          canUpdateCustomer={canUpdateCustomer}
          customer={customer}
          isSubmitting={isSubmitting}
          onEditProfile={openProfileEditor}
          onSelectAction={openAction}
        />
      </section>

      {isProfileEditorOpen ? (
        <CustomerProfileEditModal
          customer={customer}
          error={profileError}
          isSubmitting={profileMutation.isPending}
          onClose={() => {
            if (!profileMutation.isPending) {
              setIsProfileEditorOpen(false)
              setProfileError(null)
            }
          }}
          onSubmit={submitProfileUpdate}
        />
      ) : null}

      <CustomerActionModal
        action={selectedAction}
        customer={customer}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        key={selectedAction ? `${selectedAction.kind}-${customer.customerId}` : 'closed'}
        onClose={() => {
          if (!actionMutation.isPending) {
            setSelectedAction(null)
            setActionError(null)
          }
        }}
        onSubmit={submitAction}
      />
    </PageContainer>
  )
}
