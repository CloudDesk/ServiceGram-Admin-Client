import { useMutation } from '@tanstack/react-query'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../../../store/authStore'

export function useLogin() {
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: authService.login,
    onSuccess: (response) => {
      setUser(response.user)
    },
  })
}
