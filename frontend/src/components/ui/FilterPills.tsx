import { cn } from "./cn";

export interface FilterPillsProps {
  label: string;
  options: string[];
  /** "" = no filter */
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  /** Display text for an option; the option itself stays the filter key. */
  formatOption?: (option: string) => string;
  className?: string;
}

// Single-choice filter chips in a horizontally scrollable row (muscle group, equipment, …).
export function FilterPills({ label, options, value, onChange, allLabel = "Alle", formatOption, className }: FilterPillsProps) {
  const pill = (selected: boolean) =>
    cn(
      "min-h-11 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-small font-medium transition-colors duration-150",
      selected
        ? "border-accent-border bg-accent-soft text-accent-text"
        : "border-border-strong text-text-muted hover:bg-surface-2",
    );
  return (
    <div role="group" aria-label={label} className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      <button type="button" aria-pressed={value === ""} className={pill(value === "")} onClick={() => onChange("")}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} className={pill(value === o)} onClick={() => onChange(value === o ? "" : o)}>
          {formatOption ? formatOption(o) : o}
        </button>
      ))}
    </div>
  );
}
