export const ADMIN_ME_PATH = '/admin/me'
export const ADMIN_USERS_LIST_PATH = '/admin/users'
export const ADMIN_USERS_CREATE_PATH = '/admin/users'
export const ADMIN_USER_DETAIL_PATH = (adminId: string) => `/admin/users/${adminId}`
export const ADMIN_USER_UPDATE_PATH = (adminId: string) => `/admin/users/${adminId}`
export const ADMIN_USER_FORCE_LOGOUT_PATH = (adminId: string) =>
  `/admin/users/${adminId}/force-logout`
