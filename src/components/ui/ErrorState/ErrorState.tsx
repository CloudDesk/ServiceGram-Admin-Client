import { TriangleAlert } from 'lucide-react'
import { Button } from '../Button'
import { Card } from '../Card'

interface ErrorStateProps {
  title: string
  description: string
  onRetry?: () => void
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <Card className="flex flex-col items-center gap-4 p-8 text-center">
      <div className="rounded-full bg-danger/10 p-3 text-danger">
        <TriangleAlert className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </Card>
  )
}
