export type IdentifierCapitalization = 'sentence' | 'title'

const ACRONYMS = new Map(
  [
    'api',
    'bps',
    'csv',
    'id',
    'ids',
    'json',
    'mfa',
    'otp',
    'qa',
    'rbac',
    'sla',
    'sms',
    'ui',
    'url',
    'uuid',
  ].map((value) => [value, value.toUpperCase()]),
)

const EXPLICIT_CODE_LABELS: Record<string, string> = {
  APP_CONFIG_DELIVERY_UNAVAILABLE: 'Delivery configuration unavailable',
  APP_CONFIG_LOADED: 'App configuration loaded',
}

const EXPLICIT_PERMISSION_LABELS: Record<string, string> = {
  'admin_users:create': 'Create admin users',
  'feature-flags:update': 'Manage feature flags',
  'release2-finance-settings:update': 'Manage finance settings',
  'settings:update': 'Manage settings',
}

function labelWord(
  token: string,
  index: number,
  capitalization: IdentifierCapitalization,
) {
  const normalized = token.toLowerCase()
  const acronym = ACRONYMS.get(normalized)

  if (acronym) return acronym
  if (capitalization === 'title' || index === 0) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  return normalized
}

/**
 * Converts an API identifier into readable fallback copy without changing the
 * identifier retained by forms, filters, requests, logs, or exports.
 */
export function humanizeIdentifier(
  value: string | null | undefined,
  options: {
    capitalization?: IdentifierCapitalization
    fallback?: string
  } = {},
) {
  const fallback = options.fallback ?? 'Not available'
  const trimmed = value?.trim()

  if (!trimmed) return fallback

  const tokens = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[._:\-/\s]+/)
    .filter(Boolean)

  return tokens
    .map((token, index) =>
      labelWord(token, index, options.capitalization ?? 'sentence'),
    )
    .join(' ')
}

/** Friendly text for a known response code, with a safe humanized fallback. */
export function codeDisplayLabel(value: string | null | undefined) {
  if (!value) return 'Not available'

  return EXPLICIT_CODE_LABELS[value] ?? humanizeIdentifier(value)
}

/** `admin_users:create` -> `Create admin users`. */
export function permissionDisplayLabel(value: string | null | undefined) {
  if (!value) return 'Not available'

  const explicitLabel = EXPLICIT_PERMISSION_LABELS[value]
  if (explicitLabel) return explicitLabel

  const [moduleCode, ...actionParts] = value.split(':')
  const actionCode = actionParts.join(':')

  if (!actionCode) return humanizeIdentifier(moduleCode)

  const action = humanizeIdentifier(actionCode)
  const module = humanizeIdentifier(moduleCode)

  return `${action} in ${module.charAt(0).toLowerCase()}${module.slice(1)}`
}

/** Friendly explanation for a disabled action guarded by a permission. */
export function permissionRequirementLabel(value: string | null | undefined) {
  return `Requires permission: ${permissionDisplayLabel(value)}`
}
