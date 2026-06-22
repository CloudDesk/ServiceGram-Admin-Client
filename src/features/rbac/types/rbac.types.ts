export interface RbacApiResponse<TData> {
  success?: boolean
  code?: string
  message?: string
  data: TData
  meta?: {
    requestId?: string
    timestamp?: string
    path?: string
    method?: string
    durationMs?: number
    apiVersion?: string
  }
}

export interface PermissionGroup {
  groupId: string
  groupCode: string
  groupName: string
  description: string | null
  displayOrder: number
  permissions: Permission[]
}

export interface Permission {
  permissionId: string
  permissionCode: string
  moduleCode: string
  actionCode: string
  description: string | null
  isSystem: boolean
  group?: {
    groupId: string
    groupCode: string
    groupName: string
  } | null
}

export interface RoleSummary {
  roleId: string
  roleCode: string
  roleName: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  permissionCount: number
  createdAt: string
  updatedAt: string
}

export interface RoleDetail extends Omit<RoleSummary, 'permissionCount'> {
  permissions: Permission[]
}

export interface CreateRolePayload {
  roleCode: string
  roleName: string
  description?: string
  permissionIds: string[]
}

export interface UpdateRolePayload {
  roleName?: string
  description?: string | null
  isActive?: boolean
  reason?: string
}

export interface UpdateRolePermissionsPayload {
  permissionIds: string[]
  reason?: string
}

export type PermissionCatalogueResponse = RbacApiResponse<PermissionGroup[]>
export type RolesListResponse = RbacApiResponse<RoleSummary[]>
export type RoleDetailResponse = RbacApiResponse<RoleDetail>
export type RoleUpdateResponse = RbacApiResponse<RoleDetail | RoleSummary>
