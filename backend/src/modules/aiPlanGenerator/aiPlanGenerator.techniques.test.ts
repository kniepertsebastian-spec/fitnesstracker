import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/env.js", () => ({
  env: {
    AI_SETTINGS_ENCRYPTION_KEY: "0000000000000000000000000000000000000000000000000000000000000000",
  },
}));

import { generatePlan } from "./aiPlanGenerator.service.js";

const BENCH = "00000000-0000-0000-0000-000000000001";
const DB_PRESS = "00000000-0000-0000-0000-000000000002";
const SQUAT = "00000000-0000-0000-0000-000000000003";
const ROW = "00000000-0000-0000-0000-000000000004";

// What the model proposes: a superset of chest and back, a drop set on a heavy barbell squat (not allowed
// there), a pyramid on the squat, and a wave over the weeks.
vi.mock("@google/genai", () => {
  const generateContentMock = vi.fn().mockResolvedValue({
    text: JSON.stringify({
      rationale: "Ganzkörper.",
      periodization: "WAVE",
      items: [
        { day: "Ganzkörper", exerciseId: "00000000-0000-0000-0000-000000000001", targetSets: 3, repRangeMin: 8, repRangeMax: 10, targetRir: 2, restSeconds: 120, cue: "Brust raus", technique: "SUPERSET", techniqueGroup: "x", setScheme: "STRAIGHT", order: 0 },
        { day: "Ganzkörper", exerciseId: "00000000-0000-0000-0000-000000000004", targetSets: 3, repRangeMin: 8, repRangeMax: 12, targetRir: 2, restSeconds: 120, cue: "Ellbogen an den Körper", technique: "SUPERSET", techniqueGroup: "x", order: 1 },
        { day: "Ganzkörper", exerciseId: "00000000-0000-0000-0000-000000000003", targetSets: 4, repRangeMin: 6, repRangeMax: 10, targetRir: 2, restSeconds: 150, cue: "Tief", technique: "DROPSET", setScheme: "PYRAMID", order: 2 },
      ],
    }),
  });
  return {
    GoogleGenAI: vi.fn().mockImplementation(function () {
      return { models: { generateContent: generateContentMock } };
    }),
    Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", INTEGER: "INTEGER", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN", NULL: "NULL" },
  };
});

const ex = (id: string, name: string, equipment: string, muscle: string, secondary: string[] = []) => ({
  id,
  name,
  nameDe: null,
  equipment,
  primaryMuscles: [muscle],
  secondaryMuscles: secondary,
});

function fakePrisma() {
  const upsert = vi.fn().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
    ...create,
    createdAt: new Date("2026-11-21T10:00:00Z"),
  }));
  const prisma = {
    workoutLog: { count: vi.fn().mockResolvedValue(10), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue({ aiPlanPreferences: null }), update: vi.fn().mockResolvedValue({}) },
    aiProviderSetting: {
      findUnique: vi.fn().mockResolvedValue({
        provider: "GEMINI",
        model: "gemini-2.5-flash",
        encryptedApiKey: "9db15b393f1e30ac7d90c667:13945a205f5c7b42937fb97d67f732be:bac38457ec95f0afedeb8183",
      }),
    },
    exercise: {
      findMany: vi.fn().mockResolvedValue([
        ex(BENCH, "Barbell Bench Press - Medium Grip", "barbell", "chest", ["triceps", "shoulders"]),
        ex(DB_PRESS, "Dumbbell Bench Press", "dumbbell", "chest", ["triceps", "shoulders"]),
        ex(SQUAT, "Barbell Squat", "barbell", "quadriceps", ["glutes", "hamstrings", "calves"]),
        ex(ROW, "Seated Cable Rows", "cable", "middle back", ["biceps", "lats"]),
      ]),
    },
    trainingPlan: { findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    profile: { findUnique: vi.fn().mockResolvedValue(null) },
    planSnapshot: { findUnique: vi.fn().mockResolvedValue(null), upsert },
    planExercise: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), createMany: vi.fn() },
  } as unknown as Parameters<typeof generatePlan>[0];
  return { prisma, upsert };
}

const base = {
  frequencyPerWeek: 1,
  equipment: ["barbell", "dumbbell", "cable", "machine", "body only"] as Array<"barbell" | "dumbbell" | "cable" | "machine" | "body only">,
  experience: "advanced" as "beginner" | "intermediate" | "advanced",
  goal: "muscle_gain" as const,
  sessionDurationMinutes: 45,
};

describe("generatePlan with techniques", () => {
  it("keeps what the user allowed and what makes sense, drops the rest", async () => {
    const { prisma, upsert } = fakePrisma();
    const res = await generatePlan(prisma, "user-1", {
      phase: "AUFBAU",
      coldStart: { ...base, techniques: ["SUPERSET", "DROPSET"], schemes: ["PYRAMID"], periodizations: ["WAVE"] },
    });
    expect(res.status).toBe("draft");
    if (res.status !== "draft") return;
    const byId = new Map(res.draft.items.map((i) => [i.exerciseId, i]));

    // The superset of chest and back stays and the pair stands together.
    const bench = byId.get(BENCH)!;
    const row = byId.get(ROW)!;
    expect(bench).toMatchObject({ technique: "SUPERSET", techniqueGroup: "G1" });
    expect(row).toMatchObject({ technique: "SUPERSET", techniqueGroup: "G1" });
    expect(Math.abs(res.draft.items.indexOf(bench) - res.draft.items.indexOf(row))).toBe(1);

    // A drop set on a heavy barbell squat is not allowed; the pyramid is, with a prescription of four sets.
    const squat = byId.get(SQUAT)!;
    expect(squat.technique).toBeNull();
    expect(squat.setScheme).toBe("PYRAMID");
    expect(squat.setPlan).toHaveLength(4);
    expect(squat.setPlan![0].reps).toBeGreaterThan(squat.setPlan![3].reps!);

    // The week pattern the model proposed is part of the draft.
    expect(res.draft.periodization).toBe("WAVE");
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ periodization: "WAVE" }) }));
  });

  it("uses nothing when the user ticked nothing", async () => {
    const { prisma } = fakePrisma();
    const res = await generatePlan(prisma, "user-1", {
      phase: "AUFBAU",
      coldStart: { ...base, techniques: [], schemes: [], periodizations: [] },
    });
    expect(res.status).toBe("draft");
    if (res.status !== "draft") return;
    expect(res.draft.items.every((i) => !i.technique && !i.techniqueGroup && !i.setScheme && !i.setPlan)).toBe(true);
    expect(res.draft.periodization).toBeNull();
  });

  it("leaves the techniques out of a beginner plan except the easy ones", async () => {
    const { prisma } = fakePrisma();
    const res = await generatePlan(prisma, "user-1", {
      phase: "AUFBAU",
      coldStart: { ...base, experience: "beginner", techniques: ["SUPERSET", "DROPSET"], schemes: ["PYRAMID"], periodizations: [] },
    });
    if (res.status !== "draft") throw new Error("no draft");
    expect(res.draft.items.some((i) => i.technique === "DROPSET")).toBe(false);
    // One technique per day for beginners; the superset counts once.
    expect(new Set(res.draft.items.filter((i) => i.technique).map((i) => i.techniqueGroup)).size).toBeLessThanOrEqual(1);
    expect(res.draft.items.filter((i) => i.setScheme).length).toBeLessThanOrEqual(1);
  });
});
