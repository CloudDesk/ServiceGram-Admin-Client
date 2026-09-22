import { MoreHorizontal } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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

const MENU_WIDTH = 176;
const MENU_GAP = 8;
const MENU_PADDING = 12;
const MENU_MIN_HEIGHT = 96;
const MENU_MAX_HEIGHT = 320;

interface MenuPosition {
  top: number;
  right: number;
  maxHeight: number;
}

/**
 * The row-level overflow ("⋯") menu — click-outside and Escape close it. This
 * exact behavior was hand-built once per list page (Orders, Customers, Refunds,
 * Payouts, Content); this is the one copy the rest can move onto.
 *
 * The menu is portaled to `document.body` and positioned with `getBoundingClientRect`
 * rather than a CSS-absolute child of the trigger: every row in a `DataList` has its
 * own sticky trailing cell, and `position: sticky` creates a new stacking context per
 * row. A menu opened from row N that visually extends into row N+1 would otherwise be
 * painted *behind* row N+1's own sticky cell — its z-index can't escape row N's
 * stacking context to compete with a sibling row's. Escaping to `document.body` sidesteps
 * that entirely.
 */
export function RowActionMenu({ ariaLabel, className, items }: RowActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    setOpen(false);
    setPosition(null);
  };

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const availableBelow = window.innerHeight - rect.bottom - MENU_PADDING;
    const availableAbove = rect.top - MENU_PADDING;
    const shouldOpenAbove =
      availableBelow < MENU_MIN_HEIGHT && availableAbove > availableBelow;
    const availableSpace = shouldOpenAbove ? availableAbove : availableBelow;
    const maxHeight = Math.min(
      MENU_MAX_HEIGHT,
      Math.max(MENU_MIN_HEIGHT, availableSpace - MENU_GAP),
    );
    const top = shouldOpenAbove
      ? Math.max(MENU_PADDING, rect.top - MENU_GAP - maxHeight)
      : Math.min(
          Math.max(MENU_PADDING, rect.bottom + MENU_GAP),
          window.innerHeight - MENU_PADDING - maxHeight,
        );
    const maxRight = Math.max(
      MENU_PADDING,
      window.innerWidth - MENU_PADDING - MENU_WIDTH,
    );
    const right = Math.min(
      Math.max(MENU_PADDING, window.innerWidth - rect.right),
      maxRight,
    );

    setPosition({ maxHeight, right, top });
  };

  useEffect(() => {
    if (!open) return undefined;

    updatePosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (
        target &&
        (triggerRef.current?.contains(target) || menuRef.current?.contains(target))
      ) {
        return;
      }

      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (!items.length) {
    return null;
  }

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        // 32px is the largest size that still fits every row density
        // (compact rows are 32px tall) without the tap target overlapping
        // the row above or below — the old size-6.5 (26px) box was closer
        // to a 24px touch target than the ~44px recommended minimum.
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-[0.4rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[1000] min-w-[11rem] overflow-y-auto rounded-[0.6rem] border border-border bg-surface p-1 shadow-lg"
              ref={menuRef}
              role="menu"
              style={{
                maxHeight: position.maxHeight,
                right: position.right,
                top: position.top,
                width: MENU_WIDTH,
              }}
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
                    close();
                    item.onClick();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
