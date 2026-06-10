const rawBaseUrl = import.meta.env.VITE_BASE_URL as string | undefined

if (!rawBaseUrl) {
  throw new Error('VITE_BASE_URL is not configured.')
}

const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '')

export const apiConfig = {
  baseUrl: normalizedBaseUrl,
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${apiConfig.baseUrl}${normalizedPath}`
}
