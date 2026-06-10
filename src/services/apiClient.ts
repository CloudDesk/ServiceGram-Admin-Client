import { routePaths } from '../config/routes'
import { useAuthStore } from '../store/authStore'

type ApiRequestInit = RequestInit

function handleUnauthorized() {
  const { clearSession } = useAuthStore.getState()

  clearSession()

  if (window.location.pathname !== routePaths.login) {
    window.location.replace(routePaths.login)
  }
}

async function request(input: string, init?: ApiRequestInit) {
  const response = await fetch(input, init)

  if (response.status === 401) {
    handleUnauthorized()
  }

  return response
}

export const apiClient = {
  request,
  handleUnauthorized,
}
