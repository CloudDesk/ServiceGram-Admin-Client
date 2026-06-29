import type { ApiErrorDetails } from '../../../types/api.types'

export type AdminPayoutStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'HELD'
  | 'APPROVED'
  | 'PAID'
  | 'FAILED'
  | 'ADJUSTED'
  | 'CANCELLED'

export type AdminPayoutMethod = 'MANUAL_BANK_TRANSFER' | 'UPI' | 'OTHER'
type AdminPayoutFilterValue<T extends string> = T | T[]
type AdminPayoutIdFilterValue = string | string[]

export interface AdminPayoutsQueryParams {
  page?: number
  limit?: number
  search?: string
  status?: AdminPayoutFilterValue<AdminPayoutStatus>
  payoutMethod?: AdminPayoutFilterValue<AdminPayoutMethod>
  vendorId?: AdminPayoutIdFilterValue
  zoneId?: string
  city?: string
  dateFrom?: string
  dateTo?: string
  minAmountPaise?: number
  maxAmountPaise?: number
}

export interface CreatePayoutPayload {
  vendorId: string
  earningIds?: string[]
  payoutMethod?: AdminPayoutMethod
  reason: string
}

export interface ApprovePayoutPayload {
  reason: string
  processImmediately?: boolean
}

export interface PayoutReasonPayload {
  reason: string
}

export interface MarkPayoutPaidPayload {
  utrReference: string
  paidAt?: string
  reason: string
}

export interface AdminPayoutPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface AdminPayoutZone {
  zoneId: string
  city: string
  zoneName: string
}

export interface AdminPayoutVendor {
  vendorId: string
  publicVendorId: string
  shopName: string
  vendorStatus: string
  city: string
  zone: AdminPayoutZone | null
}

export interface AdminPayoutItemSummary {
  itemCount: number
  grossAmountPaise: number
  commissionAmountPaise: number
  logisticsDeductionPaise: number
  adjustmentAmountPaise: number
  netPayablePaise: number
}

export interface AdminPayoutSummary {
  payoutId: string
  publicPayoutId: string
  status: AdminPayoutStatus
  payoutMethod: AdminPayoutMethod
  totalAmountPaise: number
  currency: string
  utrReference: string | null
  approvedByAdminId: string | null
  approvedAt: string | null
  paidAt: string | null
  failureReason: string | null
  holdReason: string | null
  vendor: AdminPayoutVendor
  itemSummary: AdminPayoutItemSummary
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminPayoutItem {
  payoutItemId: string
  vendorEarningId: string
  amountPaise: number
  earning: {
    vendorId: string
    orderId: string
    grossAmountPaise: number
    commissionAmountPaise: number
    logisticsDeductionPaise: number
    adjustmentAmountPaise: number
    netPayablePaise: number
    status: string
    eligibilityDate: string | null
    holdReason: string | null
  }
  order: {
    orderId: string
    publicOrderId: string
    orderStatus: string
    paymentStatus: string
    finalPricePaise: number | null
    currency: string
    createdAt: string
  }
  createdAt: string
}

export interface AdminPayoutDetail extends AdminPayoutSummary {
  metadata: unknown
  items: AdminPayoutItem[]
}

export interface ApprovePayoutResult extends AdminPayoutDetail {
  approval: {
    providerStatus: string
    processImmediately: boolean
    warnings: string[]
  }
}

export interface AdminPayoutApiResponse<TData> {
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

export interface AdminPayoutsListResponse
  extends AdminPayoutApiResponse<AdminPayoutSummary[]> {
  data: AdminPayoutSummary[]
  pagination: AdminPayoutPagination
}

export interface AdminPayoutChildSummary {
  total: number
  pending: number
  underReview: number
  held: number
  approved: number
  paid: number
  failed: number
  adjusted: number
  cancelled: number
  active: number
  needsAttention: number
  totalAmountPaise: number
  activeAmountPaise: number
  paidAmountPaise: number
  heldAmountPaise: number
  failedAmountPaise: number
  itemCount: number
  netPayablePaise: number
  currency: string
  byStatus: Partial<Record<AdminPayoutStatus, number>>
  byPayoutMethod: Partial<Record<AdminPayoutMethod, number>>
}

export interface AdminVendorPayoutsListResponse
  extends AdminPayoutApiResponse<AdminPayoutSummary[]> {
  data: AdminPayoutSummary[]
  pagination: AdminPayoutPagination
  summary: AdminPayoutChildSummary
}

export type AdminPayoutDetailResponse = AdminPayoutApiResponse<AdminPayoutDetail>
export type CreatePayoutResponse = AdminPayoutApiResponse<AdminPayoutDetail>
export type ApprovePayoutResponse = AdminPayoutApiResponse<ApprovePayoutResult>
export type PayoutActionResponse = AdminPayoutApiResponse<AdminPayoutDetail>

export interface AdminPayoutApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}
