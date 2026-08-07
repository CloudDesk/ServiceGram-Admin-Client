import { buildApiUrl } from '../../../config/api'
import {
  CUSTOMER_APP_HOME_HERO_CAROUSEL_PATH,
  CUSTOMER_APP_HOME_PATH,
  CUSTOMER_HOME_CAROUSEL_SLIDE_ARCHIVE_PATH,
  CUSTOMER_HOME_CAROUSEL_SLIDE_DETAIL_PATH,
  CUSTOMER_HOME_CAROUSEL_SLIDE_IMAGE_CONFIRM_PATH,
  CUSTOMER_HOME_CAROUSEL_SLIDE_IMAGE_REMOVE_PATH,
  CUSTOMER_HOME_CAROUSEL_SLIDE_IMAGE_UPLOAD_INTENT_PATH,
  CUSTOMER_HOME_CAROUSEL_SLIDE_PAUSE_PATH,
  CUSTOMER_HOME_CAROUSEL_SLIDE_PUBLISH_PATH,
  CUSTOMER_HOME_CAROUSEL_SLIDES_PATH,
  CONTENT_PAGE_DETAIL_PATH,
  CONTENT_PAGES_PATH,
  CONTENT_PAGE_ARCHIVE_PATH,
  CONTENT_PAGE_PUBLISH_PATH,
  CONTENT_PAGE_UPDATE_PATH,
} from '../../../config/contentApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  ContentApiResponse,
  ContentApiErrorDetails,
  ContentPageActionPayload,
  ContentPageResponse,
  ContentPagesQueryParams,
  ContentPagesResponse,
  ConfirmCustomerHomeCarouselImageUploadPayload,
  CreateContentPagePayload,
  CreateCustomerHomeCarouselSlidePayload,
  CustomerAppHomeResponse,
  CustomerHomeCarouselImageUploadIntentPayload,
  CustomerHomeCarouselImageUploadIntentResponse,
  CustomerHomeCarouselSlideActionPayload,
  CustomerHomeCarouselSlideResponse,
  CustomerHomeCarouselSlidesQueryParams,
  CustomerHomeCarouselSlidesResponse,
  UpdateCustomerHomeCarouselSlidePayload,
  UpdateCustomerHomeSectionPayload,
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

function jsonRequest<TPayload>(
  method: 'DELETE' | 'POST' | 'PUT',
  payload: TPayload,
) {
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

async function getCustomerAppHome(): Promise<CustomerAppHomeResponse> {
  const response = await apiClient.request(buildApiUrl(CUSTOMER_APP_HOME_PATH))
  return parseJsonResponse<CustomerAppHomeResponse>(response)
}

async function updateCustomerAppHomeSection(
  payload: UpdateCustomerHomeSectionPayload,
): Promise<ContentApiResponse<unknown>> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_APP_HOME_HERO_CAROUSEL_PATH),
    jsonRequest('PUT', payload),
  )
  return parseJsonResponse<ContentApiResponse<unknown>>(response)
}

async function getCarouselSlides(
  query: CustomerHomeCarouselSlidesQueryParams = {},
): Promise<CustomerHomeCarouselSlidesResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${CUSTOMER_HOME_CAROUSEL_SLIDES_PATH}?${queryString}`
        : CUSTOMER_HOME_CAROUSEL_SLIDES_PATH,
    ),
  )
  return parseJsonResponse<CustomerHomeCarouselSlidesResponse>(response)
}

async function getCarouselSlide(
  slideId: string,
): Promise<CustomerHomeCarouselSlideResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_HOME_CAROUSEL_SLIDE_DETAIL_PATH(slideId)),
  )
  return parseJsonResponse<CustomerHomeCarouselSlideResponse>(response)
}

async function createCarouselSlide(
  payload: CreateCustomerHomeCarouselSlidePayload,
): Promise<CustomerHomeCarouselSlideResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_HOME_CAROUSEL_SLIDES_PATH),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<CustomerHomeCarouselSlideResponse>(response)
}

async function updateCarouselSlide(
  slideId: string,
  payload: UpdateCustomerHomeCarouselSlidePayload,
): Promise<CustomerHomeCarouselSlideResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_HOME_CAROUSEL_SLIDE_DETAIL_PATH(slideId)),
    jsonRequest('PUT', payload),
  )
  return parseJsonResponse<CustomerHomeCarouselSlideResponse>(response)
}

async function createCarouselImageUploadIntent(
  slideId: string,
  payload: CustomerHomeCarouselImageUploadIntentPayload,
): Promise<CustomerHomeCarouselImageUploadIntentResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_HOME_CAROUSEL_SLIDE_IMAGE_UPLOAD_INTENT_PATH(slideId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<CustomerHomeCarouselImageUploadIntentResponse>(response)
}

async function confirmCarouselImageUpload(
  slideId: string,
  payload: ConfirmCustomerHomeCarouselImageUploadPayload,
): Promise<CustomerHomeCarouselSlideResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_HOME_CAROUSEL_SLIDE_IMAGE_CONFIRM_PATH(slideId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<CustomerHomeCarouselSlideResponse>(response)
}

async function removeCarouselImage(
  slideId: string,
  payload: CustomerHomeCarouselSlideActionPayload,
): Promise<CustomerHomeCarouselSlideResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_HOME_CAROUSEL_SLIDE_IMAGE_REMOVE_PATH(slideId)),
    jsonRequest('DELETE', payload),
  )
  return parseJsonResponse<CustomerHomeCarouselSlideResponse>(response)
}

async function publishCarouselSlide(
  slideId: string,
  payload: CustomerHomeCarouselSlideActionPayload,
): Promise<CustomerHomeCarouselSlideResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_HOME_CAROUSEL_SLIDE_PUBLISH_PATH(slideId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<CustomerHomeCarouselSlideResponse>(response)
}

async function pauseCarouselSlide(
  slideId: string,
  payload: CustomerHomeCarouselSlideActionPayload,
): Promise<CustomerHomeCarouselSlideResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_HOME_CAROUSEL_SLIDE_PAUSE_PATH(slideId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<CustomerHomeCarouselSlideResponse>(response)
}

async function archiveCarouselSlide(
  slideId: string,
  payload: CustomerHomeCarouselSlideActionPayload,
): Promise<CustomerHomeCarouselSlideResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_HOME_CAROUSEL_SLIDE_ARCHIVE_PATH(slideId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<CustomerHomeCarouselSlideResponse>(response)
}

export const contentService = {
  getPages,
  getPage,
  createPage,
  updatePage,
  publishPage,
  archivePage,
  getCustomerAppHome,
  updateCustomerAppHomeSection,
  getCarouselSlides,
  getCarouselSlide,
  createCarouselSlide,
  updateCarouselSlide,
  createCarouselImageUploadIntent,
  confirmCarouselImageUpload,
  removeCarouselImage,
  publishCarouselSlide,
  pauseCarouselSlide,
  archiveCarouselSlide,
}
