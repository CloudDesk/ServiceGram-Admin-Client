import { X } from 'lucide-react'
import { useUiStore } from '../../../store/uiStore'

export function DrawerRoot() {
  const drawerContent = useUiStore((state) => state.drawerContent)
  const closeDrawer = useUiStore((state) => state.closeDrawer)

  if (!drawerContent) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-overlay">
      <div className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-[var(--shadow-overlay)]">
        <div className="flex items-center justify-end border-b border-border p-3">
          <button
            aria-label="Close drawer"
            className="text-muted transition-colors hover:text-foreground"
            onClick={closeDrawer}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{drawerContent}</div>
      </div>
    </div>
  )
}
