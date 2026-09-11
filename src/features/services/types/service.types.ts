export type VendorServiceModerationStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

export type VendorServicePriceType =
  | 'FIXED'
  | 'STARTING_FROM'
  | 'RANGE'
  | 'INSPECTION_REQUIRED'

export interface AdminServicesQueryParams {
  page?: number
  limit?: number
  search?: string
}

export interface AdminService {
  serviceId: string
  serviceName: string
  description: string | null
  isActive: boolean
  pricing: {
    basePricePaise: number
    priceType: VendorServicePriceType
    minPricePaise: number | null
    maxPricePaise: number | null
    currency: string
  }
  category: {
    categoryId: string
    categoryCode: string
    name: string
  } | null
  serviceType: {
    serviceTypeId: string
    name: string
  } | null
  vendor: {
    vendorId: string
    publicVendorId: string
    shopName: string
    city: string | null
  }
  moderation: {
    status: VendorServiceModerationStatus
    rejectionReason: string | null
    approvedByAdminId: string | null
    approvedAt: string | null
  }
  createdAt: string
  updatedAt: string
}

export interface AdminServicesPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface AdminServiceApiResponse<TData> {
  success?: boolean
  code?: string
  message?: string
  data: TData
}

export interface AdminServicesListResponse
  extends AdminServiceApiResponse<AdminService[]> {
  data: AdminService[]
  pagination: AdminServicesPagination
}

export type AdminServiceDetailResponse = AdminServiceApiResponse<AdminService>
export type AdminServiceActionResponse = AdminServiceApiResponse<AdminService>

export interface ServiceOptionalReasonPayload {
  reason?: string
}

export interface ServiceRequiredReasonPayload {
  reason: string
}
