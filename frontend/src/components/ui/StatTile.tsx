import type { ReactNode } from "react";
import { cn } from "./cn";

export interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  subTone?: "accent" | "warning" | "danger" | "muted";
  className?: string;
}

const SUB_TONES = {
  accent: "text-accent",
  warning: "text-warning",
  danger: "text-danger-text",
  muted: "text-text-faint",
};

export function StatTile({ label, value, unit, sub, subTone = "muted", className }: StatTileProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      <p className="text-small text-text-subtle">{label}</p>
      <p className="tabular mt-1 text-stat text-text">
        {value}
        {unit && <span className="ml-1 text-small font-medium text-text-subtle">{unit}</span>}
      </p>
      {sub && <p className={cn("mt-1 text-xs", SUB_TONES[subTone])}>{sub}</p>}
    </div>
  );
}
