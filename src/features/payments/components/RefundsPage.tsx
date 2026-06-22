import { CheckCircle2, Eye, Search, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import {
  DynamicTable,
  TableSkeleton,
  type DynamicTableColumn,
} from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { useAuthStore } from '../../../store/authStore'
import { formatMoney } from '../../../utils/formatMoney'
import { paymentService } from '../services/payment.service'
import {
  PaymentActionModal,
  type PaymentActionFormValues,
  type PaymentActionSelection,
} from './PaymentActionModal'
import type {
  AdminRefundStatus,
  AdminRefundSummary,
  AdminRefundsQueryParams,
} from '../types/payment.types'

const refundStatuses: AdminRefundStatus[] = [
  'REQUESTED',
  'APPROVED',
  'PROCESSING',
  'SUCCESS',
  'FAILED',
  'REJECTED',
]

const refundColumns: DynamicTableColumn<AdminRefundSummary>[] = [
  {
    key: 'refundId',
    label: 'Refund',
    minWidth: 250,
    renderCell: (refund) => (
      <div>
        <p className="break-words font-semibold text-foreground">
          {refund.refundId}
        </p>
        <p className="text-xs text-muted">{refund.publicPaymentId}</p>
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    minWidth: 140,
    renderCell: (refund) => (
      <Badge
        tone={
          refund.status === 'SUCCESS'
            ? 'success'
            : refund.status === 'FAILED' || refund.status === 'REJECTED'
              ? 'danger'
              : 'warning'
        }
      >
        {refund.status}
      </Badge>
    ),
  },
  {
    key: 'amountPaise',
    label: 'Amount',
    align: 'right',
    minWidth: 140,
    renderCell: (refund) => formatMoney(refund.amountPaise / 100),
  },
  {
    key: 'order',
    label: 'Order',
    minWidth: 190,
    renderCell: (refund) => (
      <div>
        <p className="font-medium text-foreground">{refund.order.publicOrderId}</p>
        <p className="text-xs text-muted">{refund.order.orderStatus}</p>
      </div>
    ),
  },
  {
    key: 'customer',
    label: 'Customer',
    minWidth: 190,
    renderCell: (refund) => refund.customer.fullName,
  },
  {
    key: 'vendor',
    label: 'Vendor',
    minWidth: 190,
    renderCell: (refund) => refund.vendor.shopName,
  },
  {
    key: 'reason',
    label: 'Reason',
    minWidth: 280,
  },
  {
    key: 'nextRecommendedAction',
    label: 'Next',
    minWidth: 160,
    placeholder: 'No action',
  },
  {
    key: 'createdAt',
    label: 'Created',
    format: 'date',
    minWidth: 180,
  },
]

function OptionalSelect<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: '' | T) => void
  options: T[]
  value: '' | T
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value as '' | T)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

