import type { PropsWithChildren } from "react";
import { cn } from "../../utils/cn";

export function PageContainer({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("page-content space-y-6", className)}>{children}</div>;
}
