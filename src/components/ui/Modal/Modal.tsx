import { X } from 'lucide-react'
import { useUiStore } from '../../../store/uiStore'

export function ModalRoot() {
  const modalContent = useUiStore((state) => state.modalContent)
  const closeModal = useUiStore((state) => state.closeModal)

  if (!modalContent) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-overlay p-4">
      <div className="w-full max-w-2xl rounded-surface bg-surface shadow-[var(--shadow-overlay)]">
        <div className="flex items-center justify-end border-b border-border p-3">
          <button
            aria-label="Close modal"
            className="text-muted transition-colors hover:text-foreground"
            onClick={closeModal}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-6">{modalContent}</div>
      </div>
    </div>
  )
}
