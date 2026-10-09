import type { KeyboardEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "./cn";

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  label: string;
  className?: string;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function Stepper({ value, onChange, step = 1, min = 0, max, unit, label, className }: StepperProps) {
  const set = (next: number) => {
    const clamped = Math.max(min, max === undefined ? next : Math.min(max, next));
    onChange(round(clamped));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      set(value + step);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      set(value - step);
    }
  };

  const button =
    "flex h-12 w-12 shrink-0 items-center justify-center text-text-muted transition-colors duration-150 hover:text-text disabled:opacity-40";

  return (
    <div
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={unit ? `${value} ${unit}` : String(value)}
      onKeyDown={onKeyDown}
      className={cn("flex h-12 items-center rounded-md border border-border-strong bg-surface-inset", className)}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${label} verringern`}
        className={button}
        disabled={value <= min}
        onClick={() => set(value - step)}
      >
        <Minus size={18} strokeWidth={2} aria-hidden />
      </button>
      <span className="tabular flex-1 text-center font-mono text-body font-medium text-text">
        {value}
        {unit && <span className="ml-1 text-small text-text-subtle">{unit}</span>}
      </span>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${label} erhöhen`}
        className={button}
        disabled={max !== undefined && value >= max}
        onClick={() => set(value + step)}
      >
        <Plus size={18} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
