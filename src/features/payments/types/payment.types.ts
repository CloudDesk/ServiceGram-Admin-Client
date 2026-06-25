import type { ApiErrorDetails } from '../../../types/api.types'

export type AdminPaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
export type AdminPaymentMethod = 'UPI' | 'CARD' | 'NET_BANKING' | 'WALLET' | 'COD'
export type AdminPaymentGateway = 'RAZORPAY' | 'INTERNAL_COD' | 'WALLET'
type AdminPaymentFilterValue<T extends string> = T | T[]
type AdminPaymentIdFilterValue = string | string[]
export type AdminRefundStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REJECTED'

export interface AdminPaymentsQueryParams {
  page?: number
  limit?: number
  search?: string
  status?: AdminPaymentFilterValue<AdminPaymentStatus>
  method?: AdminPaymentFilterValue<AdminPaymentMethod>
  gateway?: AdminPaymentFilterValue<AdminPaymentGateway>
  orderId?: AdminPaymentIdFilterValue
  customerId?: AdminPaymentIdFilterValue
  vendorId?: AdminPaymentIdFilterValue
  zoneId?: string
  city?: string
  dateFrom?: string
  dateTo?: string
  minAmountPaise?: number
  maxAmountPaise?: number
}

export interface AdminRefundsQueryParams {
  page?: number
  limit?: number
  search?: string
  status?: AdminPaymentFilterValue<AdminRefundStatus>
  paymentId?: AdminPaymentIdFilterValue
  orderId?: AdminPaymentIdFilterValue
  customerId?: AdminPaymentIdFilterValue
  vendorId?: AdminPaymentIdFilterValue
  zoneId?: string
  city?: string
  dateFrom?: string
  dateTo?: string
  minAmountPaise?: number
  maxAmountPaise?: number
}

export interface ReconcilePaymentPayload {
  reason?: string
}

export interface ApproveRefundPayload {
  reason: string
  processImmediately?: boolean
}

export interface RejectRefundPayload {
  reason: string
}

export interface AdminFinancePagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface AdminPaymentOrderSummary {
  orderId: string
  publicOrderId: string
  orderStatus: string
  paymentMethod: string
  paymentStatus: string
  finalPricePaise: number | null
  currency: string
  createdAt: string
}

export interface AdminPaymentCustomerSummary {
  customerId: string
  fullName: string
  mobileNumber: string | null
  email: string | null
  city: string | null
  status: string
}

export interface AdminPaymentZoneSummary {
  zoneId: string
  city: string
  zoneName: string
}

export interface AdminPaymentVendorSummary {
  vendorId: string
  publicVendorId: string
  shopName: string
  vendorStatus: string
  city: string
  zone: AdminPaymentZoneSummary | null
}

export interface AdminPaymentCategorySummary {
  categoryId: string
  categoryCode: string
  name: string
}

export interface AdminRefundSummaryStats {
  refundCount: number
  requestedCount: number
  approvedCount: number
  processingCount: number
  successfulCount: number
  rejectedCount: number
  failedCount: number
  committedAmountPaise: number
  successfulAmountPaise: number
  remainingRefundableAmountPaise: number
}

export interface AdminPaymentSummary {
  paymentId: string
  publicPaymentId: string
  status: AdminPaymentStatus
  method: AdminPaymentMethod
  gateway: AdminPaymentGateway
  amountPaise: number
  currency: string
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  failureCode: string | null
  failureMessage: string | null
  verifiedAt: string | null
  order: AdminPaymentOrderSummary
  customer: AdminPaymentCustomerSummary
  vendor: AdminPaymentVendorSummary
  category: AdminPaymentCategorySummary | null
  refundSummary: AdminRefundSummaryStats
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminRefundCore {
  refundId: string
  paymentId: string
  publicPaymentId: string
  orderId: string
  amountPaise: number
  currency: string
  reason: string
  status: AdminRefundStatus
  razorpayRefundId: string | null
  initiatedByAdminId: string | null
  approvedByAdminId: string | null
  reviewedByAdminId: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminPaymentDetail extends AdminPaymentSummary {
  metadata: unknown
  refunds: AdminRefundCore[]
}

export interface AdminRefundSummary extends AdminRefundCore {
  payment: {
    paymentId: string
    publicPaymentId: string
    status: AdminPaymentStatus
    method: AdminPaymentMethod
    gateway: AdminPaymentGateway
    amountPaise: number
    currency: string
  }
  order: AdminPaymentOrderSummary
  customer: AdminPaymentCustomerSummary
  vendor: AdminPaymentVendorSummary
  category: AdminPaymentCategorySummary | null
  refundSummary: AdminRefundSummaryStats
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
}

export interface AdminRefundDetail extends AdminRefundSummary {
  metadata: unknown
}

export interface ReconcilePaymentResult extends AdminPaymentDetail {
  reconciliation: {
    checkedAt: string
    providerStatus: string
    statusChanged: boolean
    warnings: string[]
  }
}

export interface ApproveRefundResult extends AdminRefundDetail {
  approval: {
    providerStatus: string
    processImmediately: boolean
    warnings: string[]
  }
}

export interface AdminFinanceApiResponse<TData> {
  success?: boolean
  code?: string
  message?: string
  data: TData
  meta?: {
    requestId?: string
    timestamp?: string
    path?: string
    method?: string
    durationMs?: number
    apiVersion?: string
  }
}

export interface AdminPaymentsListResponse
  extends AdminFinanceApiResponse<AdminPaymentSummary[]> {
  data: AdminPaymentSummary[]
  pagination: AdminFinancePagination
}

export interface AdminRefundsListResponse
  extends AdminFinanceApiResponse<AdminRefundSummary[]> {
  data: AdminRefundSummary[]
  pagination: AdminFinancePagination
}

export type AdminPaymentDetailResponse = AdminFinanceApiResponse<AdminPaymentDetail>
export type AdminRefundDetailResponse = AdminFinanceApiResponse<AdminRefundDetail>
export type ReconcilePaymentResponse = AdminFinanceApiResponse<ReconcilePaymentResult>
export type ApproveRefundResponse = AdminFinanceApiResponse<ApproveRefundResult>
export type RejectRefundResponse = AdminFinanceApiResponse<AdminRefundDetail>

export interface AdminFinanceApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}
