export const PERMISSIONS_LIST_PATH = '/admin/permissions'
export const ROLES_LIST_PATH = '/admin/roles'
export const ROLE_CREATE_PATH = '/admin/roles'
export const ROLE_DETAIL_PATH = (roleId: string) => `/admin/roles/${roleId}`
export const ROLE_UPDATE_PATH = (roleId: string) => `/admin/roles/${roleId}`
export const ROLE_PERMISSIONS_UPDATE_PATH = (roleId: string) =>
  `/admin/roles/${roleId}/permissions`
