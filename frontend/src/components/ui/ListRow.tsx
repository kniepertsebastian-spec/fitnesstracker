import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface ListRowProps extends Omit<HTMLAttributes<HTMLDivElement>, "prefix"> {
  /** Mono prefix, e.g. an exercise number. */
  prefix?: ReactNode;
  /** Mono value on the right, e.g. "4 × 6–8". */
  value?: ReactNode;
}

export function ListRow({ prefix, value, className, children, ...rest }: ListRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-[52px] items-center gap-3 border-t border-border-subtle first:border-t-0",
        className,
      )}
      {...rest}
    >
      {prefix !== undefined && (
        <span className="tabular w-6 shrink-0 font-mono text-small text-text-faint">{prefix}</span>
      )}
      <div className="min-w-0 flex-1 text-body text-text">{children}</div>
      {value !== undefined && (
        <span className="tabular shrink-0 font-mono text-small text-text-2">{value}</span>
      )}
    </div>
  );
}
