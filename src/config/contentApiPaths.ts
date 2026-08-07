export const CONTENT_PAGES_PATH = '/admin/content/pages'
export const CONTENT_PAGE_DETAIL_PATH = (pageId: string) =>
  `/admin/content/pages/${pageId}`
export const CONTENT_PAGE_UPDATE_PATH = (pageId: string) =>
  `/admin/content/pages/${pageId}`
export const CONTENT_PAGE_PUBLISH_PATH = (pageId: string) =>
  `/admin/content/pages/${pageId}/publish`
export const CONTENT_PAGE_ARCHIVE_PATH = (pageId: string) =>
  `/admin/content/pages/${pageId}/archive`

export const CUSTOMER_APP_HOME_PATH = '/admin/content/customer-app-home'
export const CUSTOMER_APP_HOME_HERO_CAROUSEL_PATH =
  '/admin/content/customer-app-home/hero-carousel'
export const CUSTOMER_HOME_CAROUSEL_SLIDES_PATH =
  '/admin/content/customer-app-home/hero-carousel/slides'
export const CUSTOMER_HOME_CAROUSEL_SLIDE_DETAIL_PATH = (slideId: string) =>
  `/admin/content/customer-app-home/hero-carousel/slides/${slideId}`
export const CUSTOMER_HOME_CAROUSEL_SLIDE_IMAGE_UPLOAD_INTENT_PATH = (
  slideId: string,
) => `/admin/content/customer-app-home/hero-carousel/slides/${slideId}/image/upload-intent`
export const CUSTOMER_HOME_CAROUSEL_SLIDE_IMAGE_CONFIRM_PATH = (slideId: string) =>
  `/admin/content/customer-app-home/hero-carousel/slides/${slideId}/image/confirm`
export const CUSTOMER_HOME_CAROUSEL_SLIDE_IMAGE_REMOVE_PATH = (slideId: string) =>
  `/admin/content/customer-app-home/hero-carousel/slides/${slideId}/image`
export const CUSTOMER_HOME_CAROUSEL_SLIDE_PUBLISH_PATH = (slideId: string) =>
  `/admin/content/customer-app-home/hero-carousel/slides/${slideId}/publish`
export const CUSTOMER_HOME_CAROUSEL_SLIDE_PAUSE_PATH = (slideId: string) =>
  `/admin/content/customer-app-home/hero-carousel/slides/${slideId}/pause`
export const CUSTOMER_HOME_CAROUSEL_SLIDE_ARCHIVE_PATH = (slideId: string) =>
  `/admin/content/customer-app-home/hero-carousel/slides/${slideId}/archive`
