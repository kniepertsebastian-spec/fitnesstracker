import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "./cn";

export interface CheckRowProps {
  checked: boolean;
  title: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function CheckRow({ checked, title, meta, onClick, className }: CheckRowProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onClick}
      className={cn(
        "flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3 text-left transition-colors duration-150",
        checked ? "bg-transparent" : "bg-surface-2",
        "hover:bg-surface-2",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-accent bg-accent text-on-accent" : "border-border-strong",
        )}
      >
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-body font-medium", checked ? "text-text-subtle" : "text-text")}>
          {title}
        </span>
        {meta && <span className="block truncate text-xs text-text-faint">{meta}</span>}
      </span>
      <ChevronRight size={16} strokeWidth={2} aria-hidden className="shrink-0 text-text-faint" />
    </button>
  );
}
