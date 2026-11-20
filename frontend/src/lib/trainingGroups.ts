import type { PlanDiaryExerciseDto, Technique } from "@fitnesstracker/shared";

// Running state of the focus mode's intensity techniques. Kept out of TrainingPage so the shapes are shared
// with the exercise card.

// A drop set, rest-pause or myo-reps run: extra mini sets after the last working set of one exercise.
export interface RunState {
  active: boolean;
  // Sets of the run share a group id, like a superset round (WorkoutLog.supersetGroupId).
  groupId: string | null;
  entryId: string | null;
  technique: Technique | null;
  // Weight of the mini sets relative to the previous one.
  factor: number;
  // Pause between the mini sets; null = the user's drop set pause from the timer settings.
  restSeconds: number | null;
}

export const NO_SEGMENT: RunState = { active: false, groupId: null, entryId: null, technique: null, factor: 1, restSeconds: null };

// Exercises done back to back: a superset started by hand, or a group the plan defined.
export interface ActiveGroup {
  // In the order they are done in.
  members: PlanDiaryExerciseDto[];
  technique: Technique;
  groupId: string;
  // Started by hand (a pair) rather than by the plan.
  manual: boolean;
  key: string;
}

// Reps of the mini sets after the first one: rest-pause continues with a third of the reps, myo-reps with
// a handful, a drop set keeps its reps.
export function segmentReps(technique: Technique | null, lastReps: number): number {
  if (technique === "MYO_REPS") return 5;
  if (technique === "REST_PAUSE") return Math.max(3, Math.ceil(lastReps / 3));
  return lastReps;
}
