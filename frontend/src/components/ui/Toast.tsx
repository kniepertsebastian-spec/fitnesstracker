import type { ReactNode } from "react";
import { cn } from "./cn";

export type ToastTone = "accent" | "info" | "danger";

const TONES: Record<ToastTone, { box: string; overline: string; icon: string }> = {
  accent: { box: "border-accent-border", overline: "text-accent", icon: "bg-accent-soft text-accent" },
  info: { box: "border-border-strong", overline: "text-info-text", icon: "bg-info-soft text-info" },
  danger: { box: "border-danger/40", overline: "text-danger-text", icon: "bg-danger-soft text-danger" },
};

export interface ToastProps {
  tone?: ToastTone;
  icon: ReactNode;
  overline?: string;
  children: ReactNode;
  className?: string;
}

/** Presentational toast (record, goal reached, error). Hosts decide placement and timing. */
export function Toast({ tone = "accent", icon, overline, children, className }: ToastProps) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-surface p-3 shadow-overlay animate-pop-in",
        t.box,
        className,
      )}
    >
      <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", t.icon)}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        {overline && <p className={cn("text-overline uppercase", t.overline)}>{overline}</p>}
        <div className="text-body font-medium text-text">{children}</div>
      </div>
    </div>
  );
}
