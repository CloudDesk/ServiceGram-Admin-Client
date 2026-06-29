import type { LookupOption } from '../types/lookup.types'

export function buildQueryParams(params: object) {
  const searchParams = new URLSearchParams()

  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const normalizedValues = value
        .map((item) => String(item).trim())
        .filter(Boolean)

      if (normalizedValues.length > 0) {
        searchParams.set(key, normalizedValues.join(','))
      }

      return
    }

    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  return searchParams.toString()
}

export function buildPathWithQueryParams(path: string, params: object) {
  const queryString = buildQueryParams(params)

  return queryString ? `${path}?${queryString}` : path
}

export function readSearchParamList(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

export function readLookupOptionsFromSearchParams(
  searchParams: URLSearchParams,
  valueKey: string,
  labelKey: string,
): LookupOption[] {
  const values = readSearchParamList(searchParams, valueKey)
  const labels = readSearchParamList(searchParams, labelKey)

  return values.map((value, index) => ({
    label: labels[index] ?? value,
    value,
  }))
}
