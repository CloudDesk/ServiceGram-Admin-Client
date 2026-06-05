import { useAuthStore } from '../../../store/authStore'

export function useAuthSession() {
  const isHydrated = useAuthStore((state) => state.isHydrated)
  const user = useAuthStore((state) => state.user)

  return {
    isHydrated,
    user,
  }
}
