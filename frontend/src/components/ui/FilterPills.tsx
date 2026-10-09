import { cn } from "./cn";

export interface FilterPillsProps {
  label: string;
  options: string[];
  /** "" = no filter */
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  className?: string;
}

// Single-choice filter chips in a horizontally scrollable row (muscle group, equipment, …).
export function FilterPills({ label, options, value, onChange, allLabel = "Alle", className }: FilterPillsProps) {
  const pill = (selected: boolean) =>
    cn(
      "min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-small font-medium transition-colors duration-150",
      selected
        ? "border-accent-border bg-accent-soft text-accent"
        : "border-border-strong text-text-muted hover:bg-surface-2",
    );
  return (
    <div role="group" aria-label={label} className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      <button type="button" aria-pressed={value === ""} className={pill(value === "")} onClick={() => onChange("")}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} className={pill(value === o)} onClick={() => onChange(value === o ? "" : o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
