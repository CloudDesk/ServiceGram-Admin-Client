import type { InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Input } from '../../../components/ui/Input'
import { cn } from '../../../utils/cn'

interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  hasError?: boolean
  inputClassName?: string
  onChange: (value: string) => void
  value: string
}

export function PasswordInput({
  hasError = false,
  onBlur,
  onChange,
  value,
  className,
  inputClassName,
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className={cn('relative', className)}>
      <Input
        className={cn('pr-11', inputClassName)}
        hasError={hasError}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        type={isVisible ? 'text' : 'password'}
        value={value}
        {...props}
      />
      <button
        aria-label={isVisible ? 'Hide password' : 'Show password'}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7f786f] transition hover:text-[#111111]"
        onClick={() => setIsVisible((value) => !value)}
        type="button"
      >
        {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
