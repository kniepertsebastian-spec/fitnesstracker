import { Flame } from "lucide-react";
import { Card, cn } from "../ui";
import type { HeatmapCell } from "../../lib/stats";

const LEVEL_CLASS: Record<HeatmapCell["level"], string> = {
  0: "bg-track",
  1: "bg-accent-soft",
  2: "bg-accent/60",
  3: "bg-accent",
};
const WEEKDAYS = ["Mo", "", "Mi", "", "Fr", "", "So"];

interface Props {
  weeks: HeatmapCell[][];
  trainedDays: number;
  currentStreak: number;
  longestStreak: number;
}

// Training calendar of the last weeks: one square per day, darker = more volume.
export function TrainingHeatmap({ weeks, trainedDays, currentStreak, longestStreak }: Props) {
  return (
    <Card title={`Trainingskalender · ${weeks.length} Wochen`}>
      <div className="flex gap-2">
        <div aria-hidden className="flex flex-col justify-between py-0.5 text-xs text-text-faint">
          {WEEKDAYS.map((label, i) => (
            <span key={i} className="flex aspect-square items-center">
              {label}
            </span>
          ))}
        </div>
        <div
          role="img"
          aria-label={`${trainedDays} Trainingstage in den letzten ${weeks.length} Wochen`}
          className="grid min-w-0 flex-1 gap-1"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
        >
          {weeks.map((column, w) => (
            <div key={w} className="flex flex-col gap-1">
              {column.map((cell) => (
                <span
                  key={cell.key}
                  title={cell.future ? undefined : cell.key}
                  className={cn("aspect-square rounded-sm", cell.future ? "bg-transparent" : LEVEL_CLASS[cell.level])}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-text-subtle">
        <span className="tabular">{trainedDays} Trainingstage</span>
        <span className="inline-flex items-center gap-1">
          <Flame size={14} aria-hidden className="text-warning" />
          <span className="tabular">
            Serie {currentStreak} {currentStreak === 1 ? "Woche" : "Wochen"}
          </span>
        </span>
        <span className="tabular">
          Längste Serie {longestStreak} {longestStreak === 1 ? "Woche" : "Wochen"}
        </span>
      </p>
    </Card>
  );
}
