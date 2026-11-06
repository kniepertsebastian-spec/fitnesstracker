import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only control has no other accessible name. */
  "aria-label": string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      // Standard 44 px (Touch-Ziel). Eine kleinere Größe per className braucht `h-9! w-9!`: ohne `!`
      // entscheidet die Reihenfolge der Klassen im erzeugten CSS, und die ist in Tailwind 4 nicht dieselbe wie in 3.
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-strong",
        "bg-control text-text-muted transition-colors duration-150 hover:bg-track hover:text-text",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
