import { routePaths } from '../config/routes'
import { storageKeys } from '../lib/storage'
import { useAuthStore } from '../store/authStore'

type ApiRequestInit = RequestInit
type AuthRedirectReason = 'expired' | 'reauth'

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

function safeRedirectPath(path: string | null | undefined) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return routePaths.dashboard
  }

  if (path.startsWith(routePaths.login)) {
    return routePaths.dashboard
  }

  return path
}

function currentRedirectPath() {
  return safeRedirectPath(
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

async function handleUnauthorized(response?: Response) {
  const { clearSession } = useAuthStore.getState()
  const envelope = await parseUnauthorizedEnvelope(response)
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
  const response = await fetch(input, {
    ...init,
    headers: buildAuthHeaders(init?.headers),
  })

  if (response.status === 401 && window.location.pathname !== routePaths.login) {
    await handleUnauthorized(response)
  }

  return response
}

export const apiClient = {
  request,
  handleUnauthorized,
}
