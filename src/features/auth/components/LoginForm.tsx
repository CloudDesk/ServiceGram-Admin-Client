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
import { type LoginFormValues, loginSchema } from '../schemas/auth.schema'

export function LoginForm() {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const mutation = useLogin()
  const {
    formState: { errors },
    handleSubmit,
    register,
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
        await mutation.mutateAsync(values)
        pushToast({
          tone: 'success',
          title: 'Signed in successfully.',
          description: 'Loading your admin workspace.',
        })
        navigate(routePaths.dashboard)
      })}
    >
      <div className="space-y-2">
        <h1 className="text-[1.9rem] font-semibold tracking-[-0.05em] text-[#111111]">
          Welcome back
        </h1>
      </div>

      <div className="space-y-2">
        <label
          className="text-[0.8125rem] font-bold tracking-[0.01em] text-[#4f4a44]"
          htmlFor="email"
        >
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8f887f]" />
          <Input
            className="min-h-12 rounded-[1.125rem] border-[#161616]/10 bg-white/75 pl-11 text-[0.9375rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] placeholder:text-[#9a948c] focus-visible:border-[#111111]/25 focus-visible:bg-white/95 focus-visible:ring-[rgba(17,17,17,0.055)]"
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
          className="text-[0.8125rem] font-bold tracking-[0.01em] text-[#4f4a44]"
          htmlFor="password"
        >
          Password
        </label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-[#8f887f]" />
          <PasswordInput
            hasError={Boolean(errors.password)}
            id="password"
            inputClassName="min-h-12 rounded-[1.125rem] border-[#161616]/10 bg-white/75 pl-11 text-[0.9375rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] placeholder:text-[#9a948c] focus-visible:border-[#111111]/25 focus-visible:bg-white/95 focus-visible:ring-[rgba(17,17,17,0.055)]"
            onBlur={() => undefined}
            onChange={(value) => setValue('password', value, { shouldValidate: true })}
            placeholder="Enter your password"
            value={watch('password')}
          />
        </div>
        <FormErrorSummary message={errors.password?.message} />
      </div>

      <FormErrorSummary message={mutation.error?.message} />

      <div className="flex items-center justify-between gap-3 text-[0.8125rem] text-[#6b665f]">
        <label className="inline-flex items-center gap-2">
          <input
            className="h-4 w-4 rounded border border-[#161616]/15 accent-[#111111]"
            type="checkbox"
          />
          <span>Remember me</span>
        </label>
        <Link
          className="font-bold text-[#111111] transition hover:text-[#4b4540]"
          to={routePaths.forgotPassword}
        >
          Forgot password?
        </Link>
      </div>

      <Button
        className="min-h-[3.25rem] w-full rounded-[1.2rem] bg-[#111111] text-[0.9375rem] font-extrabold text-white shadow-[0_20px_45px_rgba(17,17,17,0.24),inset_0_1px_0_rgba(255,255,255,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_26px_60px_rgba(17,17,17,0.28),inset_0_1px_0_rgba(255,255,255,0.24)]"
        isLoading={mutation.isPending}
        type="submit"
      >
        Sign in to Admin Portal
      </Button>

      <div className="rounded-[1.25rem] border border-[#111111]/6 bg-white/50 p-3 text-[0.8125rem] leading-5 text-[#68625b]">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#111111]" />
          <p>
            Secured with encrypted sessions, role-based access, audit logs and
            admin-level verification.
          </p>
        </div>
      </div>

      <p className="text-[0.8125rem] leading-5 text-[#5f5a52]">
        Use{' '}
        <span className="font-semibold text-[#111111]">aparna@servicegram.local</span>{' '}
        and <span className="font-semibold text-[#111111]">Password@123</span> for local access.
      </p>
    </form>
  )
}
