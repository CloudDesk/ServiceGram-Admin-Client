export interface ApiActionResult {
  success: boolean
  message: string
}

export interface ApiFieldError {
  field: string
  code: string
  message: string
}

export interface ApiErrorDetails {
  reason?: string
  action?: string
  fieldErrors?: ApiFieldError[]
  [key: string]: unknown
}

export interface ApiErrorResponse<TDetails = ApiErrorDetails> {
  success: false
  code: string
  message: string
  details?: TDetails
  meta?: {
    requestId?: string
    timestamp?: string
    path?: string
    method?: string
    durationMs?: number
    apiVersion?: string
  }
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
