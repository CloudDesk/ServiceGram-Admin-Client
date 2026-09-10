import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../utils/cn";
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

const modalSizeClass = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-xl",
  xl: "max-w-2xl",
} as const;

export interface ModalProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  size?: keyof typeof modalSizeClass;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * The dialog shell every feature-module action/edit modal already hand-builds
 * (premium-overlay backdrop, rounded card, title/description header, X close
 * button, optional footer). Pulling it out here means a visual or a11y fix
 * lands once instead of once per module.
 */
export function Modal({
  children,
  className,
  closeDisabled = false,
  description,
  footer,
  onClose,
  size = "md",
  title,
}: ModalProps) {
  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div
        className={cn(
          "w-full rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]",
          modalSizeClass[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="text-sm leading-6 text-muted">{description}</p>
            ) : null}
          </div>
          <button
            aria-label={`Close ${title}`}
            className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            disabled={closeDisabled}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4">{children}</div>

        {footer ? (
          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
