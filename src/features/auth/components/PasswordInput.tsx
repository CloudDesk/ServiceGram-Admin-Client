import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Input } from '../../../components/ui/Input'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  hasError?: boolean
}

export function PasswordInput({
  hasError = false,
  onBlur,
  onChange,
  value,
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        hasError={hasError}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter your password"
        type={isVisible ? 'text' : 'password'}
        value={value}
      />
      <button
        aria-label={isVisible ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        onClick={() => setIsVisible((value) => !value)}
        type="button"
      >
        {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
