import { TriangleAlert } from 'lucide-react'

interface InlineAlertProps {
  message: string
}

export function InlineAlert({ message }: InlineAlertProps) {
  return (
    <div className="flex items-start gap-2 rounded-control border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
      <TriangleAlert className="mt-0.5 size-4" />
      <span>{message}</span>
    </div>
  )
}
