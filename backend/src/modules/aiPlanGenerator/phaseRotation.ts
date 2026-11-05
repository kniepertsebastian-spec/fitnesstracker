import type { TrainingPhase } from "@prisma/client";
import type { PlanDraftItemDto } from "@fitnesstracker/shared";
import { PHASE_DEFAULTS } from "./promptBuilder.js";
import { suggestStartWeights } from "./planAssembly.js";

export const TRAINING_PHASES: TrainingPhase[] = ["AUFBAU", "MUSKELAUSDAUER", "NEGATIV"];

// Appended to every exercise of the NEGATIV phase and stripped again when a plan is derived from it.
export const NEGATIVE_TEMPO_NOTE = "Tempo: 3-4 s langsam ablassen.";

function withoutTempoNote(notes: string | null): string | null {
  const stripped = (notes ?? "").replace(NEGATIVE_TEMPO_NOTE, "").trim();
  return stripped.length > 0 ? stripped : null;
}

function round5(seconds: number): number {
  return Math.min(300, Math.max(20, Math.round(seconds / 5) * 5));
}

// The same exercises on the same days in another rotation phase: main lifts stay identical, only
// sets, rep range, RIR, rest and tempo follow the target phase. Rests keep their relative spread
// (compound lifts longer than isolation) by scaling the source plan's rests.
export function derivePhaseItems(
  items: PlanDraftItemDto[],
  from: TrainingPhase,
  to: TrainingPhase,
  loggedSets: { exerciseId: string; weightKg: number; reps: number }[],
): PlanDraftItemDto[] {
  const target = PHASE_DEFAULTS[to];
  const restFactor = target.restSeconds / PHASE_DEFAULTS[from].restSeconds;
  const weights = suggestStartWeights(
    loggedSets,
    items.map((i) => ({ exerciseId: i.exerciseId, reps: target.repMax, rir: target.rir })),
  );
  return items.map((item) => {
    const base = withoutTempoNote(item.notes);
    return {
      ...item,
      targetSets: target.sets,
      targetReps: target.repMax,
      repRangeMin: target.repMin,
      repRangeMax: target.repMax,
      targetRir: target.rir,
      restSeconds: item.restSeconds === null ? target.restSeconds : round5(item.restSeconds * restFactor),
      notes: to === "NEGATIV" ? [base, NEGATIVE_TEMPO_NOTE].filter(Boolean).join(" ") : base,
      startWeightKg: weights.get(item.exerciseId) ?? null,
      filledByServer: false,
    };
  });
}
