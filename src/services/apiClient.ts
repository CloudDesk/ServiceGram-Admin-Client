import { routePaths } from '../config/routes'
import { useAuthStore } from '../store/authStore'

type ApiRequestInit = RequestInit

function buildAuthHeaders(headers?: HeadersInit) {
  const { accessToken } = useAuthStore.getState()
  const merged = new Headers(headers)

  if (accessToken && !merged.has('Authorization')) {
    merged.set('Authorization', `Bearer ${accessToken}`)
  }

  return merged
}

function handleUnauthorized() {
  const { clearSession } = useAuthStore.getState()

  clearSession()

  if (window.location.pathname !== routePaths.login) {
    window.location.replace(routePaths.login)
  }
}

async function request(input: string, init?: ApiRequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: buildAuthHeaders(init?.headers),
  })

  if (response.status === 401) {
    handleUnauthorized()
  }

  return response
}

export const apiClient = {
  request,
  handleUnauthorized,
}
