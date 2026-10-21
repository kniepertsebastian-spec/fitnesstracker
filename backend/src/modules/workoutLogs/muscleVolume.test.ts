import { describe, expect, it } from "vitest";
import { muscleVolumeStart, weeklyMuscleSets } from "./muscleVolume.js";

const NOW = new Date("2026-10-21T12:00:00Z"); // Wednesday

describe("weeklyMuscleSets", () => {
  it("lists the requested weeks oldest first, starting on Mondays", () => {
    const { weeks } = weeklyMuscleSets([], 3, NOW);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19"]);
    expect(muscleVolumeStart(3, NOW).toISOString().slice(0, 10)).toBe("2026-10-05");
  });

  it("counts one set per primary muscle in the week it was trained", () => {
    const { weeks } = weeklyMuscleSets(
      [
        { performedAt: new Date("2026-10-19T08:00:00Z"), primaryMuscles: ["chest"] },
        { performedAt: new Date("2026-10-25T22:00:00Z"), primaryMuscles: ["chest", "triceps"] }, // Sunday, same week
        { performedAt: new Date("2026-10-12T08:00:00Z"), primaryMuscles: ["lats"] },
      ],
      3,
      NOW,
    );
    expect(weeks[2].sets).toEqual({ chest: 2, triceps: 1 });
    expect(weeks[1].sets).toEqual({ lats: 1 });
    expect(weeks[0].sets).toEqual({});
  });

  it("ignores sets outside the window", () => {
    const { weeks } = weeklyMuscleSets(
      [{ performedAt: new Date("2026-09-01T08:00:00Z"), primaryMuscles: ["chest"] }],
      2,
      NOW,
    );
    expect(weeks.every((w) => Object.keys(w.sets).length === 0)).toBe(true);
  });
});
