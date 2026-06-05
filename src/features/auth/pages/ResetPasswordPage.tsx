import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { AuthLayout } from '../../../layouts/AuthLayout'
import { routePaths } from '../../../config/routes'

export function ResetPasswordPage() {
  return (
    <AuthLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold">Reset Password</h1>
          <p className="mt-2 text-sm text-muted">
            Placeholder password reset screen for the foundation build.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="new-password">
            New password
          </label>
          <Input id="new-password" type="password" />
        </div>
        <Button className="w-full">Save New Password</Button>
        <Link className="text-sm text-primary" to={routePaths.login}>
          Back to login
        </Link>
      </div>
    </AuthLayout>
  )
}
