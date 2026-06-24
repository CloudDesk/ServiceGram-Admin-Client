import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Mail, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { AuthLayout } from '../../../layouts/AuthLayout'
import { routePaths } from '../../../config/routes'
import { FormErrorSummary } from '../../../components/feedback/FormErrorSummary'
import { useToast } from '../../../hooks/useToast'
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '../schemas/auth.schema'
import { AuthActionServiceError } from '../types/auth.types'
import { useForgotPassword } from '../hooks/useForgotPassword'

const DEFAULT_VALUES: ForgotPasswordFormValues = {
  email: '',
}

export function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const { pushToast } = useToast()
  const mutation = useForgotPassword()
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: DEFAULT_VALUES,
  })
  const emailField = register('email')

  return (
    <AuthLayout>
      <form
        className="relative z-10 space-y-4"
        onSubmit={handleSubmit(async (values) => {
          try {
            await mutation.mutateAsync(values)
            setIsSubmitted(true)
            pushToast({
              tone: 'success',
              title: 'Reset request accepted.',
              description: 'Check the admin inbox for the reset link.',
            })
          } catch (error) {
            if (error instanceof AuthActionServiceError) {
              pushToast({
                tone: 'danger',
                title: 'Reset request failed.',
                description: error.message,
              })
            }
          }
        })}
      >
        <div className="space-y-2">
          <h1 className="text-[1.9rem] font-semibold tracking-[-0.05em] text-foreground">
            Reset access
          </h1>
          <p className="text-sm leading-6 text-muted">
            Enter your admin email and we will send a secure reset link if the account is active.
          </p>
        </div>

        {isSubmitted ? (
          <div className="rounded-[1.25rem] border border-border/70 bg-surface/70 p-4 text-sm leading-6 text-muted">
            <div className="flex items-start gap-3">
              <Send className="mt-1 size-4 shrink-0 text-foreground" />
              <p>
                If this email belongs to an active admin account, a reset link will arrive shortly.
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <label
            className="text-[0.8125rem] font-bold tracking-[0.01em] text-foreground"
            htmlFor="recovery-email"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              autoComplete="email"
              className="min-h-12 rounded-[1.125rem] border-border bg-surface/80 pl-11 text-[0.9375rem] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] placeholder:text-muted focus-visible:border-foreground/20 focus-visible:bg-surface focus-visible:ring-foreground/10"
              hasError={Boolean(errors.email)}
              id="recovery-email"
              placeholder="admin@servicegram.in"
              {...emailField}
              onChange={(event) => {
                clearErrors('email')
                mutation.reset()
                setIsSubmitted(false)
                void emailField.onChange(event)
              }}
            />
          </div>
          <FormErrorSummary message={errors.email?.message} />
        </div>

        <FormErrorSummary message={mutation.error?.message} />

        <Button
          className="min-h-[3.25rem] w-full rounded-[1.2rem] bg-foreground text-[0.9375rem] font-extrabold text-primary-foreground shadow-[0_20px_45px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-sidebar hover:shadow-[0_26px_60px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.24)]"
          isLoading={mutation.isPending}
          type="submit"
          variant="ghost"
        >
          Send reset link
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
