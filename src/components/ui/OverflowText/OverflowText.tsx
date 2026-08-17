import { createElement, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../../utils/cn'

type OverflowTextElement = 'span' | 'p' | 'div' | 'h2' | 'h3'

interface OverflowTextProps extends HTMLAttributes<HTMLElement> {
  as?: OverflowTextElement
  children: ReactNode
  title?: string
}

function resolveTextTitle(children: ReactNode) {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }

  return undefined
}

export function OverflowText({
  as = 'span',
  children,
  className,
  title,
  ...props
}: OverflowTextProps) {
  const fullText = title ?? resolveTextTitle(children)

  return createElement(
    as,
    {
      className: cn('min-w-0 truncate', className),
      title: fullText || undefined,
      ...props,
    },
    children,
  )
}
