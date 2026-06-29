import { buildApiUrl } from '../../../config/api'
import {
  ADMIN_ME_PATH,
  ADMIN_USER_DETAIL_PATH,
  ADMIN_USER_FORCE_LOGOUT_PATH,
  ADMIN_USER_UPDATE_PATH,
  ADMIN_USERS_CREATE_PATH,
  ADMIN_USERS_LIST_PATH,
} from '../../../config/adminUserApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  AdminUserActionResponse,
  AdminUserDetailResponse,
  AdminUserErrorResponse,
  AdminUsersListResponse,
  AdminUsersQueryParams,
  CreateAdminUserPayload,
  CurrentAdminUserResponse,
  ForceLogoutAdminUserResponse,
  UpdateAdminUserPayload,
} from '../types/adminUser.types'
import { AdminUserServiceError } from '../types/adminUser.types'

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text()

  if (!text) {
    return null
  }

  return JSON.parse(text) as T
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await readJsonResponse<T | AdminUserErrorResponse>(response)

  if (!response.ok) {
    const errorBody = body as AdminUserErrorResponse | null
    const fieldMessage = errorBody?.details?.fieldErrors?.[0]?.message

    throw new AdminUserServiceError(
      fieldMessage ?? errorBody?.message ?? 'Request failed.',
      response.status,
      errorBody,
    )
  }

  return body as T
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

async function getMe(): Promise<CurrentAdminUserResponse> {
  const response = await apiClient.request(buildApiUrl(ADMIN_ME_PATH))

  return parseJsonResponse<CurrentAdminUserResponse>(response)
}

async function getAdminUsers(
  query: AdminUsersQueryParams = {},
): Promise<AdminUsersListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString ? `${ADMIN_USERS_LIST_PATH}?${queryString}` : ADMIN_USERS_LIST_PATH,
    ),
  )

  return parseJsonResponse<AdminUsersListResponse>(response)
}

async function createAdminUser(
  payload: CreateAdminUserPayload,
): Promise<AdminUserActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(ADMIN_USERS_CREATE_PATH),
    jsonRequest('POST', payload),
  )

  return parseJsonResponse<AdminUserActionResponse>(response)
}

async function getAdminUser(adminId: string): Promise<AdminUserDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(ADMIN_USER_DETAIL_PATH(adminId)),
  )

  return parseJsonResponse<AdminUserDetailResponse>(response)
}

async function updateAdminUser(
  adminId: string,
  payload: UpdateAdminUserPayload,
): Promise<AdminUserActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(ADMIN_USER_UPDATE_PATH(adminId)),
    jsonRequest('PUT', payload),
  )

  return parseJsonResponse<AdminUserActionResponse>(response)
}

async function forceLogoutAdminUser(
  adminId: string,
): Promise<ForceLogoutAdminUserResponse> {
  const response = await apiClient.request(
    buildApiUrl(ADMIN_USER_FORCE_LOGOUT_PATH(adminId)),
    {
      method: 'POST',
    },
  )

  return parseJsonResponse<ForceLogoutAdminUserResponse>(response)
}

export const adminUserService = {
  getMe,
  getAdminUsers,
  getAdminUser,
  createAdminUser,
  updateAdminUser,
  forceLogoutAdminUser,
}
