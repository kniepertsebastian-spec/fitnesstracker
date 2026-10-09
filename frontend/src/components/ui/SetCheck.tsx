import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "./cn";

export type SetCheckState = "open" | "current" | "done";

export interface SetCheckProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  state: SetCheckState;
  /** Accessible name, e.g. "Satz 2 abhaken". */
  "aria-label": string;
}

export const SetCheck = forwardRef<HTMLButtonElement, SetCheckProps>(function SetCheck(
  { state, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={state === "done"}
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border transition-colors duration-150",
        state === "done" && "border-accent bg-accent text-on-accent",
        state === "current" && "border-accent text-accent hover:bg-accent-soft",
        state === "open" && "border-border-strong text-text-faint hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      <Check size={20} strokeWidth={2.4} aria-hidden className={state === "done" ? "" : "opacity-60"} />
    </button>
  );
});
