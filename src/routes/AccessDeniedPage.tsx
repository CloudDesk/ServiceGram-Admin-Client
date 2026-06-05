import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { ErrorLayout } from '../layouts/ErrorLayout'
import { routePaths } from '../config/routes'

export function AccessDeniedPage() {
  return (
    <div className="relative">
      <ErrorLayout
        description="You do not have permission to access this section with the current role."
        title="Access denied"
      />
      <div className="absolute inset-x-0 top-[60%] flex justify-center">
        <Link to={routePaths.dashboard}>
          <Button variant="secondary">Return to dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