export function RefundsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const can = useAuthStore((state) => state.can)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | AdminRefundStatus>('REQUESTED')
  const [city, setCity] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [orderId, setOrderId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minAmountPaise, setMinAmountPaise] = useState('')
  const [maxAmountPaise, setMaxAmountPaise] = useState('')
  const [selectedAction, setSelectedAction] =
    useState<PaymentActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const canReviewRefunds = can('payments:refund')
  const reset = () => setPage(1)

  const query = useMemo<AdminRefundsQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: status || undefined,
      city: city.trim() || undefined,
      zoneId: zoneId.trim() || undefined,
      paymentId: paymentId.trim() || undefined,
      orderId: orderId.trim() || undefined,
      customerId: customerId.trim() || undefined,
      vendorId: vendorId.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      minAmountPaise: minAmountPaise ? Number(minAmountPaise) : undefined,
      maxAmountPaise: maxAmountPaise ? Number(maxAmountPaise) : undefined,
    }),
    [
      city,
      customerId,
      dateFrom,
      dateTo,
      limit,
      maxAmountPaise,
      minAmountPaise,
      orderId,
      page,
      paymentId,
      search,
      status,
      vendorId,
      zoneId,
    ],
  )

  const refundsQuery = useQuery({
    queryKey: ['refunds', query],
    queryFn: () => paymentService.getRefundList(query),
  })
  const refunds = refundsQuery.data?.data ?? []
  const pagination = refundsQuery.data?.pagination
  const isLoading = refundsQuery.isLoading || refundsQuery.isFetching

  const mutation = useMutation({
    mutationFn: ({ action, values }: {
      action: PaymentActionSelection
      values: PaymentActionFormValues
    }) => {
      if (action.kind === 'APPROVE_REFUND') {
        if (!values.reason) {
          throw new Error('Approval reason is required.')
        }

        return paymentService.approveRefund(action.refund.refundId, {
          processImmediately: values.processImmediately,
          reason: values.reason,
        })
      }

      if (action.kind === 'REJECT_REFUND') {
        if (!values.reason) {
          throw new Error('Rejection reason is required.')
        }

        return paymentService.rejectRefund(action.refund.refundId, {
          reason: values.reason,
        })
      }

      throw new Error('Unsupported refund action.')
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: async (response) => {
      setSelectedAction(null)
      setActionMessage(response.message ?? 'Refund updated.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['refunds'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['payment-detail'] }),
      ])
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Refund action failed.',
      )
    },
  })

  return (
    <PageContainer>
      <PageContextHeader
        description="Review requested refunds and approve or reject finance actions."
        title="Refunds"
      />

      {actionMessage ? (
        <div className="rounded-[1rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
          {actionMessage}
        </div>
      ) : null}

      <section className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                className="min-h-11 pl-9"
                placeholder="Search refund, payment, order, customer, vendor"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  reset()
                }}
              />
            </div>
          </label>
          <OptionalSelect
            label="Status"
            options={refundStatuses}
            value={status}
            onChange={(value) => {
              setStatus(value)
              reset()
            }}
          />
          {[
            ['City', city, setCity],
            ['Zone ID', zoneId, setZoneId],
            ['Payment ID', paymentId, setPaymentId],
            ['Order ID', orderId, setOrderId],
            ['Customer ID', customerId, setCustomerId],
            ['Vendor ID', vendorId, setVendorId],
            ['Min Amount Paise', minAmountPaise, setMinAmountPaise],
            ['Max Amount Paise', maxAmountPaise, setMaxAmountPaise],
          ].map(([label, value, setter]) => (
            <label className="space-y-1" key={label as string}>
              <span className="text-sm font-medium text-foreground">
                {label as string}
              </span>
              <Input
                className="min-h-11"
                value={value as string}
                onChange={(event) => {
                  ;(setter as (nextValue: string) => void)(event.target.value)
                  reset()
                }}
              />
            </label>
          ))}
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Date From</span>
            <Input
              className="min-h-11"
              type="datetime-local"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value)
                reset()
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Date To</span>
            <Input
              className="min-h-11"
              type="datetime-local"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value)
                reset()
              }}
            />
          </label>
        </div>

        {refundsQuery.isError ? (
          <ErrorState
            description={
              refundsQuery.error instanceof Error
                ? refundsQuery.error.message
                : 'We could not load refunds. Please retry.'
            }
            title="Refunds unavailable"
            onRetry={() => void refundsQuery.refetch()}
          />
        ) : isLoading ? (
          <TableSkeleton
            columns={refundColumns}
            hasActions
            hasFooter={Boolean(pagination)}
            rowCount={8}
          />
        ) : refunds.length === 0 ? (
          <EmptyState
            description="No refunds matched the selected filters."
            title="No refunds"
          />
        ) : (
          <DynamicTable
            actionColumnLabel="Actions"
            bodyMaxHeight={620}
            columns={refundColumns}
            data={refunds}
            pagination={
              pagination
                ? {
                    page: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    onPageChange: setPage,
                    onPageSizeChange: (nextLimit) => {
                      setLimit(nextLimit)
                      setPage(1)
                    },
                    rowsPerPageOptions: [10, 20, 50, 100],
                  }
                : undefined
            }
            rowActions={(refund) => [
              {
                key: 'view-payment',
                label: 'View Payment',
                icon: <Eye className="size-4" />,
                onClick: () =>
                  navigate(`${routePaths.payments}/${refund.payment.paymentId}`),
              },
              {
                key: 'approve',
                label: 'Approve',
                icon: <CheckCircle2 className="size-4" />,
                isVisible:
                  canReviewRefunds && refund.availableActions.includes('APPROVE'),
                onClick: () =>
                  setSelectedAction({ kind: 'APPROVE_REFUND', refund }),
              },
              {
                key: 'reject',
                label: 'Reject',
                icon: <XCircle className="size-4" />,
                isVisible:
                  canReviewRefunds && refund.availableActions.includes('REJECT'),
                variant: 'danger',
                onClick: () =>
                  setSelectedAction({ kind: 'REJECT_REFUND', refund }),
              },
            ]}
            title="Refund queue"
            getRowId={(row) => row.refundId}
            onRowClick={(row) =>
              navigate(`${routePaths.payments}/${row.payment.paymentId}`)
            }
          />
        )}
      </section>

      <PaymentActionModal
        action={selectedAction}
        error={actionError}
        isSubmitting={mutation.isPending}
        onClose={() => {
          if (!mutation.isPending) {
            setSelectedAction(null)
            setActionError(null)
          }
        }}
        onSubmit={(values) => {
          if (selectedAction) {
            void mutation.mutateAsync({ action: selectedAction, values })
          }
        }}
      />
    </PageContainer>
  )
}
