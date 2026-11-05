import type { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  icon: ReactNode;
  text: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, text, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-text-subtle">
        {icon}
      </span>
      <p className="max-w-xs text-body text-text-muted">{text}</p>
      {action}
    </div>
  );
}
