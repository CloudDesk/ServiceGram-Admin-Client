import { routePaths } from '../config/routes'
import { buildApiUrl } from '../config/api'
import {
  ADMIN_FORGOT_PASSWORD_PATH,
  ADMIN_LOGIN_PATH,
  ADMIN_REFRESH_PATH,
  ADMIN_RESET_PASSWORD_PATH,
} from '../config/apiPaths'
import { storageKeys } from '../lib/storage'
import { useAuthStore } from '../store/authStore'
import type { RefreshResponse } from '../features/auth/types/auth.types'
import { buildAuthSession } from '../features/auth/utils/session'
import { safeAuthRedirectPath } from '../features/auth/utils/redirect'

type ApiRequestInit = RequestInit
type AuthRedirectReason = 'expired' | 'reauth'
type ParsedUnauthorizedEnvelope = UnauthorizedEnvelope | null
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60_000

interface UnauthorizedEnvelope {
  code?: string
  message?: string
}

interface AuthRedirectNotice {
  message: string
  reason: AuthRedirectReason
  redirectTo: string
}

function buildAuthHeaders(headers?: HeadersInit) {
  const { accessToken } = useAuthStore.getState()
  const merged = new Headers(headers)

  if (accessToken && !merged.has('Authorization')) {
    merged.set('Authorization', `Bearer ${accessToken}`)
  }

  return merged
}

function currentRedirectPath() {
  return safeAuthRedirectPath(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  )
}

function loginPath(reason: AuthRedirectReason, redirectTo: string) {
  const searchParams = new URLSearchParams({
    reason,
    redirectTo,
  })

  return `${routePaths.login}?${searchParams.toString()}`
}

function getPathname(input: string) {
  try {
    return new URL(input).pathname
  } catch {
    return new URL(input, window.location.origin).pathname
  }
}

function isPublicAuthPath(input: string) {
  const pathname = getPathname(input)

  return [
    ADMIN_FORGOT_PASSWORD_PATH,
    ADMIN_LOGIN_PATH,
    ADMIN_REFRESH_PATH,
    ADMIN_RESET_PASSWORD_PATH,
  ].some((path) => pathname.endsWith(path))
}

async function parseUnauthorizedEnvelope(response?: Response) {
  if (!response) {
    return null
  }

  try {
    return (await response.clone().json()) as UnauthorizedEnvelope
  } catch {
    return null
  }
}

let refreshPromise: Promise<boolean> | null = null

async function refreshSession() {
  const { session, setSession } = useAuthStore.getState()

  if (!session) {
    return false
  }

  const response = await fetch(buildApiUrl(ADMIN_REFRESH_PATH), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    return false
  }

  const body = (await response.json()) as RefreshResponse
  setSession(buildAuthSession(body.data))

  return true
}

async function refreshOnce() {
  refreshPromise ??= refreshSession().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

function shouldRefreshBeforeRequest(input: string) {
  const { session } = useAuthStore.getState()

  if (!session || isPublicAuthPath(input)) {
    return false
  }

  const accessTokenExpiresAt = Date.parse(session.accessTokenExpiresAt)

  return (
    Number.isFinite(accessTokenExpiresAt) &&
    accessTokenExpiresAt - Date.now() <= ACCESS_TOKEN_REFRESH_BUFFER_MS
  )
}

async function handleUnauthorized(
  response?: Response,
  parsedEnvelope?: ParsedUnauthorizedEnvelope,
) {
  const { clearSession } = useAuthStore.getState()
  const envelope = parsedEnvelope ?? (await parseUnauthorizedEnvelope(response))
  const reason: AuthRedirectReason =
    envelope?.code === 'AUTH_REAUTH_REQUIRED' ? 'reauth' : 'expired'
  const redirectTo = currentRedirectPath()
  const notice: AuthRedirectNotice = {
    reason,
    redirectTo,
    message:
      envelope?.message ??
      (reason === 'reauth'
        ? 'Please sign in again before performing this action.'
        : 'Your session has expired. Please log in again.'),
  }

  clearSession()

  if (window.location.pathname !== routePaths.login) {
    window.sessionStorage.setItem(
      storageKeys.authRedirectNotice,
      JSON.stringify(notice),
    )
    window.location.replace(loginPath(reason, redirectTo))
  }
}

async function request(input: string, init?: ApiRequestInit) {
  if (shouldRefreshBeforeRequest(input)) {
    const refreshed = await refreshOnce()

    if (!refreshed) {
      await handleUnauthorized(undefined, {
        code: 'AUTH_SESSION_EXPIRED',
        message: 'Your session has expired. Please log in again.',
      })

      return new Response(
        JSON.stringify({
          code: 'AUTH_SESSION_EXPIRED',
          message: 'Your session has expired. Please log in again.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }
  }

  const response = await fetch(input, {
    ...init,
    headers: buildAuthHeaders(init?.headers),
  })

  if (response.status === 401 && window.location.pathname !== routePaths.login) {
    const envelope = await parseUnauthorizedEnvelope(response)

    if (envelope?.code !== 'AUTH_REAUTH_REQUIRED' && !isPublicAuthPath(input)) {
      const refreshed = await refreshOnce()

      if (refreshed) {
        const retryResponse = await fetch(input, {
          ...init,
          headers: buildAuthHeaders(init?.headers),
        })

        if (retryResponse.status === 401) {
          await handleUnauthorized(retryResponse)
        }

        return retryResponse
      }
    }

    await handleUnauthorized(response, envelope)
  }

  return response
}

export const apiClient = {
  request,
  handleUnauthorized,
}
