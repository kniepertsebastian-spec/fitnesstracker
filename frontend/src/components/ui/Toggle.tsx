import { cn } from "./cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

// Switch row: label (+ optional hint) on the left, 44 px-high tap target across the whole row.
export function Toggle({ checked, onChange, label, hint, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-3 py-1 text-left disabled:opacity-50",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-body text-text-2">{label}</span>
        {hint && <span className="block text-xs text-text-faint">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-accent" : "bg-track",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-text transition-all duration-150",
            checked ? "left-[18px] bg-on-accent" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
