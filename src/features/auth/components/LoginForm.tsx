import { zodResolver } from '@hookform/resolvers/zod'
import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { FormErrorSummary } from '../../../components/feedback/FormErrorSummary'
import { routePaths } from '../../../config/routes'
import { useToast } from '../../../hooks/useToast'
import { PasswordInput } from './PasswordInput'
import { useLogin } from '../hooks/useLogin'
import { LoginServiceError } from '../types/auth.types'
import { type LoginFormValues, loginSchema } from '../schemas/auth.schema'

const ADMIN_DEVICE_ID = 'admin-web-macbook-pro'

function hasFieldErrors(
  details: unknown,
): details is {
  fieldErrors: Array<{
    field: string
    code: string
    message: string
  }>
} {
  return Boolean(
    details &&
      typeof details === 'object' &&
      'fieldErrors' in details &&
      Array.isArray((details as { fieldErrors?: unknown }).fieldErrors),
  )
}

export function LoginForm() {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const mutation = useLogin()
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
    setValue,
    watch,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'aparna@servicegram.local',
      password: 'Password@123',
    },
  })

  return (
    <form
      className="relative z-10 space-y-4"
      onSubmit={handleSubmit(async (values) => {
        try {
          await mutation.mutateAsync({
            ...values,
            deviceId: ADMIN_DEVICE_ID,
          })

          pushToast({
            tone: 'success',
            title: 'Signed in successfully.',
            description: 'Loading your admin workspace.',
          })
          navigate(routePaths.dashboard)
        } catch (error) {
          if (error instanceof LoginServiceError) {
            if (error.status === 400) {
              const details = error.response?.details

              if (hasFieldErrors(details)) {
                details.fieldErrors.forEach((fieldError) => {
                  if (fieldError.field === 'email' || fieldError.field === 'password') {
                    setError(fieldError.field, {
                      type: fieldError.code,
                      message: fieldError.message,
                    })
                  }
                })
              }

              return
            }

            if (error.status === 401) {
              pushToast({
                tone: 'danger',
                title: 'Login failed.',
                description:
                  error.response?.message ?? 'Invalid email or password.',
              })
            }

            return
          }
        }
      })}
    >
      <div className="space-y-2">
        <h1 className="text-[1.9rem] font-semibold tracking-[-0.05em] text-foreground">
          Welcome back
        </h1>
      </div>

      <div className="space-y-2">
        <label
          className="text-[0.8125rem] font-bold tracking-[0.01em] text-foreground"
          htmlFor="email"
        >
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            className="min-h-12 rounded-[1.125rem] border-border bg-surface/80 pl-11 text-[0.9375rem] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] placeholder:text-muted focus-visible:border-foreground/20 focus-visible:bg-surface focus-visible:ring-foreground/10"
            hasError={Boolean(errors.email)}
            id="email"
            placeholder="aparna@servicegram.local"
            {...register('email')}
          />
        </div>
        <FormErrorSummary message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <label
          className="text-[0.8125rem] font-bold tracking-[0.01em] text-foreground"
          htmlFor="password"
        >
          Password
        </label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted" />
          <PasswordInput
            hasError={Boolean(errors.password)}
            id="password"
            inputClassName="min-h-12 rounded-[1.125rem] border-border bg-surface/80 pl-11 text-[0.9375rem] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] placeholder:text-muted focus-visible:border-foreground/20 focus-visible:bg-surface focus-visible:ring-foreground/10"
            onBlur={() => undefined}
            onChange={(value) => setValue('password', value, { shouldValidate: true })}
            placeholder="Enter your password"
            value={watch('password')}
          />
        </div>
        <FormErrorSummary message={errors.password?.message} />
      </div>

      <FormErrorSummary message={mutation.error?.message} />

      <div className="flex items-center justify-between gap-3 text-[0.8125rem] text-muted">
        <label className="inline-flex items-center gap-2">
          <input
            className="h-4 w-4 rounded border border-border accent-foreground"
            type="checkbox"
          />
          <span>Remember me</span>
        </label>
        <Link
          className="font-bold text-foreground transition hover:text-muted"
          to={routePaths.forgotPassword}
        >
          Forgot password?
        </Link>
      </div>

      <Button
        className="min-h-[3.25rem] w-full rounded-[1.2rem] bg-foreground text-[0.9375rem] font-extrabold text-primary-foreground shadow-[0_20px_45px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-sidebar hover:shadow-[0_26px_60px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.24)]"
        isLoading={mutation.isPending}
        type="submit"
        variant="ghost"
      >
        Sign in to Admin Portal
      </Button>

      <div className="rounded-[1.25rem] border border-border/70 bg-surface/60 p-3 text-[0.8125rem] leading-5 text-muted">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
          <p>
            Secured with encrypted sessions, role-based access, audit logs and
            admin-level verification.
          </p>
        </div>
      </div>

      <p className="text-[0.8125rem] leading-5 text-muted">
        Use{' '}
        <span className="font-semibold text-foreground">aparna@servicegram.local</span>{' '}
        and <span className="font-semibold text-foreground">Password@123</span> for local access.
      </p>
    </form>
  )
}
