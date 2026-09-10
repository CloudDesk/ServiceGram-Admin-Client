import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../../utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

/**
 * Compact control used for filter bars sitting inside a DataList's filter
 * panel (city, date-range, etc). Several list pages (Vendors, Payments,
 * Refunds, Payouts, Orders) each re-typed this literal instead of sharing it —
 * import this constant instead of pasting the string again.
 */
export const filterInputClass =
  "h-9 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "form-input",
        hasError &&
          "border-[color:var(--adaptive-danger-text)] focus-visible:border-[color:var(--adaptive-danger-text)] focus-visible:ring-[color:var(--adaptive-danger-bg)]",
        className,
      )}
      {...props}
    />
  );
});
