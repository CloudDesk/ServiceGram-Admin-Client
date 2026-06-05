import { CheckCircle2, Info, OctagonAlert, TriangleAlert, X } from 'lucide-react'
import { useUiStore } from '../../../store/uiStore'
import { cn } from '../../../utils/cn'

const iconMap = {
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: OctagonAlert,
  info: Info,
} as const

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts)
  const dismissToast = useUiStore((state) => state.dismissToast)

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.tone]

        return (
          <div
            className={cn(
              'pointer-events-auto rounded-surface border border-border bg-surface p-4 shadow-[var(--shadow-overlay)]',
            )}
            key={toast.id}
          >
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 size-5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-sm text-muted">{toast.description}</p>
                ) : null}
              </div>
              <button
                aria-label="Dismiss notification"
                className="text-muted transition-colors hover:text-foreground"
                onClick={() => dismissToast(toast.id)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
