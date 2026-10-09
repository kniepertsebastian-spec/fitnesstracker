import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: "default" | "hero";
  title?: ReactNode;
  action?: ReactNode;
}

export function Card({ variant = "default", title, action, className, children, ...rest }: CardProps) {
  const hero = variant === "hero";
  return (
    <div
      className={cn(
        "border p-4 lg:p-5",
        hero ? "rounded-3xl border-border-hero bg-hero" : "rounded-2xl border-border bg-surface",
        className,
      )}
      {...rest}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-h2 text-text">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
