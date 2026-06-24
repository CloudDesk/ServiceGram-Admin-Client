import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must contain at least 8 characters.'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
})

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

const strongPasswordMessage =
  'Use at least 12 characters with uppercase, lowercase, number, and symbol.'

export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(12, strongPasswordMessage)
      .regex(/[a-z]/, strongPasswordMessage)
      .regex(/[A-Z]/, strongPasswordMessage)
      .regex(/\d/, strongPasswordMessage)
      .regex(/[^A-Za-z0-9]/, strongPasswordMessage),
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
