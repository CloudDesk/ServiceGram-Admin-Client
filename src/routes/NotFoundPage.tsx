import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { ErrorLayout } from '../layouts/ErrorLayout'
import { routePaths } from '../config/routes'

export function NotFoundPage() {
  return (
    <div className="relative">
      <ErrorLayout
        description="The route may be invalid or the mock module foundation for this path is not available yet."
        title="Page not found"
      />
      <div className="absolute inset-x-0 top-[60%] flex justify-center">
        <Link to={routePaths.dashboard}>
          <Button variant="secondary">Open dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
