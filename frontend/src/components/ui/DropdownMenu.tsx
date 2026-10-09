import type { ReactNode } from "react";
import * as Radix from "@radix-ui/react-dropdown-menu";
import { cn } from "./cn";

export const DropdownMenu = Radix.Root;
export const DropdownMenuTrigger = Radix.Trigger;

export function DropdownMenuContent({ className, ...rest }: Radix.DropdownMenuContentProps) {
  return (
    <Radix.Portal>
      <Radix.Content
        align="end"
        sideOffset={6}
        className={cn(
          "z-50 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-overlay animate-pop-in",
          className,
        )}
        {...rest}
      />
    </Radix.Portal>
  );
}

export interface DropdownMenuItemProps extends Radix.DropdownMenuItemProps {
  icon?: ReactNode;
  tone?: "default" | "danger";
}

export function DropdownMenuItem({ icon, tone = "default", className, children, ...rest }: DropdownMenuItemProps) {
  return (
    <Radix.Item
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-body outline-none",
        "data-[highlighted]:bg-surface-2",
        tone === "danger" ? "text-danger-text" : "text-text-2",
        className,
      )}
      {...rest}
    >
      {icon && <span aria-hidden className="text-text-subtle">{icon}</span>}
      {children}
    </Radix.Item>
  );
}
