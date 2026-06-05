import { create } from 'zustand'
import type { AppUser, PermissionKey } from '../types/common.types'

interface AuthState {
  isHydrated: boolean
  user: AppUser | null
  setUser: (user: AppUser | null) => void
  setHydrated: (value: boolean) => void
  can: (permission: PermissionKey) => boolean
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isHydrated: false,
  user: null,
  setUser: (user) => set({ user }),
  setHydrated: (isHydrated) => set({ isHydrated }),
  can: (permission) => get().user?.permissions.includes(permission) ?? false,
  logout: () => set({ user: null, isHydrated: true }),
}))
