import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { storageKeys } from '../lib/storage'
import { safeJsonParse } from '../utils/safeJson'
import type { AuthSession } from '../features/auth/types/auth.types'
import { isAuthSessionUsable } from '../features/auth/utils/session'
import { useAuthStore } from '../store/authStore'

export function AuthProvider({ children }: PropsWithChildren) {
  const setHydrated = useAuthStore((state) => state.setHydrated)
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)

  useEffect(() => {
    const persistedSession = safeJsonParse<AuthSession | null>(
      window.localStorage.getItem(storageKeys.authSession),
      null,
    )

    if (isAuthSessionUsable(persistedSession)) {
      setSession(persistedSession)
    } else {
      clearSession()
    }

    setHydrated(true)
  }, [clearSession, setHydrated, setSession])

  return children
}
