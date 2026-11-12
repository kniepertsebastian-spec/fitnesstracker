import type { ReactNode } from "react";
import { cn } from "./cn";

export interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  /** Small indicator (e.g. a trend arrow) shown after the unit, so it never splits number and unit. */
  trend?: ReactNode;
  sub?: ReactNode;
  /** Optional small control (e.g. an info button) shown next to the label. */
  info?: ReactNode;
  subTone?: "accent" | "warning" | "danger" | "muted";
  className?: string;
}

const SUB_TONES = {
  accent: "text-accent-text",
  warning: "text-warning",
  danger: "text-danger-text",
  muted: "text-text-faint",
};

export function StatTile({ label, value, unit, trend, sub, subTone = "muted", info, className }: StatTileProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      <p className="flex items-center justify-between gap-1 text-small text-text-subtle">
        <span>{label}</span>
        {info && <span className="-my-1.5 -mr-1.5">{info}</span>}
      </p>
      <p className="tabular mt-1 font-numeric text-stat text-text">
        {value}
        {unit && <span className="ml-1 text-small font-medium text-text-subtle">{unit}</span>}
        {trend && <span className="ml-1.5 inline-block align-middle">{trend}</span>}
      </p>
      {sub && <p className={cn("mt-1 text-xs", SUB_TONES[subTone])}>{sub}</p>}
    </div>
  );
}
