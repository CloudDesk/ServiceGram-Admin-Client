import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { AuthLayout } from '../../../layouts/AuthLayout'
import { routePaths } from '../../../config/routes'
import { FormErrorSummary } from '../../../components/feedback/FormErrorSummary'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { useToast } from '../../../hooks/useToast'
import { PasswordInput } from '../components/PasswordInput'
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '../schemas/auth.schema'
import { AuthActionServiceError } from '../types/auth.types'
import { useResetPassword } from '../hooks/useResetPassword'

const DEFAULT_VALUES: ResetPasswordFormValues = {
  newPassword: '',
  confirmPassword: '',
}

function readResetToken(searchParams: URLSearchParams) {
  return (
    searchParams.get('token') ??
    searchParams.get('resetToken') ??
    searchParams.get('code') ??
    ''
  )
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const token = readResetToken(searchParams)
  const mutation = useResetPassword()
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    setValue,
    watch,
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: DEFAULT_VALUES,
  })
  const isTokenMissing = token.trim().length === 0

  function clearFieldFeedback(field: keyof ResetPasswordFormValues) {
    clearErrors(field)
    mutation.reset()
  }

  return (
    <AuthLayout>
      <form
        className="relative z-10 space-y-4"
        onSubmit={handleSubmit(async (values) => {
          if (isTokenMissing) {
            return
          }

          try {
            await mutation.mutateAsync({
              token,
              ...values,
            })
            pushToast({
              tone: 'success',
              title: 'Password updated.',
              description: 'Sign in with your new admin password.',
            })
            navigate(routePaths.login, { replace: true })
          } catch (error) {
            if (error instanceof AuthActionServiceError) {
              pushToast({
                tone: 'danger',
                title: 'Reset failed.',
                description: error.message,
              })

              return
            }

            pushToast({
              tone: 'danger',
              title: 'Reset failed.',
              description: 'Please request a fresh reset link and try again.',
            })
          }
        })}
      >
        <div className="space-y-2">
          <h1 className="text-[1.9rem] font-semibold tracking-[-0.05em] text-foreground">
            Set new password
          </h1>
          <p className="text-sm leading-6 text-muted">
            Choose a strong password for your ServiceGram admin account.
          </p>
        </div>

        {isTokenMissing ? (
          <InlineAlert message="This reset link is missing a valid token." />
        ) : null}

        <div className="space-y-2">
          <label
            className="text-[0.8125rem] font-bold tracking-[0.01em] text-foreground"
            htmlFor="new-password"
          >
            New password
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted" />
            <PasswordInput
              autoComplete="new-password"
              hasError={Boolean(errors.newPassword)}
              id="new-password"
              inputClassName="min-h-12 rounded-[1.125rem] border-border bg-surface/80 pl-11 text-[0.9375rem] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] placeholder:text-muted focus-visible:border-foreground/20 focus-visible:bg-surface focus-visible:ring-foreground/10"
              name="newPassword"
              onChange={(value) => {
                clearFieldFeedback('newPassword')
                setValue('newPassword', value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }}
              placeholder="Enter a new password"
              value={watch('newPassword')}
            />
          </div>
          <FormErrorSummary message={errors.newPassword?.message} />
        </div>

        <div className="space-y-2">
          <label
            className="text-[0.8125rem] font-bold tracking-[0.01em] text-foreground"
            htmlFor="confirm-password"
          >
            Confirm password
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted" />
            <PasswordInput
              autoComplete="new-password"
              hasError={Boolean(errors.confirmPassword)}
              id="confirm-password"
              inputClassName="min-h-12 rounded-[1.125rem] border-border bg-surface/80 pl-11 text-[0.9375rem] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] placeholder:text-muted focus-visible:border-foreground/20 focus-visible:bg-surface focus-visible:ring-foreground/10"
              name="confirmPassword"
              onChange={(value) => {
                clearFieldFeedback('confirmPassword')
                setValue('confirmPassword', value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }}
              placeholder="Repeat the new password"
              value={watch('confirmPassword')}
            />
          </div>
          <FormErrorSummary message={errors.confirmPassword?.message} />
        </div>

        <FormErrorSummary message={mutation.error?.message} />

        <Button
          className="min-h-[3.25rem] w-full rounded-[1.2rem] bg-foreground text-[0.9375rem] font-extrabold text-primary-foreground shadow-[0_20px_45px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-sidebar hover:shadow-[0_26px_60px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.24)]"
          disabled={isTokenMissing}
          isLoading={mutation.isPending}
          type="submit"
          variant="ghost"
        >
          Save new password
        </Button>

        <Link
          className="inline-flex items-center gap-2 text-[0.8125rem] font-bold text-foreground transition hover:text-muted"
          to={routePaths.login}
        >
          <ArrowLeft className="size-4" />
          Back to login
        </Link>
      </form>
    </AuthLayout>
  )
}
