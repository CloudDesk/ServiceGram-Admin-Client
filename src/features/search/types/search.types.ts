import type { StatusTone } from '../../../types/status.types'

export type AdminSearchModule =
  | 'customers'
  | 'vendors'
  | 'vendorOnboarding'
  | 'orders'
  | 'payments'
  | 'refunds'
  | 'payouts'
  | 'reels'
  | 'influencers'
  | 'notifications'
  | 'content'
  | 'reports'
  | 'settings'
  | 'audit'
  | 'roles'
  | 'adminUsers'

export interface AdminSearchModuleAccess {
  module: AdminSearchModule
  label: string
  permission: string
  scopeMode: 'ANY' | 'PLATFORM' | 'ZONE_OR_PLATFORM'
}

export interface AdminSearchResult {
  id: string
  module: AdminSearchModule
  type: string
  title: string
  subtitle: string
  status: string | null
  statusTone: StatusTone
  route: string
  matchedFields: string[]
  metadata: Record<string, string | number | boolean | null>
  updatedAt: string | null
  priority: number
}

export interface AdminSearchGroup {
  module: AdminSearchModule
  label: string
  resultCount: number
  results: AdminSearchResult[]
}

export interface AdminSearchResponse {
  success?: boolean
  code?: string
  message?: string
  data: {
    query: string
    totalResults: number
    groups: AdminSearchGroup[]
    availableModules: AdminSearchModuleAccess[]
    minimumQueryLength: number
  }
}

export interface AdminSearchQueryParams {
  q?: string
  modules?: AdminSearchModule[]
  limit?: number
}
