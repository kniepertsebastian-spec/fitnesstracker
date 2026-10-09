import type { ReactNode } from "react";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import { cn } from "./cn";

export type CalloutTone = "info" | "warning" | "danger";

const TONES: Record<CalloutTone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: "border-info/30 bg-info/[0.07]", icon: "bg-info-soft text-info", Icon: Info },
  warning: { box: "border-warning/30 bg-warning/[0.07]", icon: "bg-warning-soft text-warning", Icon: AlertTriangle },
  danger: { box: "border-danger/30 bg-danger/[0.07]", icon: "bg-danger-soft text-danger", Icon: CircleAlert },
};

export interface CalloutProps {
  tone?: CalloutTone;
  children: ReactNode;
  className?: string;
}

export function Callout({ tone = "info", children, className }: CalloutProps) {
  const { box, icon, Icon } = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-lg border p-3", box, className)}
    >
      <span aria-hidden className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", icon)}>
        <Icon size={16} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 pt-1 text-small text-text-2">{children}</div>
    </div>
  );
}
