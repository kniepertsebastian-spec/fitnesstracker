import { describe, expect, it } from "vitest";
import type { PlanDraftItemDto } from "@fitnesstracker/shared";
import { derivePhaseItems, NEGATIVE_TEMPO_NOTE } from "./phaseRotation.js";

const item = (overrides: Partial<PlanDraftItemDto> = {}): PlanDraftItemDto => ({
  day: "Push",
  exerciseId: "00000000-0000-0000-0000-000000000001",
  exerciseName: "Bankdrücken",
  equipment: "barbell",
  primaryMuscles: ["chest"],
  targetSets: 3,
  targetReps: 12,
  repRangeMin: 8,
  repRangeMax: 12,
  targetRir: 2,
  restSeconds: 120,
  notes: "Schulterblätter zusammenziehen",
  startWeightKg: 60,
  alternativeExerciseId: null,
  alternativeExerciseName: null,
  filledByServer: false,
  ...overrides,
});

describe("derivePhaseItems", () => {
  it("keeps exercises and days, swaps the prescription of the target phase", () => {
    const [result] = derivePhaseItems([item()], "AUFBAU", "MUSKELAUSDAUER", []);
    expect(result.exerciseId).toBe("00000000-0000-0000-0000-000000000001");
    expect(result.day).toBe("Push");
    expect(result.repRangeMin).toBe(15);
    expect(result.repRangeMax).toBe(20);
    expect(result.restSeconds).toBe(60);
    expect(result.notes).toBe("Schulterblätter zusammenziehen");
  });

  it("adds the tempo note for NEGATIV and removes it again on the way back", () => {
    const [negative] = derivePhaseItems([item()], "AUFBAU", "NEGATIV", []);
    expect(negative.notes).toBe(`Schulterblätter zusammenziehen ${NEGATIVE_TEMPO_NOTE}`);
    expect(negative.repRangeMax).toBe(6);
    const [back] = derivePhaseItems([negative], "NEGATIV", "AUFBAU", []);
    expect(back.notes).toBe("Schulterblätter zusammenziehen");
  });

  it("scales rests relatively and leaves a missing rest at the phase default", () => {
    const result = derivePhaseItems([item({ restSeconds: 150 }), item({ restSeconds: null })], "AUFBAU", "NEGATIV", []);
    expect(result[0].restSeconds).toBe(225);
    expect(result[1].restSeconds).toBe(180);
  });

  it("recomputes the start weight for the new rep target from logged sets", () => {
    const sets = [{ exerciseId: "00000000-0000-0000-0000-000000000001", weightKg: 100, reps: 5 }];
    const [heavy] = derivePhaseItems([item()], "AUFBAU", "NEGATIV", sets);
    const [light] = derivePhaseItems([item()], "AUFBAU", "MUSKELAUSDAUER", sets);
    expect(heavy.startWeightKg).not.toBeNull();
    expect(heavy.startWeightKg!).toBeGreaterThan(light.startWeightKg!);
  });
});
