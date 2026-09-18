import { Info } from 'lucide-react'
import { cn } from '../../../utils/cn'

export interface InfoTooltipProps {
  text: string
  className?: string
}

export function InfoTooltip({ className, text }: InfoTooltipProps) {
  return (
    <span
      className={cn(
        'inline-flex size-4 shrink-0 cursor-help items-center justify-center text-muted hover:text-foreground',
        className,
      )}
      tabIndex={0}
      title={text}
    >
      <Info className="size-3.5" />
      <span className="sr-only">{text}</span>
    </span>
  )
}
