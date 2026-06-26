import { create } from 'zustand'
import { storageKeys } from '../lib/storage'
import type { AppUser } from '../types/common.types'
import type { AuthSession } from '../features/auth/types/auth.types'

interface AuthState {
  isHydrated: boolean
  session: AuthSession | null
  user: AppUser | null
  accessToken: string | null
  permissions: string[]
  setHydrated: (value: boolean) => void
  setSession: (session: AuthSession | null) => void
  clearSession: () => void
  can: (permission: string) => boolean
}

function normalizeRoleCode(roleCode: string) {
  return roleCode.trim().replace(/[-\s]+/g, '_').toUpperCase()
}

function isSuperAdmin(session: AuthSession | null) {
  return Boolean(
    session?.admin.roleCodes.some(
      (roleCode) => normalizeRoleCode(roleCode) === 'SUPER_ADMIN',
    ),
  )
}

function persistSession(session: AuthSession | null) {
  if (!session) {
    window.localStorage.removeItem(storageKeys.authSession)
    return
  }

  window.localStorage.setItem(storageKeys.authSession, JSON.stringify(session))
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isHydrated: false,
  session: null,
  user: null,
  accessToken: null,
  permissions: [],
  setHydrated: (isHydrated) => set({ isHydrated }),
  setSession: (session) => {
    persistSession(session)

    set({
      session,
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      permissions: session?.user.permissions ?? [],
    })
  },
  clearSession: () => {
    persistSession(null)

    set({
      session: null,
      user: null,
      accessToken: null,
      permissions: [],
    })
  },
  can: (permission) => {
    if (isSuperAdmin(get().session)) {
      return true
    }

    return get().permissions.includes(permission)
  },
}))
