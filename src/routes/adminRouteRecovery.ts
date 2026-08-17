import type { NavigationItem } from '../config/navigation'
import { navigationItems } from '../config/navigation'
import { routePaths } from '../config/routes'
import { buildPathWithQueryParams } from '../utils/buildQueryParams'

const fallbackOrigin = 'https://admin.servicegram.local'

export interface AccessDeniedContext {
  from?: string
  permission?: string
}

export function humanizeRouteCode(value: string | null | undefined) {
  if (!value) {
    return 'Unknown'
  }

  return value
    .replaceAll(/[_:-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function readPathname(path: string | null | undefined) {
  if (!path) {
    return ''
  }

  try {
    return new URL(path, fallbackOrigin).pathname
  } catch {
    return path.split('?')[0]?.split('#')[0] ?? ''
  }
}

function canOpenNavigationItem(
  item: NavigationItem,
  can: (permission: string) => boolean,
) {
  if (item.anyPermission?.length) {
    return item.anyPermission.some((permission) => can(permission))
  }

  return item.alwaysVisible || !item.permission || can(item.permission)
}

export function getAccessibleNavigationItems(can: (permission: string) => boolean) {
  return navigationItems.filter((item) => canOpenNavigationItem(item, can))
}

export function getPreferredRecoveryItem(can: (permission: string) => boolean) {
  const accessibleItems = getAccessibleNavigationItems(can)

  return (
    accessibleItems.find((item) => item.href === routePaths.dashboard) ??
    accessibleItems.find((item) => item.href === routePaths.profile) ??
    accessibleItems[0]
  )
}

export function resolveNavigationItemForPath(path: string | null | undefined) {
  const pathname = readPathname(path)

  return [...navigationItems]
    .sort((first, second) => second.href.length - first.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
}

export function resolveNavigationItemForPermission(permission: string | null) {
  if (!permission) {
    return undefined
  }

  return navigationItems.find((item) => item.permission === permission)
}

export function buildAccessDeniedPath({
  from,
  permission,
}: AccessDeniedContext) {
  return buildPathWithQueryParams(routePaths.accessDenied, {
    from,
    permission,
  })
}
