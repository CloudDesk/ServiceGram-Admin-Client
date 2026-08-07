import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../../utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

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
