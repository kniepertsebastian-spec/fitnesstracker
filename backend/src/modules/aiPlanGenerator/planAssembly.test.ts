import { describe, expect, it } from "vitest";
import {
  assembleDays,
  equipmentTagOf,
  resolveSplit,
  selectBalancedCatalog,
  suggestStartWeights,
  type CatalogRow,
} from "./planAssembly.js";

const row = (id: string, name: string, muscle: string, equipment = "barbell"): CatalogRow => ({
  id,
  name,
  nameDe: null,
  equipment,
  primaryMuscles: [muscle],
});
const defaults = { sets: 3, repMin: 8, repMax: 12, rir: 2, restSeconds: 120 };

describe("resolveSplit", () => {
  it("cycles the chosen split to the weekly frequency with unique labels", () => {
    expect(resolveSplit("push_pull_legs", 4).map((d) => d.label)).toEqual([
      "Push A (Brust, Schultern, Trizeps)",
      "Pull (Rücken, Bizeps)",
      "Legs (Beine)",
      "Push B (Brust, Schultern, Trizeps)",
    ]);
    expect(resolveSplit("upper_lower", 2).map((d) => d.label)).toEqual(["Oberkörper", "Unterkörper"]);
    expect(resolveSplit("full_body", 3).map((d) => d.label)).toEqual(["Ganzkörper A", "Ganzkörper B", "Ganzkörper C"]);
  });

  it("keeps the frequency-based choice for auto", () => {
    expect(resolveSplit("auto", 1).map((d) => d.label)).toEqual(["Ganzkörper"]);
    expect(resolveSplit("auto", 5)[0].label).toBe("Brust");
  });
});

describe("equipmentTagOf", () => {
  it("folds e-z bar into barbell and unknown/empty into other", () => {
    expect(equipmentTagOf("e-z curl bar")).toBe("barbell");
    expect(equipmentTagOf(null)).toBe("other");
    expect(equipmentTagOf("medicine ball")).toBe("medicine ball");
  });
});

describe("selectBalancedCatalog", () => {
  it("gives every muscle a share instead of the alphabetically first rows", () => {
    const rows = [
      ...Array.from({ length: 20 }, (_, i) => row(`a${i}`, `Ab Exercise ${i}`, "abdominals")),
      row("legpress", "Leg Press", "quadriceps", "machine"),
      row("pulldown", "Wide-Grip Lat Pulldown", "lats", "cable"),
    ];
    const picked = selectBalancedCatalog(rows, ["abdominals", "quadriceps", "lats"], new Map(), "seed", 12);
    expect(picked.map((p) => p.id)).toEqual(expect.arrayContaining(["legpress", "pulldown"]));
    expect(picked.length).toBeLessThanOrEqual(12);
  });

  it("prefers gym staples over exotic variants of the same pattern", () => {
    const rows = [
      row("jump", "Kneeling Jump Squat", "quadriceps", "body only"),
      row("dip", "Jerk Dip Squat", "quadriceps"),
      row("squat", "Barbell Squat", "quadriceps"),
      row("press", "Leg Press", "quadriceps", "machine"),
    ];
    const picked = selectBalancedCatalog(rows, ["quadriceps"], new Map(), "seed", 2);
    expect(picked.map((p) => p.id).sort()).toEqual(["press", "squat"]);
  });

  it("ranks logged exercises and staples first within a muscle", () => {
    const rows = [row("odd", "Zercher Thing", "chest"), row("bench", "Barbell Bench Press", "chest"), row("mine", "Odd Fly Variant X", "chest", "other")];
    const picked = selectBalancedCatalog(rows, ["chest"], new Map([["mine", 12]]), "seed", 2);
    expect(picked.map((p) => p.id)).toEqual(["mine", "bench"]);
  });
});

describe("assembleDays", () => {
  const catalog = [
    row("bench", "Barbell Bench Press", "chest"),
    row("ohp", "Military Press", "shoulders"),
    row("pushdown", "Triceps Pushdown", "triceps", "cable"),
    row("fly", "Cable Fly", "chest", "cable"),
    row("squat", "Barbell Squat", "quadriceps"),
  ];
  const push = resolveSplit("push_pull_legs", 3)[0];

  it("drops invalid, off-focus and duplicate picks and fills up the day", () => {
    const items = assembleDays(
      [
        { day: push.label, exerciseId: "bench", targetSets: 4, repRangeMin: 6, repRangeMax: 8, order: 0 },
        { day: push.label, exerciseId: "bench", targetSets: 3, order: 1 },
        { day: push.label, exerciseId: "squat", targetSets: 3, order: 2 },
        { day: push.label, exerciseId: "nope", targetSets: 3, order: 3 },
        { day: "Erfundener Tag", exerciseId: "ohp", targetSets: 3, order: 0 },
      ],
      [push],
      catalog,
      3,
      defaults,
    );
    expect(items[0].exerciseId).toBe("bench");
    expect(items.slice(1).map((i) => i.exerciseId).sort()).toEqual(["ohp", "pushdown"]);
    expect(items[0]).toMatchObject({ targetSets: 4, repRangeMin: 6, repRangeMax: 8, filledByServer: false });
    // Filled items cover muscles not hit yet (shoulders, triceps) before a second chest exercise.
    expect(items.slice(1).every((i) => i.filledByServer && i.repRangeMax === 12)).toBe(true);
  });

  it("cuts surplus and normalizes swapped ranges and bad alternatives", () => {
    const items = assembleDays(
      [
        { day: push.label, exerciseId: "bench", targetSets: 3, repRangeMin: 12, repRangeMax: 8, alternativeExerciseId: "bench", order: 0 },
        { day: push.label, exerciseId: "fly", targetSets: 3, alternativeExerciseId: "bench", order: 1 },
        { day: push.label, exerciseId: "ohp", targetSets: 3, order: 2 },
      ],
      [push],
      catalog,
      2,
      defaults,
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ repRangeMin: 8, repRangeMax: 12, alternativeExerciseId: null });
    expect(items[1].alternativeExerciseId).toBe("bench");
  });

  it("rejects an alternative that trains a different muscle", () => {
    const [item] = assembleDays(
      [{ day: push.label, exerciseId: "bench", targetSets: 3, alternativeExerciseId: "pushdown", order: 0 }],
      [push],
      catalog,
      1,
      defaults,
    );
    expect(item.alternativeExerciseId).toBeNull();
  });
});

describe("suggestStartWeights", () => {
  it("derives a working weight from the best logged set", () => {
    const weights = suggestStartWeights(
      [
        { exerciseId: "bench", weightKg: 80, reps: 8 },
        { exerciseId: "bench", weightKg: 60, reps: 5 },
      ],
      [
        { exerciseId: "bench", reps: 10, rir: 2 },
        { exerciseId: "squat", reps: 10, rir: 2 },
      ],
    );
    expect(weights.get("bench")).toBe(70);
    expect(weights.has("squat")).toBe(false);
  });
});
