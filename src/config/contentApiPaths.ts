export const CONTENT_PAGES_PATH = '/admin/content/pages'
export const CONTENT_PAGE_UPDATE_PATH = (pageId: string) =>
  `/admin/content/pages/${pageId}`
export const CONTENT_PAGE_PUBLISH_PATH = (pageId: string) =>
  `/admin/content/pages/${pageId}/publish`
export const CONTENT_PAGE_ARCHIVE_PATH = (pageId: string) =>
  `/admin/content/pages/${pageId}/archive`
