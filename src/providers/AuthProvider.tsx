import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { storageKeys } from '../lib/storage'
import { safeJsonParse } from '../utils/safeJson'
import { adminUserService } from '../features/admin-users/services/adminUser.service'
import type { AuthSession } from '../features/auth/types/auth.types'
import {
  isAuthSessionUsable,
  mapAdminToUser,
} from '../features/auth/utils/session'
import { useAuthStore } from '../store/authStore'

export function AuthProvider({ children }: PropsWithChildren) {
  const setHydrated = useAuthStore((state) => state.setHydrated)
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)

  useEffect(() => {
    let isCancelled = false
    const persistedSession = safeJsonParse<AuthSession | null>(
      window.localStorage.getItem(storageKeys.authSession),
      null,
    )

    if (persistedSession && isAuthSessionUsable(persistedSession)) {
      const restoredSession = persistedSession

      setSession(restoredSession)

      void adminUserService
        .getMe()
        .then((response) => {
          if (isCancelled) {
            return
          }

          const currentSession = useAuthStore.getState().session
          const currentAdmin = response.data

          if (
            !currentSession ||
            currentSession.admin.adminId !== restoredSession.admin.adminId
          ) {
            return
          }

          const syncedAdmin = {
            adminId: currentAdmin.adminId,
            userId: currentAdmin.userId,
            fullName: currentAdmin.fullName,
            email: currentAdmin.email ?? currentSession.admin.email,
            status: currentAdmin.status,
            roleCodes: currentAdmin.roleCodes,
            permissions: currentAdmin.permissions,
          }

          setSession({
            ...currentSession,
            admin: syncedAdmin,
            user: mapAdminToUser(syncedAdmin),
          })
        })
        .catch(() => {
          // Keep the restored session; request handling will redirect on auth errors.
        })
    } else {
      clearSession()
    }

    setHydrated(true)

    return () => {
      isCancelled = true
    }
  }, [clearSession, setHydrated, setSession])

  return children
}
