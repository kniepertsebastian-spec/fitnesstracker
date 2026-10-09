import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LinkProps } from "react-router-dom";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "dashed" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent font-semibold hover:bg-accent-hover border border-transparent",
  secondary: "bg-control text-text border border-border-strong hover:bg-track",
  ghost: "bg-transparent text-text-muted border border-border-strong hover:bg-surface-2",
  dashed: "bg-transparent text-text-muted border border-dashed border-border-strong hover:bg-surface-2",
  danger: "bg-danger-soft text-danger-text border border-danger/40 hover:bg-danger/20",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-small",
  md: "h-11 px-4 text-body",
  lg: "h-12 px-5 text-body",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

function classes({ variant = "secondary", size = "md", fullWidth }: CommonProps, extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    extra,
  );
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, iconLeft, iconRight, fullWidth, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes({ variant, size, fullWidth }, className)}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});

export type ButtonLinkProps = CommonProps & LinkProps;

/** A `Button` rendered as a React-Router `Link`. */
export function ButtonLink({
  variant,
  size,
  iconLeft,
  iconRight,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, size, fullWidth }, className)} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </Link>
  );
}
