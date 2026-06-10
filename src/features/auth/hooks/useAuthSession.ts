import { useAuthStore } from '../../../store/authStore'

export function useAuthSession() {
  const isHydrated = useAuthStore((state) => state.isHydrated)
  const user = useAuthStore((state) => state.user)
  const accessToken = useAuthStore((state) => state.accessToken)
  const permissions = useAuthStore((state) => state.permissions)

  return {
    isHydrated,
    user,
    accessToken,
    permissions,
  }
}
