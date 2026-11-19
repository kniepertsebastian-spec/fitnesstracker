import { describe, expect, it } from "vitest";
import { addOptionsFor, alternativesFor, swapOptionsFor, type OptionPool } from "./exerciseOptions.js";

const row = (id: string, name: string, muscle: string) => ({ id, name, nameDe: null, equipment: "barbell", primaryMuscles: [muscle] });
const pool: OptionPool = {
  rows: [
    row("bench", "Barbell Bench Press - Medium Grip", "chest"),
    row("db", "Dumbbell Bench Press", "chest"),
    row("odd", "Odd Chest Thing", "chest"),
    row("ohp", "Standing Military Press", "shoulders"),
    row("lat", "Side Lateral Raise", "shoulders"),
  ],
  loggedCounts: new Map(),
};

describe("swapOptionsFor", () => {
  it("offers same-muscle exercises not on the day, the plan's alternative first", () => {
    const options = swapOptionsFor(pool, "chest", new Set(["bench"]), "odd");
    expect(options.map((o) => o.exerciseId)).toEqual(["odd", "db"]);
  });
});

describe("addOptionsFor", () => {
  it("alternates between the day's muscles", () => {
    const options = addOptionsFor(pool, ["chest", "shoulders"], new Set(["bench"]));
    expect(options.slice(0, 2).map((o) => o.primaryMuscle)).toEqual(["chest", "shoulders"]);
    expect(options.map((o) => o.exerciseId)).not.toContain("bench");
  });
});

describe("alternativesFor", () => {
  it("lists same-muscle exercises first, never the exercise itself or excluded ones", () => {
    const options = alternativesFor(pool, { id: "bench", primaryMuscles: ["chest"] }, new Set(["odd"]));
    expect(options.map((o) => o.exerciseId)).toEqual(["db"]);
  });

  it("falls back to exercises that also work the muscle", () => {
    const withCompound: OptionPool = {
      ...pool,
      rows: [...pool.rows, { id: "dip", name: "Dips", nameDe: null, equipment: "body only", primaryMuscles: ["triceps", "chest"] }],
    };
    const options = alternativesFor(withCompound, { id: "bench", primaryMuscles: ["chest"] }, new Set());
    expect(options.map((o) => o.exerciseId)).toEqual(expect.arrayContaining(["db", "odd", "dip"]));
    expect(options.at(-1)?.exerciseId).toBe("dip");
  });

  it("returns nothing for an exercise without muscle data", () => {
    expect(alternativesFor(pool, { id: "x", primaryMuscles: [] }, new Set())).toEqual([]);
  });
});
