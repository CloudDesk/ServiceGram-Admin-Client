import { MoreHorizontal } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../../utils/cn";

export interface RowActionMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: "default" | "danger";
  onClick: () => void;
}

export interface RowActionMenuProps {
  items: RowActionMenuItem[];
  /** Read by screen readers on the trigger button — name the row, e.g. "More actions for SG-1029". */
  ariaLabel: string;
  className?: string;
}

/**
 * The row-level overflow ("⋯") menu — click-outside and Escape close it,
 * it's absolutely positioned under the trigger. This exact behavior was
 * hand-built once per list page (Orders, Customers, Refunds, Payouts,
 * Content); this is the one copy the rest can move onto.
 */
export function RowActionMenu({ ariaLabel, className, items }: RowActionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!items.length) {
    return null;
  }

  return (
    <div className={cn("relative inline-flex", className)} ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-[0.4rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="size-3.5" />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-8 z-40 min-w-[11rem] rounded-[0.6rem] border border-border bg-surface p-1 shadow-lg"
          role="menu"
        >
          {items.map((item) => (
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-[0.45rem] px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted",
                item.tone === "danger" && "text-danger",
              )}
              key={item.key}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
