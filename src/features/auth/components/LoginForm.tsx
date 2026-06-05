import { zodResolver } from '@hookform/resolvers/zod'
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
      className="space-y-5"
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
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          ServiceGram Release 1
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Admin Portal Login
        </h1>
        <p className="text-sm leading-6 text-muted">
          Use the seeded mock admin account to enter the operational shell.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="email">
          Email
        </label>
        <Input
          hasError={Boolean(errors.email)}
          id="email"
          placeholder="aparna@servicegram.local"
          {...register('email')}
        />
        <FormErrorSummary message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="password">
          Password
        </label>
        <PasswordInput
          hasError={Boolean(errors.password)}
          onBlur={() => undefined}
          onChange={(value) => setValue('password', value, { shouldValidate: true })}
          value={watch('password')}
        />
        <FormErrorSummary message={errors.password?.message} />
      </div>

      <FormErrorSummary message={mutation.error?.message} />

      <Button className="w-full" isLoading={mutation.isPending} type="submit">
        Sign In
      </Button>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>Mock password: `Password@123`</span>
        <Link className="text-primary hover:text-primary-hover" to={routePaths.forgotPassword}>
          Forgot password
        </Link>
      </div>
    </form>
  )
}
