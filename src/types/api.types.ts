export interface ApiActionResult {
  success: boolean
  message: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
