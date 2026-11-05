import type { ExerciseOptionDto, PlanDiaryExerciseDto, TrainingPhase } from "@fitnesstracker/shared";

// Changes to today's exercises made in focus mode. Every edit applies to the running session
// right away (stored per session, works offline); `permanent` edits are also queued for the plan
// itself (offline/planEditSync.ts) and marked `synced` once the server has them — from then on
// the refetched plan shows the change and the edit is no longer applied on top.
interface EditBase {
  id: string;
  permanent: boolean;
  synced: boolean;
}

export type PlanEdit =
  | (EditBase & { kind: "replace"; key: string; exerciseId: string; exerciseName: string })
  | (EditBase & { kind: "remove"; key: string })
  | (EditBase & {
      kind: "add";
      key: string;
      exerciseId: string;
      exerciseName: string;
      phase: TrainingPhase;
      dayLabel: string | null;
      targetSets: number | null;
      targetReps: number | null;
    })
  | (EditBase & { kind: "move"; key: string; otherKey: string });

export type PlanEditInput =
  | { kind: "replace"; key: string; exerciseId: string; exerciseName: string }
  | { kind: "remove"; key: string }
  | {
      kind: "add";
      exerciseId: string;
      exerciseName: string;
      phase: TrainingPhase;
      dayLabel: string | null;
      targetSets: number | null;
      targetReps: number | null;
    }
  | { kind: "move"; key: string; otherKey: string };

// An exercise added in the workout gets a synthetic plan entry, so the focus view can treat it
// like any other (logging, set count, "Als Nächstes").
function syntheticEntry(edit: Extract<PlanEdit, { kind: "add" }>, swapOptions: ExerciseOptionDto[]): PlanDiaryExerciseDto {
  const now = new Date().toISOString();
  return {
    id: edit.key,
    phase: edit.phase,
    exerciseId: edit.exerciseId,
    exerciseName: edit.exerciseName,
    targetSets: edit.targetSets,
    targetReps: edit.targetReps,
    order: Number.MAX_SAFE_INTEGER,
    dayLabel: edit.dayLabel,
    repRangeMin: null,
    repRangeMax: null,
    targetRir: null,
    restSeconds: null,
    notes: null,
    startWeightKg: null,
    alternativeExerciseId: null,
    alternativeExerciseName: null,
    createdAt: now,
    updatedAt: now,
    loggedThisWeek: false,
    progression: null,
    swapOptions,
  };
}

export function applyPlanEdits(
  dayExercises: PlanDiaryExerciseDto[],
  edits: PlanEdit[],
  addOptions: ExerciseOptionDto[] | undefined = [],
): PlanDiaryExerciseDto[] {
  let list = [...dayExercises];
  for (const edit of edits) {
    if (edit.synced) continue;
    if (edit.kind === "replace") {
      list = list.map((e) =>
        e.id === edit.key && e.exerciseId !== edit.exerciseId
          ? {
              ...e,
              exerciseId: edit.exerciseId,
              exerciseName: edit.exerciseName,
              // Progression, cue and start weight described the old exercise.
              progression: null,
              notes: null,
              startWeightKg: null,
              alternativeExerciseId: e.exerciseId,
              alternativeExerciseName: e.exerciseName,
              swapOptions: [
                { exerciseId: e.exerciseId, exerciseName: e.exerciseName, equipment: null, primaryMuscle: null },
                ...(e.swapOptions ?? []).filter((o) => o.exerciseId !== edit.exerciseId),
              ],
            }
          : e,
      );
    } else if (edit.kind === "remove") {
      list = list.filter((e) => e.id !== edit.key);
    } else if (edit.kind === "add") {
      if (list.some((e) => e.exerciseId === edit.exerciseId)) continue;
      const muscle = (addOptions ?? []).find((o) => o.exerciseId === edit.exerciseId)?.primaryMuscle;
      const swaps = muscle ? (addOptions ?? []).filter((o) => o.primaryMuscle === muscle && o.exerciseId !== edit.exerciseId) : [];
      list.push(syntheticEntry(edit, swaps));
    } else {
      const a = list.findIndex((e) => e.id === edit.key);
      const b = list.findIndex((e) => e.id === edit.otherKey);
      if (a !== -1 && b !== -1) [list[a], list[b]] = [list[b], list[a]];
    }
  }
  return list;
}

// --- Per-session storage ------------------------------------------------------------------

const storageKey = (sessionClientId: string) => `fitnesstracker.training-edits.${sessionClientId}`;

export function loadPlanEdits(sessionClientId: string): PlanEdit[] {
  try {
    const raw = localStorage.getItem(storageKey(sessionClientId));
    return raw ? (JSON.parse(raw) as PlanEdit[]) : [];
  } catch {
    return [];
  }
}

export function savePlanEdits(sessionClientId: string, edits: PlanEdit[]) {
  try {
    localStorage.setItem(storageKey(sessionClientId), JSON.stringify(edits));
  } catch {
    // Storage unavailable: the edits still apply until the page is reloaded.
  }
}

export function toPlanEdit(input: PlanEditInput, permanent: boolean): PlanEdit {
  const id = crypto.randomUUID();
  if (input.kind === "add") return { ...input, id, key: `added:${id}`, permanent, synced: false };
  return { ...input, id, permanent, synced: false };
}
