import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-[pulse_1.6s_ease-in-out_infinite] rounded-lg bg-track", className)} />;
}
