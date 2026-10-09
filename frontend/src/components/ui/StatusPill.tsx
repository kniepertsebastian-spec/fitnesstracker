import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type StatusPillTone = "synced" | "syncing" | "pending" | "offline" | "failed";

const TONES: Record<StatusPillTone, string> = {
  synced: "bg-accent-soft text-accent",
  syncing: "bg-info-soft text-info-text",
  pending: "bg-track text-text-muted",
  offline: "bg-warning-soft text-warning",
  failed: "bg-danger-soft text-danger-text",
};

const DOT: Record<StatusPillTone, string> = {
  synced: "bg-accent",
  syncing: "bg-info",
  pending: "bg-text-faint",
  offline: "bg-warning",
  failed: "bg-danger",
};

export interface StatusPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone: StatusPillTone;
}

/** Sync state pill; the state itself is derived in `SyncStatusIndicator`. */
export const StatusPill = forwardRef<HTMLButtonElement, StatusPillProps>(function StatusPill(
  { tone, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...rest}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT[tone])} />
      {children}
    </button>
  );
});
