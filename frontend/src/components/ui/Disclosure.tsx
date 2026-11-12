import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

export interface DisclosureProps {
  title: ReactNode;
  /** Short line under the title while closed. */
  hint?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

// A collapsed section in the look of a card, for rarely used tools (imports, analyses). Native
// <details>: keyboard and screen readers work without any script, and the state needs no store.
export function Disclosure({ title, hint, defaultOpen, className, children }: DisclosureProps) {
  return (
    <details open={defaultOpen} className={cn("group rounded-2xl border border-border bg-surface", className)}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 lg:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-h2 text-text">{title}</span>
          {hint && <span className="block text-small text-text-subtle">{hint}</span>}
        </span>
        <ChevronDown size={18} aria-hidden className="shrink-0 text-text-faint transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4 lg:px-5 lg:pb-5">{children}</div>
    </details>
  );
}
