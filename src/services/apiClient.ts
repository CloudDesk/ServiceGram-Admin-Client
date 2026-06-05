export const apiClient = {
  get: async () => {
    throw new Error('API integration is not enabled in mock mode.')
  },
}
