import { describe, expect, it } from "vitest";
import { pickDailyStretches, pickStretchesForMuscles, rankMuscles, type StretchCandidate } from "./stretchSelection.js";

function stretch(id: string, primary: string[], secondary: string[] = []): StretchCandidate {
  return { id, name: id, nameDe: null, description: null, imageUrls: [], primaryMuscles: primary, secondaryMuscles: secondary };
}

const catalog = [
  stretch("chest-1", ["chest"]),
  stretch("chest-2", ["chest"]),
  stretch("shoulder-1", ["shoulders"]),
  stretch("shoulder-2", ["shoulders"]),
  stretch("back-1", ["lats"]),
  stretch("tri-1", ["triceps"], ["shoulders"]),
];

describe("rankMuscles", () => {
  it("ranks primary muscles above secondary ones", () => {
    const ranked = rankMuscles([
      { primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "shoulders"] },
      { primaryMuscles: ["chest"], secondaryMuscles: ["triceps"] },
    ]);
    expect(ranked).toEqual(["chest", "triceps", "shoulders"]);
  });
});

describe("pickStretchesForMuscles", () => {
  it("covers every muscle before repeating one", () => {
    const picked = pickStretchesForMuscles(catalog, ["chest", "shoulders", "lats"], "seed", 3);
    expect(picked.map((p) => p.primaryMuscles[0]).sort()).toEqual(["chest", "lats", "shoulders"]);
  });

  it("is stable for the same seed and never returns duplicates", () => {
    const a = pickStretchesForMuscles(catalog, ["shoulders", "triceps"], "seed", 6);
    const b = pickStretchesForMuscles(catalog, ["shoulders", "triceps"], "seed", 6);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length);
  });

  it("returns nothing when no stretch matches", () => {
    expect(pickStretchesForMuscles(catalog, ["calves"], "seed")).toEqual([]);
  });
});

describe("pickDailyStretches", () => {
  it("only returns stretches for the chosen focus", () => {
    const picked = pickDailyStretches(catalog, "shoulders", "2026-10-05");
    expect(picked.length).toBeGreaterThan(0);
    for (const p of picked) expect([...p.primaryMuscles, ...p.secondaryMuscles]).toContain("shoulders");
  });
});
