import { Ban, MessageSquarePlus, ShieldCheck, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DynamicTable, type DynamicTableColumn } from '../../../components/ui/Table'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { formatMoney } from '../../../utils/formatMoney'
import { customerService } from '../services/customer.service'
import {
  CustomerActionModal,
  type CustomerActionFormValues,
  type CustomerActionKind,
  type CustomerActionSelection,
} from './CustomerActionModal'
import type {
  AdminCustomerAddress,
  AdminCustomerDetail,
  AdminCustomerNote,
  AdminCustomerRecentOrder,
  AdminCustomerWalletCredit,
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

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="break-words text-sm text-foreground">{value ?? 'Not available'}</p>
    </div>
  )
}

function CustomerHeaderStatus({ customer }: { customer: AdminCustomerDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={customer.status === 'ACTIVE' ? 'success' : customer.status === 'BLOCKED' ? 'danger' : 'warning'}>
        {customer.status}
      </Badge>
      <Badge tone="neutral">{customer.userStatus}</Badge>
    </div>
  )
}

function CustomerHeaderActions({
  customer,
  isSubmitting,
  onSelectAction,
}: {
  customer: AdminCustomerDetail
  isSubmitting: boolean
  onSelectAction: (kind: CustomerActionKind) => void
}) {
  const hasAction = (action: string) => customer.availableActions.includes(action)

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {hasAction('BLOCK') ? (
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
      {hasAction('UNBLOCK') ? (
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
      {hasAction('WALLET_CREDIT') ? (
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
      <Button
        disabled={isSubmitting}
        size="sm"
        variant="secondary"
        onClick={() => onSelectAction('ADD_NOTE')}
      >
        <MessageSquarePlus className="mr-2 size-4" />
        Add Note
      </Button>
    </div>
  )
}

export function CustomerDetailPage() {
  const { customerId } = useParams()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
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

  const openAction = (kind: CustomerActionKind) => {
    setActionError(null)
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

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={
          <CustomerHeaderActions
            customer={customer}
            isSubmitting={actionMutation.isPending}
            onSelectAction={openAction}
          />
        }
        description={customer.email ?? customer.mobileNumber ?? customer.userId}
        listHref={routePaths.customers}
        listLabel="Customers"
        recordName={customer.fullName}
        titleMetaNode={<CustomerHeaderStatus customer={customer} />}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">
            Customer Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Customer ID" value={customer.customerId} />
            <DetailField label="User ID" value={customer.userId} />
            <DetailField label="Mobile" value={customer.mobileNumber} />
            <DetailField label="Email" value={customer.email} />
            <DetailField label="City" value={customer.city} />
            <DetailField label="Zone" value={customer.zone?.zoneName} />
            <DetailField
              label="Total Orders"
              value={customer.orderSummary.totalOrders}
            />
            <DetailField
              label="Active Orders"
              value={customer.orderSummary.activeOrders}
            />
            <DetailField
              label="Lifetime Spend"
              value={formatMoney(customer.orderSummary.lifetimeSpendPaise / 100)}
            />
            <DetailField
              label="Wallet Balance"
              value={formatMoney(customer.walletSummary.creditBalancePaise / 100)}
            />
            <DetailField
              label="Total Notes"
              value={customer.noteSummary.totalNotes}
            />
            <DetailField
              label="Warnings"
              value={customer.warnings.length ? customer.warnings.join(', ') : null}
            />
            <DetailField label="Last Login" value={customer.lastLoginAt} />
            <DetailField label="Created At" value={customer.createdAt} />
            <DetailField label="Updated At" value={customer.updatedAt} />
          </div>
        </div>

        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Actions</h2>
          <DetailField
            label="Available Actions"
            value={
              customer.availableActions.length
                ? customer.availableActions.join(', ')
                : null
            }
          />
          <DetailField
            label="Next Recommended Action"
            value={customer.nextRecommendedAction}
          />
          <DetailField
            label="Wallet Provider"
            value={customer.walletSummary.providerStatus}
          />
          <DetailField
            label="Last Order"
            value={customer.orderSummary.lastOrderAt}
          />
          <DetailField
            label="Last Note"
            value={customer.noteSummary.lastNoteAt}
          />
        </div>
      </section>

      <section className="space-y-4">
        <DynamicTable
          bodyMaxHeight={320}
          columns={addressColumns}
          data={customer.addresses}
          emptyDescription="No addresses were returned for this customer."
          emptyTitle="No addresses"
          getRowId={(row) => row.addressId}
          title="Addresses"
        />

        <DynamicTable
          bodyMaxHeight={320}
          columns={recentOrderColumns}
          data={customer.recentOrders}
          emptyDescription="No recent orders were returned for this customer."
          emptyTitle="No recent orders"
          getRowId={(row) => row.orderId}
          title="Recent Orders"
        />

        <DynamicTable
          bodyMaxHeight={320}
          columns={walletCreditColumns}
          data={customer.walletCredits}
          emptyDescription="No wallet credits were returned for this customer."
          emptyTitle="No wallet credits"
          getRowId={(row) => row.walletCreditId}
          title="Wallet Credits"
        />

        <DynamicTable
          bodyMaxHeight={320}
          columns={noteColumns}
          data={customer.notes}
          emptyDescription="No internal notes were returned for this customer."
          emptyTitle="No notes"
          getRowId={(row) => row.noteId}
          title="Internal Notes"
        />
      </section>

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
