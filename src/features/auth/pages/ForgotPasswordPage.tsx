import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { AuthLayout } from '../../../layouts/AuthLayout'
import { routePaths } from '../../../config/routes'

export function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold">Forgot Password</h1>
          <p className="mt-2 text-sm text-muted">
            Placeholder recovery screen for the foundation build.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="recovery-email">
            Email
          </label>
          <Input id="recovery-email" placeholder="admin@servicegram.local" />
        </div>
        <Button className="w-full" variant="secondary">
          Send Reset Link
        </Button>
        <Link className="text-sm text-primary" to={routePaths.login}>
          Back to login
        </Link>
      </div>
    </AuthLayout>
  )
}
