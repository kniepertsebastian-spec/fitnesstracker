import { describe, expect, it, vi } from "vitest";
import { detectPlateau, findPlateauExerciseIds, roundToHalf, volumeHolding } from "./goalSuggestion.service.js";
import type { WorkoutLog } from "@prisma/client";

describe("roundToHalf", () => {
  it("rounds to the nearest 0.5", () => {
    expect(roundToHalf(80.3)).toBe(80.5);
    expect(roundToHalf(80.2)).toBe(80);
    expect(roundToHalf(80.75)).toBe(81);
  });
});

describe("detectPlateau", () => {
  it("needs at least 4 data points to judge anything", () => {
    expect(detectPlateau([10, 12, 14])).toBe(false);
  });

  it("flags a plateau when the last 3 sessions never beat what came before", () => {
    // Prior best (index 0-2) is 85; recent best (last 3) is 82 — no new high.
    expect(detectPlateau([80, 85, 83, 81, 82, 80])).toBe(true);
  });

  it("does not flag a plateau once a new best is set in the last 3 sessions", () => {
    expect(detectPlateau([80, 85, 83, 81, 82, 90])).toBe(false);
  });
});

// Only the fields volumeHolding actually reads — the real Prisma row carries many more, but a
// pure function shouldn't need a live client just to be exercised by a unit test.
function log(reps: number, weightKg: number): WorkoutLog {
  return { reps, weightKg } as unknown as WorkoutLog;
}

describe("volumeHolding", () => {
  it("treats too little data as holding (not enough evidence of a drop)", () => {
    expect(volumeHolding([log(10, 50), log(10, 50)])).toBe(true);
  });

  it("holds when the second half's volume is at least half the first half's", () => {
    const logs = [log(10, 50), log(10, 50), log(10, 50), log(10, 40)];
    expect(volumeHolding(logs)).toBe(true);
  });

  it("flags a drop when the second half's volume falls under half the first half's", () => {
    const logs = [log(10, 100), log(10, 100), log(5, 20), log(5, 20)];
    expect(volumeHolding(logs)).toBe(false);
  });
});

describe("findPlateauExerciseIds", () => {
  const entry = (exerciseId: string, reps: number, weightKg: number) =>
    ({ exerciseId, reps, weightKg }) as unknown as WorkoutLog;
  const prismaWith = (logs: WorkoutLog[]) =>
    ({ workoutLog: { findMany: vi.fn().mockResolvedValue(logs) } }) as unknown as Parameters<typeof findPlateauExerciseIds>[0];

  it("flags only the exercise whose recent weights never beat the earlier best", async () => {
    const stuck = [80, 85, 83, 81, 82, 80].map((w) => entry("stuck", 8, w));
    const growing = [60, 62.5, 65, 67.5, 70, 72.5].map((w) => entry("growing", 8, w));
    const result = await findPlateauExerciseIds(prismaWith([...stuck, ...growing]), "u", ["stuck", "growing"]);
    expect([...result]).toEqual(["stuck"]);
  });

  it("judges high-rep exercises by reps, not weight", async () => {
    const logs = [20, 22, 21, 20, 21, 20].map((r) => entry("pushups", r, 0));
    expect([...(await findPlateauExerciseIds(prismaWith(logs), "u", ["pushups"]))]).toEqual(["pushups"]);
  });

  it("ignores exercises without enough history and skips the query for an empty list", async () => {
    const few = [entry("new", 8, 50), entry("new", 8, 50)];
    expect((await findPlateauExerciseIds(prismaWith(few), "u", ["new"])).size).toBe(0);
    const prisma = prismaWith([]);
    await findPlateauExerciseIds(prisma, "u", []);
    expect((prisma as unknown as { workoutLog: { findMany: ReturnType<typeof vi.fn> } }).workoutLog.findMany).not.toHaveBeenCalled();
  });
});
