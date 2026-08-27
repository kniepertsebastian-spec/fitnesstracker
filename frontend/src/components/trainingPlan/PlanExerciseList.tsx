import { useState } from "react";
import type { PlanExerciseDto, TrainingPhase } from "@fitnesstracker/shared";
import {
  usePlanExercises,
  useDeletePlanExercise,
  useUpdatePlanExercise,
} from "../../hooks/usePlanExercises";
import { PlanExerciseFormDialog } from "./PlanExerciseFormDialog";

function PlanExerciseRow({
  entry,
  isFirst,
  isLast,
  onMove,
}: {
  entry: PlanExerciseDto;
  isFirst: boolean;
  isLast: boolean;
  onMove: (entry: PlanExerciseDto, direction: "up" | "down") => void;
}) {
  const deletePlanExercise = useDeletePlanExercise(entry.phase);

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-ink-800 bg-ink-900 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink-100">{entry.exerciseName}</p>
        {(entry.targetSets || entry.targetReps) && (
          <p className="text-sm text-ink-400">
            {entry.targetSets ?? "?"} × {entry.targetReps ?? "?"}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onMove(entry, "up")}
          disabled={isFirst}
          aria-label="Nach oben"
          className="flex h-7 w-7 items-center justify-center rounded text-ink-500 hover:bg-ink-800 hover:text-ink-200 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          onClick={() => onMove(entry, "down")}
          disabled={isLast}
          aria-label="Nach unten"
          className="flex h-7 w-7 items-center justify-center rounded text-ink-500 hover:bg-ink-800 hover:text-ink-200 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          onClick={() => deletePlanExercise.mutate(entry.id)}
          className="ml-1 text-xs text-ink-600 hover:text-red-400"
        >
          Löschen
        </button>
      </div>
    </div>
  );
}

// Groups entries by `dayLabel` in first-seen order (already sorted by the backend to match the
// split's actual day sequence — see aiPlanGenerator.service.ts), keeping the up/down move
// semantics per group so reordering only ever swaps within the same day. Entries without a
// dayLabel (manually added, or a single-day "Ganzkörper" plan) render as one ungrouped list.
function groupByDay(entries: PlanExerciseDto[]): { dayLabel: string | null; entries: PlanExerciseDto[] }[] {
  const groups: { dayLabel: string | null; entries: PlanExerciseDto[] }[] = [];
  const indexByLabel = new Map<string | null, number>();
  for (const entry of entries) {
    let idx = indexByLabel.get(entry.dayLabel);
    if (idx === undefined) {
      idx = groups.length;
      indexByLabel.set(entry.dayLabel, idx);
      groups.push({ dayLabel: entry.dayLabel, entries: [] });
    }
    groups[idx].entries.push(entry);
  }
  return groups;
}

export function PlanExerciseList({ phase }: { phase: TrainingPhase }) {
  const { data: entries, isLoading } = usePlanExercises(phase);
  const updatePlanExercise = useUpdatePlanExercise(phase);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

  const handleMove = (group: PlanExerciseDto[], entry: PlanExerciseDto, direction: "up" | "down") => {
    const index = group.findIndex((e) => e.id === entry.id);
    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    const neighbor = group[neighborIndex];
    if (!neighbor) return;
    updatePlanExercise.mutate({ id: entry.id, input: { order: neighbor.order } });
    updatePlanExercise.mutate({ id: neighbor.id, input: { order: entry.order } });
  };

  const dayGroups = entries ? groupByDay(entries) : [];
  const isSplit = dayGroups.length > 1;
  // Clamp rather than reset to 0 on every render — a regenerated plan with fewer days than
  // before shouldn't silently jump the selection, only pull it back in range if it's now invalid.
  const activeIndex = Math.min(selectedDay, Math.max(0, dayGroups.length - 1));
  const activeGroup = dayGroups[activeIndex];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-400">Übungen in dieser Phase</h2>
        <button
          onClick={() => setDialogOpen(true)}
          className="rounded-lg bg-violet-500 px-3 py-1 text-xs font-medium text-ink-950 hover:bg-violet-400"
        >
          + Übung
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-600">Lädt…</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-sm text-ink-600">Noch keine Übungen für diese Phase.</p>
      ) : (
        <div>
          {isSplit && (
            <select
              value={activeIndex}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
              className="mb-3 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm font-medium text-ink-100"
            >
              {dayGroups.map((group, index) => (
                <option key={index} value={index}>
                  {group.dayLabel ?? `Tag ${index + 1}`}
                </option>
              ))}
            </select>
          )}

          <div className="flex flex-col gap-2">
            {activeGroup?.entries.map((entry, index) => (
              <PlanExerciseRow
                key={entry.id}
                entry={entry}
                isFirst={index === 0}
                isLast={index === activeGroup.entries.length - 1}
                onMove={(e, direction) => handleMove(activeGroup.entries, e, direction)}
              />
            ))}
          </div>
        </div>
      )}

      <PlanExerciseFormDialog phase={phase} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
