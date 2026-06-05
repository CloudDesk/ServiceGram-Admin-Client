import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { storageKeys } from '../lib/storage'
import { safeJsonParse } from '../utils/safeJson'
import type { AppUser } from '../types/common.types'
import { useAuthStore } from '../store/authStore'

export function AuthProvider({ children }: PropsWithChildren) {
  const setHydrated = useAuthStore((state) => state.setHydrated)
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    const persistedSession = safeJsonParse<AppUser | null>(
      window.localStorage.getItem(storageKeys.authSession),
      null,
    )

    setUser(persistedSession)
    setHydrated(true)
  }, [setHydrated, setUser])

  return children
}
