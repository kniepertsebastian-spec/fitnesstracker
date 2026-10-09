import { useState } from "react";
import { ArrowDown, ArrowUp, Dumbbell, GripVertical, Plus, Repeat2, Trash2 } from "lucide-react";
import type { PlanExerciseDto, TrainingPhase } from "@fitnesstracker/shared";
import { useDeletePlanExercise, usePlanExercises, useUpdatePlanExercise } from "../../hooks/usePlanExercises";
import { PlanExerciseFormDialog } from "../trainingPlan/PlanExerciseFormDialog";
import { Button, Card, EmptyState, IconButton, ListRow, SegmentedControl, Skeleton, cn } from "../ui";

// Groups entries by `dayLabel` in first-seen order (already sorted by the backend to match the
// split's actual day sequence — see aiPlanGenerator.service.ts). Entries without a dayLabel
// (manually added, or a single-day "Ganzkörper" plan) render as one ungrouped list.
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

const LETTERS = "ABCDEFGH";
const shortName = (label: string | null, index: number) =>
  (label ?? `Tag ${index + 1}`).split("(")[0].trim() || `Tag ${index + 1}`;

function Row({
  entry,
  index,
  last,
  dragging,
  onDragStart,
  onDrop,
  onMove,
  onReplace,
}: {
  entry: PlanExerciseDto;
  index: number;
  last: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onMove: (direction: "up" | "down") => void;
  onReplace: () => void;
}) {
  const remove = useDeletePlanExercise(entry.phase);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(dragging && "opacity-40")}
    >
      <ListRow
        value={entry.targetSets || entry.targetReps ? `${entry.targetSets ?? "?"} × ${entry.targetReps ?? "?"}` : undefined}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={16} aria-hidden className="shrink-0 cursor-grab text-text-faint" />
          <span className="min-w-0 flex-1 truncate">{entry.exerciseName}</span>
          <span className="flex shrink-0 items-center">
            <IconButton aria-label={`${entry.exerciseName} ersetzen`} className="h-9 w-9 border-transparent bg-transparent" onClick={onReplace}>
              <Repeat2 size={16} aria-hidden />
            </IconButton>
            <IconButton aria-label={`${entry.exerciseName} nach oben`} className="h-9 w-9 border-transparent bg-transparent" disabled={index === 0} onClick={() => onMove("up")}>
              <ArrowUp size={16} aria-hidden />
            </IconButton>
            <IconButton aria-label={`${entry.exerciseName} nach unten`} className="h-9 w-9 border-transparent bg-transparent" disabled={last} onClick={() => onMove("down")}>
              <ArrowDown size={16} aria-hidden />
            </IconButton>
            <IconButton aria-label={`${entry.exerciseName} löschen`} className="h-9 w-9 border-transparent bg-transparent hover:text-danger-text" onClick={() => remove.mutate(entry.id)}>
              <Trash2 size={16} aria-hidden />
            </IconButton>
          </span>
        </div>
      </ListRow>
    </div>
  );
}

export function PlanDays({ phase }: { phase: TrainingPhase }) {
  const { data: entries, isLoading } = usePlanExercises(phase);
  const update = useUpdatePlanExercise(phase);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [replacing, setReplacing] = useState<PlanExerciseDto | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);

  const groups = entries ? groupByDay(entries) : [];
  const isSplit = groups.length > 1;
  const activeIndex = Math.min(selectedDay, Math.max(0, groups.length - 1));
  const active = groups[activeIndex];

  // Re-assigns the group's existing `order` values to the new sequence — moving one item
  // shifts the ones in between instead of only swapping two neighbours.
  const reorder = (group: PlanExerciseDto[], from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const orders = group.map((e) => e.order);
    const next = [...group];
    next.splice(to, 0, next.splice(from, 1)[0]);
    next.forEach((e, i) => {
      if (e.order !== orders[i]) update.mutate({ id: e.id, input: { order: orders[i] } });
    });
  };

  const sets = active?.entries.reduce((s, e) => s + (e.targetSets ?? 0), 0) ?? 0;

  return (
    <Card
      title="Trainingstage"
      action={
        <Button
          size="sm"
          variant="dashed"
          iconLeft={<Plus size={14} aria-hidden />}
          onClick={() => {
            setReplacing(null);
            setDialogOpen(true);
          }}
        >
          Übung hinzufügen
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !active ? (
        <EmptyState icon={<Dumbbell size={18} aria-hidden />} text="Noch keine Übungen für diese Phase." />
      ) : (
        <>
          {isSplit && (
            <SegmentedControl
              label="Trainingstag"
              className="mb-3"
              value={String(activeIndex)}
              onChange={(v) => setSelectedDay(Number(v))}
              options={groups.map((g, i) => ({ value: String(i), label: `${LETTERS[i] ?? i + 1} · ${shortName(g.dayLabel, i)}` }))}
            />
          )}
          <p className="mb-1 text-small text-text-subtle">
            <span className="font-medium text-text">{active.dayLabel ?? "Alle Übungen"}</span> · {active.entries.length} Übungen
            {sets > 0 ? ` · ${sets} Sätze` : ""}
          </p>
          <div>
            {active.entries.map((entry, i) => (
              <Row
                key={entry.id}
                entry={entry}
                index={i}
                last={i === active.entries.length - 1}
                dragging={dragId === entry.id}
                onDragStart={() => setDragId(entry.id)}
                onDrop={() => {
                  const from = active.entries.findIndex((e) => e.id === dragId);
                  setDragId(null);
                  reorder(active.entries, from, i);
                }}
                onMove={(dir) => reorder(active.entries, i, dir === "up" ? i - 1 : i + 1)}
                onReplace={() => {
                  setReplacing(entry);
                  setDialogOpen(true);
                }}
              />
            ))}
          </div>
        </>
      )}

      <PlanExerciseFormDialog
        phase={phase}
        open={dialogOpen}
        dayLabel={replacing?.dayLabel ?? active?.dayLabel ?? null}
        replacingEntry={replacing}
        onClose={() => {
          setDialogOpen(false);
          setReplacing(null);
        }}
      />
    </Card>
  );
}
