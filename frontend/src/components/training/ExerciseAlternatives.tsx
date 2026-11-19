import { Check } from "lucide-react";
import { useExerciseAlternatives } from "../../hooks/usePlanExercises";
import { equipmentLabel, muscleLabel } from "../../lib/exerciseLabels";
import { cn } from "../ui";

interface Props {
  // The exercise to replace.
  exerciseId: string;
  // Exercises already on the day: not offered again.
  excludeIds?: string[];
  selectedId?: string | null;
  disabled?: boolean;
  onPick: (option: { exerciseId: string; exerciseName: string }) => void;
}

// Short list of direct replacements that train the same area, so swapping an exercise does not
// mean searching the whole catalog. Used when editing a plan and in the generated draft.
export function ExerciseAlternatives({ exerciseId, excludeIds = [], selectedId, disabled, onPick }: Props) {
  const { data, isLoading, isError } = useExerciseAlternatives(exerciseId, excludeIds);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-small font-medium text-text-muted">Direkte Alternativen (gleiche Muskeln)</p>
      {isLoading && <p className="text-xs text-text-subtle">Alternativen werden geladen…</p>}
      {isError && <p className="text-xs text-text-subtle">Alternativen konnten nicht geladen werden.</p>}
      {data?.length === 0 && <p className="text-xs text-text-subtle">Keine passende Alternative gefunden.</p>}
      {data?.map((o) => {
        const selected = o.exerciseId === selectedId;
        return (
          <button
            key={o.exerciseId}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onPick({ exerciseId: o.exerciseId, exerciseName: o.exerciseName })}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors duration-150",
              "disabled:pointer-events-none disabled:opacity-60",
              selected ? "border-accent bg-accent-soft" : "border-border-strong hover:bg-surface-2",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body text-text">{o.exerciseName}</span>
              <span className="text-xs text-text-subtle">
                {[o.primaryMuscle ? muscleLabel(o.primaryMuscle) : null, o.equipment ? equipmentLabel(o.equipment) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            {selected && <Check size={18} aria-hidden className="shrink-0 text-accent-text" />}
          </button>
        );
      })}
    </div>
  );
}
