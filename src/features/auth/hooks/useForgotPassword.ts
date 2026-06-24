import { useMutation } from '@tanstack/react-query'
import { authService } from '../services/auth.service'

export function useForgotPassword() {
  return useMutation({
    mutationFn: authService.requestPasswordReset,
  })
}
