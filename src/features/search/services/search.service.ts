import { buildApiUrl } from '../../../config/api'
import { ADMIN_GLOBAL_SEARCH_PATH } from '../../../config/searchApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type { AdminSearchQueryParams, AdminSearchResponse } from '../types/search.types'

interface ErrorEnvelope {
  message?: string
  error?: string
  code?: string
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | ErrorEnvelope

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object' ? (payload as ErrorEnvelope) : null

    throw new Error(errorPayload?.message ?? 'Request failed.')
  }

  return payload as T
}

async function search(
  query: AdminSearchQueryParams = {},
): Promise<AdminSearchResponse> {
  const queryString = buildQueryParams({
    q: query.q,
    modules: query.modules?.join(','),
    limit: query.limit,
  })
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${ADMIN_GLOBAL_SEARCH_PATH}?${queryString}`
        : ADMIN_GLOBAL_SEARCH_PATH,
    ),
  )

  return parseJsonResponse<AdminSearchResponse>(response)
}

export const adminSearchService = {
  search,
}
