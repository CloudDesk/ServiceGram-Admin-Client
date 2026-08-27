import { LoaderCircle } from 'lucide-react'
import { cva } from 'class-variance-authority'
import type { ButtonProps } from './Button.types'
import { cn } from '../../../utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-control font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        danger: 'bg-danger text-primary-foreground hover:bg-danger/90',
        ghost: 'bg-transparent text-foreground hover:bg-secondary',
      },
      size: {
        xs: 'h-6.5 min-h-0 px-2 text-xs rounded-[0.4rem]',
        sm: 'h-7.5 min-h-0 px-2.5 text-xs',
        md: 'min-h-10 px-4 text-sm',
        lg: 'min-h-11 px-5 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export function Button({
  children,
  className,
  isLoading = false,
  size,
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
      {children}
    </button>
  )
}
