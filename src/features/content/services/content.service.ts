import { buildApiUrl } from '../../../config/api'
import {
  CONTENT_PAGE_DETAIL_PATH,
  CONTENT_PAGES_PATH,
  CONTENT_PAGE_ARCHIVE_PATH,
  CONTENT_PAGE_PUBLISH_PATH,
  CONTENT_PAGE_UPDATE_PATH,
} from '../../../config/contentApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  ContentApiErrorDetails,
  ContentPageActionPayload,
  ContentPageResponse,
  ContentPagesQueryParams,
  ContentPagesResponse,
  CreateContentPagePayload,
  UpdateContentPagePayload,
} from '../types/content.types'

interface ErrorEnvelope {
  message?: string
  error?: string
  code?: string
  details?: ContentApiErrorDetails
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | ErrorEnvelope
    | null

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object' ? (payload as ErrorEnvelope) : null
    const fieldMessage = errorPayload?.details?.fieldErrors?.[0]?.message

    throw new Error(
      fieldMessage ?? errorPayload?.message ?? errorPayload?.error ?? 'Request failed.',
    )
  }

  return payload as T
}

function jsonRequest<TPayload>(method: 'POST' | 'PUT', payload: TPayload) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

async function getPages(
  query: ContentPagesQueryParams = {},
): Promise<ContentPagesResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${CONTENT_PAGES_PATH}?${queryString}` : CONTENT_PAGES_PATH),
  )
  return parseJsonResponse<ContentPagesResponse>(response)
}

async function getPage(pageId: string): Promise<ContentPageResponse> {
  const response = await apiClient.request(
    buildApiUrl(CONTENT_PAGE_DETAIL_PATH(pageId)),
  )
  return parseJsonResponse<ContentPageResponse>(response)
}

async function createPage(
  payload: CreateContentPagePayload,
): Promise<ContentPageResponse> {
  const response = await apiClient.request(
    buildApiUrl(CONTENT_PAGES_PATH),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<ContentPageResponse>(response)
}

async function updatePage(
  pageId: string,
  payload: UpdateContentPagePayload,
): Promise<ContentPageResponse> {
  const response = await apiClient.request(
    buildApiUrl(CONTENT_PAGE_UPDATE_PATH(pageId)),
    jsonRequest('PUT', payload),
  )
  return parseJsonResponse<ContentPageResponse>(response)
}

async function publishPage(
  pageId: string,
  payload: ContentPageActionPayload,
): Promise<ContentPageResponse> {
  const response = await apiClient.request(
    buildApiUrl(CONTENT_PAGE_PUBLISH_PATH(pageId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<ContentPageResponse>(response)
}

async function archivePage(
  pageId: string,
  payload: ContentPageActionPayload,
): Promise<ContentPageResponse> {
  const response = await apiClient.request(
    buildApiUrl(CONTENT_PAGE_ARCHIVE_PATH(pageId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<ContentPageResponse>(response)
}

export const contentService = {
  getPages,
  getPage,
  createPage,
  updatePage,
  publishPage,
  archivePage,
}
