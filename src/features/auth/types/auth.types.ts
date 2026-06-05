import type { AppUser } from '../../../types/common.types'

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  user: AppUser
  token: string
}
