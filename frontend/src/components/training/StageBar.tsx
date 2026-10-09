import type { Stage } from "../../lib/trainingStages";
import { STAGE_LABELS } from "../../lib/trainingStages";
import { cn } from "../ui";

export interface StageInfo {
  stage: Stage;
  /** 0–1 */
  progress: number;
  skipped: boolean;
}

// Relative width per section, roughly by how long each one takes.
const WEIGHT: Record<Stage, number> = { warmup: 1, kraft: 3, cardio: 1.6, stretch: 1.3 };
const FILL: Record<Stage, string> = { warmup: "bg-accent", kraft: "bg-accent", cardio: "bg-info", stretch: "bg-violet" };

export function StageBar({
  stages,
  current,
  onSelect,
}: {
  stages: StageInfo[];
  current: Stage;
  onSelect: (stage: Stage) => void;
}) {
  return (
    <nav aria-label="Ablauf des Trainings" className="flex gap-1.5">
      {stages.map(({ stage, progress, skipped }) => {
        const active = stage === current;
        const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
        return (
          <button
            key={stage}
            type="button"
            aria-current={active ? "step" : undefined}
            aria-label={`${STAGE_LABELS[stage]}: ${skipped ? "übersprungen" : `${pct} %`}`}
            onClick={() => onSelect(stage)}
            style={{ flexGrow: WEIGHT[stage], flexBasis: 0 }}
            className="flex min-h-10 min-w-0 flex-col justify-center gap-1.5 text-left"
          >
            <span className="block h-1.5 w-full overflow-hidden rounded-full bg-track">
              <span className={cn("block h-full rounded-full", FILL[stage], skipped && "opacity-40")} style={{ width: `${skipped ? 100 : pct}%` }} />
            </span>
            <span
              className={cn(
                "truncate text-xs",
                active ? "font-semibold text-text" : "font-medium text-text-faint",
                skipped && "line-through",
              )}
            >
              {STAGE_LABELS[stage]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
