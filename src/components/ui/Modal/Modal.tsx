import { X } from "lucide-react";
import { useUiStore } from "../../../store/uiStore";

export function ModalRoot() {
  const modalContent = useUiStore((state) => state.modalContent);
  const closeModal = useUiStore((state) => state.closeModal);

  if (!modalContent) {
    return null;
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="premium-modal-surface max-w-2xl">
        <div className="flex items-center justify-end border-b border-adaptive p-3">
          <button
            aria-label="Close modal"
            className="btn-icon"
            onClick={closeModal}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-6">{modalContent}</div>
      </div>
    </div>
  );
}
