import { cn } from "./cn";

export interface ProgressBarProps {
  /** 0–100 */
  value: number;
  size?: 5 | 6 | 8;
  tone?: "accent" | "info" | "warning";
  label: string;
  className?: string;
}

const FILL = { accent: "bg-accent", info: "bg-info", warning: "bg-warning" };
const HEIGHT = { 5: "h-[5px]", 6: "h-1.5", 8: "h-2" };

export function ProgressBar({ value, size = 6, tone = "accent", label, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("w-full overflow-hidden rounded-full bg-track", HEIGHT[size], className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-200", FILL[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
