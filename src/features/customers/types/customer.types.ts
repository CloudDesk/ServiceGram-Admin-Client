import type { ApiErrorDetails } from '../../../types/api.types'

export type AdminCustomerStatus = 'ACTIVE' | 'BLOCKED' | 'INCOMPLETE'

export interface AdminCustomersQueryParams {
  page?: number
  limit?: number
  search?: string
  status?: AdminCustomerStatus
  city?: string
  zoneId?: string
  hasOrders?: boolean
  hasWalletCredit?: boolean
  dateFrom?: string
  dateTo?: string
}

export interface CustomerNotePayload {
  note: string
}

export interface CustomerLifecycleActionPayload {
  reason: string
}

export interface CustomerWalletCreditPayload {
  amountPaise: number
  currency?: string
  reason: string
  referenceId?: string
}

export interface CustomerProfileUpdatePayload {
  fullName?: string
  email?: string
  city?: string
  zoneId?: string | null
  reason: string
}

export interface AdminCustomerZone {
  zoneId: string
  city: string
  zoneName: string
}

export interface AdminCustomerOrderSummary {
  totalOrders: number
  activeOrders: number
  lifetimeSpendPaise: number
  lastOrderAt: string | null
}

export interface AdminCustomerWalletSummary {
  creditBalancePaise: number
  providerStatus: string
}

export interface AdminCustomerNoteSummary {
  totalNotes: number
  lastNoteAt: string | null
}

export interface AdminCustomerListItem {
  customerId: string
  userId: string
  fullName: string
  mobileNumber: string | null
  email: string | null
  city: string
  zone: AdminCustomerZone | null
  status: AdminCustomerStatus
  userStatus: string
  orderSummary: AdminCustomerOrderSummary
  walletSummary: AdminCustomerWalletSummary
  noteSummary: AdminCustomerNoteSummary
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface AdminCustomerAddress {
  addressId: string
  label: string | null
  contactName: string
  contactMobile: string
  addressLine1: string
  addressLine2: string | null
  landmark: string | null
  city: string
  state: string
  pincode: string
  latitude: string | null
  longitude: string | null
  zone: AdminCustomerZone | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminCustomerRecentOrderVendor {
  vendorId: string
  publicVendorId: string
  shopName: string
}

export interface AdminCustomerRecentOrderCategory {
  categoryId: string
  categoryCode: string
  name: string
}

export interface AdminCustomerRecentOrder {
  orderId: string
  publicOrderId: string
  orderStatus: string
  paymentStatus: string | null
  paymentMethod: string | null
  finalPricePaise: number | null
  priceEstimatePaise: number | null
  pickupDate: string | null
  vendor: AdminCustomerRecentOrderVendor
  category: AdminCustomerRecentOrderCategory | null
  createdAt: string
  updatedAt: string
}

export interface AdminCustomerNote {
  noteId: string
  adminId: string | null
  note: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface AdminCustomerWalletCredit {
  walletCreditId: string
  amountPaise: number
  currency: string
  status: string
  reason: string
  metadata: Record<string, unknown> | null
  adminId: string | null
  createdAt: string
}

export interface AdminCustomerDetail extends AdminCustomerListItem {
  addresses: AdminCustomerAddress[]
  recentOrders: AdminCustomerRecentOrder[]
  notes: AdminCustomerNote[]
  walletCredits: AdminCustomerWalletCredit[]
}

export interface AdminCustomerWalletCreditResult {
  walletCreditId: string
  customer: AdminCustomerListItem
  amountPaise: number
  currency: string
  status: string
  reason: string
  metadata: Record<string, unknown> | null
  providerStatus: string
  createdAt: string
}

export interface AdminCustomersSummary {
  visible: number
  active: number
  blocked: number
  withActiveOrders: number
  walletCreditPaise: number
}

export interface AdminCustomersPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface AdminCustomerApiResponse<TData> {
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

export interface AdminCustomersListResponse
  extends AdminCustomerApiResponse<AdminCustomerListItem[]> {
  data: AdminCustomerListItem[]
  pagination: AdminCustomersPagination
  summary: AdminCustomersSummary
}

export type AdminCustomerDetailResponse =
  AdminCustomerApiResponse<AdminCustomerDetail>
export type UpdateCustomerProfileResponse =
  AdminCustomerApiResponse<AdminCustomerListItem>
export type AddCustomerNoteResponse = AdminCustomerApiResponse<AdminCustomerNote>
export type BlockCustomerResponse =
  AdminCustomerApiResponse<AdminCustomerListItem>
export type UnblockCustomerResponse =
  AdminCustomerApiResponse<AdminCustomerListItem>
export type CustomerWalletCreditResponse =
  AdminCustomerApiResponse<AdminCustomerWalletCreditResult>

export interface AdminCustomerApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}
