import { storageKeys } from '../../../lib/storage'
import { mockUsers } from '../../../mock/db/users.mock'
import { mockClient } from '../../../services/mockClient'
import type { LoginPayload, LoginResponse } from '../types/auth.types'

export const authMockService = {
  login: async (payload: LoginPayload): Promise<LoginResponse> =>
    mockClient(() => {
      const user = mockUsers.find((item) => item.email === payload.email)

      if (!user || payload.password !== 'Password@123') {
        throw new Error(
          'The email or password is incorrect. Please check and try again.',
        )
      }

      window.localStorage.setItem(storageKeys.authSession, JSON.stringify(user))

      return {
        token: 'mock-jwt-token',
        user,
      }
    }),
}
