import { buildApiUrl } from '../../../config/api'
import {
  PERMISSIONS_LIST_PATH,
  ROLE_CREATE_PATH,
  ROLE_DETAIL_PATH,
  ROLE_PERMISSIONS_UPDATE_PATH,
  ROLE_UPDATE_PATH,
  ROLES_LIST_PATH,
} from '../../../config/rbacApiPaths'
import { apiClient } from '../../../services/apiClient'
import type {
  CreateRolePayload,
  PermissionCatalogueResponse,
  RoleDetailResponse,
  RolesListResponse,
  RoleUpdateResponse,
  UpdateRolePayload,
  UpdateRolePermissionsPayload,
} from '../types/rbac.types'

interface ErrorEnvelope {
  message?: string
  error?: string
  code?: string
}

function jsonRequest<TPayload>(method: 'POST' | 'PUT', payload: TPayload) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | ErrorEnvelope

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object' ? (payload as ErrorEnvelope) : null
    const message =
      errorPayload?.message
        ? errorPayload.message
        : 'Request failed.'

    throw new Error(message)
  }

  return payload as T
}

async function getPermissions(): Promise<PermissionCatalogueResponse> {
  const response = await apiClient.request(buildApiUrl(PERMISSIONS_LIST_PATH))

  return parseJsonResponse<PermissionCatalogueResponse>(response)
}

async function getRoles(): Promise<RolesListResponse> {
  const response = await apiClient.request(buildApiUrl(ROLES_LIST_PATH))

  return parseJsonResponse<RolesListResponse>(response)
}

async function getRoleById(roleId: string): Promise<RoleDetailResponse> {
  const response = await apiClient.request(buildApiUrl(ROLE_DETAIL_PATH(roleId)))

  return parseJsonResponse<RoleDetailResponse>(response)
}

async function createRole(
  payload: CreateRolePayload,
): Promise<RoleDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(ROLE_CREATE_PATH),
    jsonRequest('POST', payload),
  )

  return parseJsonResponse<RoleDetailResponse>(response)
}

async function updateRole(
  roleId: string,
  payload: UpdateRolePayload,
): Promise<RoleUpdateResponse> {
  const response = await apiClient.request(
    buildApiUrl(ROLE_UPDATE_PATH(roleId)),
    jsonRequest('PUT', payload),
  )

  return parseJsonResponse<RoleUpdateResponse>(response)
}

async function updateRolePermissions(
  roleId: string,
  payload: UpdateRolePermissionsPayload,
): Promise<RoleDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(ROLE_PERMISSIONS_UPDATE_PATH(roleId)),
    jsonRequest('PUT', payload),
  )

  return parseJsonResponse<RoleDetailResponse>(response)
}

export const rbacService = {
  getPermissions,
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  updateRolePermissions,
}
