import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const CONTROL =
  "w-full rounded-md border border-border-strong bg-surface-inset px-3 text-body text-text placeholder:text-text-faint " +
  "transition-colors duration-150 focus-visible:border-accent disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(CONTROL, "h-11", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...rest },
  ref,
) {
  return <select ref={ref} className={cn(CONTROL, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(CONTROL, "min-h-24 py-2", className)} {...rest} />;
});

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  /** Receives the generated id so the label is bound to the control. */
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-small font-medium text-text-muted">
        {label}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
