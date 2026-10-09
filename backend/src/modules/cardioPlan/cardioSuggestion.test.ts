import { describe, expect, it } from "vitest";
import { TRAINING_GOALS } from "@fitnesstracker/shared";
import { cardioReason, isLegDay, suggestDayCardio, suggestFreeCardio } from "./cardioSuggestion.js";

const PUSH = ["chest", "triceps", "shoulders"];
const LEGS = ["quadriceps", "glutes", "hamstrings", "calves"];

describe("isLegDay", () => {
  it("needs two leg muscles among the top three", () => {
    expect(isLegDay(LEGS)).toBe(true);
    expect(isLegDay(["quadriceps", "chest", "glutes"])).toBe(true);
    expect(isLegDay(["chest", "quadriceps", "triceps", "glutes"])).toBe(false);
    expect(isLegDay(PUSH)).toBe(false);
    expect(isLegDay([])).toBe(false);
  });
});

describe("suggestDayCardio", () => {
  it("gives every goal a warm-up and one session after strength training", () => {
    for (const goal of TRAINING_GOALS) {
      const items = suggestDayCardio(goal, "AUFBAU", PUSH);
      expect(items.map((i) => i.slot)).toEqual(["WARMUP", "AFTER"]);
      for (const item of items) {
        expect(item.durationMinutes).toBeGreaterThan(0);
        expect(item.intensity.length).toBeGreaterThan(0);
      }
    }
  });

  it("scales the session after training with the goal", () => {
    const after = (goal: (typeof TRAINING_GOALS)[number]) =>
      suggestDayCardio(goal, "AUFBAU", PUSH).find((i) => i.slot === "AFTER")!.durationMinutes;
    expect(after("STRENGTH")).toBeLessThan(after("MUSCLE_GAIN"));
    expect(after("MUSCLE_GAIN")).toBeLessThan(after("FAT_LOSS"));
  });

  it("warms up on the bike and walks flat afterwards on a leg day", () => {
    const [warmup, after] = suggestDayCardio("MUSCLE_GAIN", "AUFBAU", LEGS);
    expect(warmup.machine).toBe("BIKE");
    expect(after.machine).toBe("TREADMILL");
    expect(after.intensity).toContain("ohne Steigung");
  });

  it("uses incline walking for fat loss on upper-body days", () => {
    const after = suggestDayCardio("FAT_LOSS", "AUFBAU", PUSH)[1];
    expect(after.machine).toBe("TREADMILL");
    expect(after.intensity).toContain("Steigung");
  });

  it("adds a little volume in the Muskelausdauer phase, but not for pure strength", () => {
    const minutes = (goal: (typeof TRAINING_GOALS)[number], phase: "AUFBAU" | "MUSKELAUSDAUER") =>
      suggestDayCardio(goal, phase, PUSH)[1].durationMinutes;
    expect(minutes("MUSCLE_GAIN", "MUSKELAUSDAUER")).toBeGreaterThan(minutes("MUSCLE_GAIN", "AUFBAU"));
    expect(minutes("STRENGTH", "MUSKELAUSDAUER")).toBe(minutes("STRENGTH", "AUFBAU"));
  });

  it("falls back to general fitness when no goal is chosen", () => {
    expect(suggestDayCardio(null, "NEGATIV", PUSH)).toEqual(suggestDayCardio("GENERAL_FITNESS", "NEGATIV", PUSH));
    expect(cardioReason(null)).toBe(cardioReason("GENERAL_FITNESS"));
  });
});

describe("suggestFreeCardio", () => {
  it("only plans extra days where the goal needs them", () => {
    expect(suggestFreeCardio("MUSCLE_GAIN")).toEqual([]);
    expect(suggestFreeCardio("STRENGTH")).toEqual([]);
    expect(suggestFreeCardio("FAT_LOSS")).toHaveLength(1);
    expect(suggestFreeCardio("ENDURANCE")).toHaveLength(2);
    expect(suggestFreeCardio("ENDURANCE").every((i) => i.slot === "FREE")).toBe(true);
  });
});
