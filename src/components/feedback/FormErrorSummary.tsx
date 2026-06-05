interface FormErrorSummaryProps {
  message?: string
}

export function FormErrorSummary({ message }: FormErrorSummaryProps) {
  if (!message) {
    return null
  }

  return <p className="text-sm text-danger">{message}</p>
}
