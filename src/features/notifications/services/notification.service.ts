import { buildApiUrl } from '../../../config/api'
import {
  NOTIFICATION_EVENTS_PATH,
  NOTIFICATION_SEND_PATH,
  NOTIFICATION_TEMPLATES_PATH,
  NOTIFICATION_TEMPLATE_UPDATE_PATH,
} from '../../../config/notificationApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  NotificationEventsQueryParams,
  NotificationEventsResponse,
  NotificationTemplatesQueryParams,
  NotificationTemplatesResponse,
  SendNotificationPayload,
  SendNotificationResponse,
  UpdateNotificationTemplatePayload,
  UpdateNotificationTemplateResponse,
} from '../types/notification.types'

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

function jsonRequest<TPayload>(method: 'POST' | 'PUT', payload: TPayload) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

async function getTemplates(
  query: NotificationTemplatesQueryParams = {},
): Promise<NotificationTemplatesResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${NOTIFICATION_TEMPLATES_PATH}?${queryString}`
        : NOTIFICATION_TEMPLATES_PATH,
    ),
  )
  return parseJsonResponse<NotificationTemplatesResponse>(response)
}

async function updateTemplate(
  templateId: string,
  payload: UpdateNotificationTemplatePayload,
): Promise<UpdateNotificationTemplateResponse> {
  const response = await apiClient.request(
    buildApiUrl(NOTIFICATION_TEMPLATE_UPDATE_PATH(templateId)),
    jsonRequest('PUT', payload),
  )
  return parseJsonResponse<UpdateNotificationTemplateResponse>(response)
}

async function getEvents(
  query: NotificationEventsQueryParams = {},
): Promise<NotificationEventsResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString ? `${NOTIFICATION_EVENTS_PATH}?${queryString}` : NOTIFICATION_EVENTS_PATH,
    ),
  )
  return parseJsonResponse<NotificationEventsResponse>(response)
}

async function sendNotification(
  payload: SendNotificationPayload,
): Promise<SendNotificationResponse> {
  const response = await apiClient.request(
    buildApiUrl(NOTIFICATION_SEND_PATH),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<SendNotificationResponse>(response)
}

export const notificationService = {
  getTemplates,
  updateTemplate,
  getEvents,
  sendNotification,
}
