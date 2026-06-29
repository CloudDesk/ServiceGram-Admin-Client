import { routePaths } from '../../../config/routes'

const PUBLIC_AUTH_PATHS = new Set<string>([
  routePaths.login,
  routePaths.forgotPassword,
  routePaths.resetPassword,
])

function toSameOriginUrl(path: string) {
  try {
    return new URL(path, window.location.origin)
  } catch {
    return null
  }
}

export function safeAuthRedirectPath(path: string | null | undefined) {
  const trimmedPath = path?.trim()

  if (!trimmedPath || !trimmedPath.startsWith('/') || trimmedPath.startsWith('//')) {
    return routePaths.dashboard
  }

  const url = toSameOriginUrl(trimmedPath)

  if (!url || url.origin !== window.location.origin) {
    return routePaths.dashboard
  }

  const pathname = url.pathname

  if (pathname === '/') {
    return routePaths.dashboard
  }

  if (PUBLIC_AUTH_PATHS.has(pathname)) {
    return routePaths.dashboard
  }

  if (
    pathname === routePaths.accessDenied ||
    pathname === routePaths.notFound ||
    pathname.startsWith('/app/')
  ) {
    return `${pathname}${url.search}${url.hash}`
  }

  return routePaths.dashboard
}
