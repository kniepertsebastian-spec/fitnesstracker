import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeTone = "accent" | "success" | "info" | "warning" | "danger" | "magenta" | "neutral";

const TONES: Record<BadgeTone, string> = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info-text",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger-text",
  magenta: "bg-magenta-soft text-magenta",
  neutral: "bg-track text-text-muted",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}
