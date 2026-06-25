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
