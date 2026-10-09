import { cn } from "./cn";

export type SegmentState = "open" | "done" | "current";

export interface SegmentedProgressProps {
  /** Number of segments, or explicit per-segment states. */
  segments: number | SegmentState[];
  /** With a numeric `segments`: how many are done (the next one is `current`). */
  done?: number;
  size?: 6 | 8;
  label: string;
  className?: string;
}

const STATE_CLASS: Record<SegmentState, string> = {
  done: "bg-accent",
  current: "bg-accent/40",
  open: "bg-track",
};

export function SegmentedProgress({ segments, done = 0, size = 6, label, className }: SegmentedProgressProps) {
  const states: SegmentState[] =
    typeof segments === "number"
      ? Array.from({ length: segments }, (_, i) => (i < done ? "done" : i === done ? "current" : "open"))
      : segments;
  const doneCount = states.filter((s) => s === "done").length;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={states.length}
      aria-valuenow={doneCount}
      className={cn("flex gap-1", className)}
    >
      {states.map((state, i) => (
        <span
          key={i}
          className={cn("flex-1 rounded-full", size === 6 ? "h-1.5" : "h-2", STATE_CLASS[state])}
        />
      ))}
    </div>
  );
}
