import type { CardioPlanItem, TrainingGoalValue, TrainingPhase } from "@fitnesstracker/shared";

// Rule-based cardio suggestion (F9) — deliberately no AI: the goal decides how much and what kind
// of cardio, the training day decides machine and intensity. The numbers are general guide values
// for recreational training, not medical advice; the user can override every day in the plan.

const LEG_MUSCLES = new Set(["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"]);

// A day counts as a leg day when at least two of its three most-trained muscles are leg muscles
// (muscles come ranked by rankMuscles, most-trained first).
export function isLegDay(rankedMuscles: string[]): boolean {
  return rankedMuscles.slice(0, 3).filter((m) => LEG_MUSCLES.has(m)).length >= 2;
}

interface GoalRule {
  warmupMinutes: number;
  afterMinutes: number;
  // Endurance-type goals get a bit more volume in the high-rep phase; pure strength does not.
  afterBonusInMuskelausdauer: number;
  reason: string;
  free: Array<Omit<CardioPlanItem, "slot">>;
}

const RULES: Record<TrainingGoalValue, GoalRule> = {
  MUSCLE_GAIN: {
    warmupMinutes: 5,
    afterMinutes: 15,
    afterBonusInMuskelausdauer: 5,
    reason: "Muskelaufbau: kurz und locker nach dem Krafttraining, damit Erholung und Kraft nicht leiden.",
    free: [],
  },
  STRENGTH: {
    warmupMinutes: 5,
    afterMinutes: 10,
    afterBonusInMuskelausdauer: 0,
    reason: "Kraft: nur Aufwärmen und kurzes Auslockern. Mehr Cardio würde die Erholung zwischen schweren Einheiten bremsen.",
    free: [],
  },
  FAT_LOSS: {
    warmupMinutes: 5,
    afterMinutes: 25,
    afterBonusInMuskelausdauer: 5,
    reason: "Fettabbau: längere lockere Einheiten nach dem Krafttraining, dazu eine Intervall-Einheit an einem freien Tag.",
    free: [{ machine: "BIKE", durationMinutes: 25, intensity: "Intervalle: 8 × 30 s zügig / 90 s locker" }],
  },
  ENDURANCE: {
    warmupMinutes: 8,
    afterMinutes: 20,
    afterBonusInMuskelausdauer: 5,
    reason: "Ausdauer: Cardio hat eigene Tage. Nach dem Krafttraining nur locker, die harten Einheiten liegen an freien Tagen.",
    free: [
      { machine: "TREADMILL", durationMinutes: 40, intensity: "Zone 2 · gleichmäßig" },
      { machine: "TREADMILL", durationMinutes: 35, intensity: "Intervalle: 6 × 3 Min. zügig / 2 Min. locker" },
    ],
  },
  GENERAL_FITNESS: {
    warmupMinutes: 5,
    afterMinutes: 20,
    afterBonusInMuskelausdauer: 0,
    reason: "Allgemeine Fitness: gemischt, jeweils mittlere Dauer nach dem Krafttraining und eine Einheit an einem freien Tag.",
    free: [{ machine: "STAIRMASTER", durationMinutes: 25, intensity: "mittel · gleichmäßig" }],
  },
};

// No goal chosen yet → suggest as for general fitness (the UI asks the user to pick one).
export const FALLBACK_GOAL: TrainingGoalValue = "GENERAL_FITNESS";

export function cardioReason(goal: TrainingGoalValue | null): string {
  return RULES[goal ?? FALLBACK_GOAL].reason;
}

export function suggestDayCardio(
  goal: TrainingGoalValue | null,
  phase: TrainingPhase,
  rankedMuscles: string[],
): CardioPlanItem[] {
  const rule = RULES[goal ?? FALLBACK_GOAL];
  const legDay = isLegDay(rankedMuscles);
  const after = rule.afterMinutes + (phase === "MUSKELAUSDAUER" ? rule.afterBonusInMuskelausdauer : 0);

  const warmup: CardioPlanItem = legDay
    ? { slot: "WARMUP", machine: "BIKE", durationMinutes: rule.warmupMinutes, intensity: "sehr locker · Beine anwärmen" }
    : { slot: "WARMUP", machine: "TREADMILL", durationMinutes: rule.warmupMinutes, intensity: "zügig gehen" };

  // After a leg day: flat walking instead of cycling, so the trained legs are not loaded again.
  // Fat loss on upper-body days: incline walking — easy on recovery, more work than cycling.
  let afterItem: CardioPlanItem;
  if (legDay) {
    afterItem = { slot: "AFTER", machine: "TREADMILL", durationMinutes: after, intensity: "Zone 2 · ohne Steigung" };
  } else if ((goal ?? FALLBACK_GOAL) === "FAT_LOSS") {
    afterItem = { slot: "AFTER", machine: "TREADMILL", durationMinutes: after, intensity: "Zone 2 · 5–8 % Steigung" };
  } else if ((goal ?? FALLBACK_GOAL) === "STRENGTH") {
    afterItem = { slot: "AFTER", machine: "BIKE", durationMinutes: after, intensity: "sehr locker · Auslockern" };
  } else {
    afterItem = { slot: "AFTER", machine: "BIKE", durationMinutes: after, intensity: "Zone 2 · locker" };
  }

  return [warmup, afterItem];
}

export function suggestFreeCardio(goal: TrainingGoalValue | null): CardioPlanItem[] {
  return RULES[goal ?? FALLBACK_GOAL].free.map((item) => ({ ...item, slot: "FREE" as const }));
}
