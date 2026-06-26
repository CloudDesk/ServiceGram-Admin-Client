export const NOTIFICATION_TEMPLATES_PATH = '/admin/notifications/templates'
export const NOTIFICATION_TEMPLATE_UPDATE_PATH = (templateId: string) =>
  `/admin/notifications/templates/${templateId}`
export const NOTIFICATION_SEND_PATH = '/admin/notifications/send'
export const NOTIFICATION_EVENTS_PATH = '/admin/notifications/events'
export const NOTIFICATION_EVENT_DETAIL_PATH = (eventId: string) =>
  `/admin/notifications/events/${eventId}`
