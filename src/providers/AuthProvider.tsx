import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { storageKeys } from '../lib/storage'
import { safeJsonParse } from '../utils/safeJson'
import type { AuthSession } from '../features/auth/types/auth.types'
import { useAuthStore } from '../store/authStore'

export function AuthProvider({ children }: PropsWithChildren) {
  const setHydrated = useAuthStore((state) => state.setHydrated)
  const setSession = useAuthStore((state) => state.setSession)

  useEffect(() => {
    const persistedSession = safeJsonParse<AuthSession | null>(
      window.localStorage.getItem(storageKeys.authSession),
      null,
    )

    setSession(persistedSession)
    setHydrated(true)
  }, [setHydrated, setSession])

  return children
}
