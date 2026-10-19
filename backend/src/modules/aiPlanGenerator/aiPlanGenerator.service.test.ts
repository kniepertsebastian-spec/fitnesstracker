import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/env.js", () => ({
  env: {
    AI_SETTINGS_ENCRYPTION_KEY: "0000000000000000000000000000000000000000000000000000000000000000",
  },
}));

import { generatePlan } from "./aiPlanGenerator.service.js";

vi.mock("@google/genai", () => {
  const generateContentMock = vi.fn().mockResolvedValue({
    text: JSON.stringify({
      rationale: "Ganzkörper mit Fokus auf Grundübungen.",
      items: [
        {
          day: "Ganzkörper",
          exerciseId: "00000000-0000-0000-0000-000000000001",
          targetSets: 3,
          repRangeMin: 8,
          repRangeMax: 10,
          targetRir: 2,
          restSeconds: 150,
          cue: "Schulterblätter zusammenziehen",
          alternativeExerciseId: "00000000-0000-0000-0000-000000000002",
          order: 0,
        },
        // Not in the catalog: dropped, the day is filled up from the catalog instead.
        { day: "Ganzkörper", exerciseId: "99999999-0000-0000-0000-000000000000", targetSets: 3, order: 1 },
      ],
    }),
  });

  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: generateContentMock,
      },
    })),
    Type: {
      OBJECT: "OBJECT",
      ARRAY: "ARRAY",
      STRING: "STRING",
      INTEGER: "INTEGER",
      NUMBER: "NUMBER",
      BOOLEAN: "BOOLEAN",
      NULL: "NULL",
    },
  };
});

const ex = (id: string, name: string, equipment: string, muscle: string) => ({
  id,
  name,
  nameDe: null,
  equipment,
  primaryMuscles: [muscle],
});

describe("aiPlanGenerator.service with GoogleGenAI", () => {
  it("builds a draft via the Gemini SDK without touching the live plan", async () => {
    const upsert = vi.fn().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      ...create,
      createdAt: new Date("2026-10-20T10:00:00Z"),
    }));
    const fakePrisma = {
      workoutLog: {
        count: vi.fn().mockResolvedValue(10),
        // Only the start-weight query selects weightKg; the asymmetry check gets no history here.
        findMany: vi.fn().mockImplementation(async (args: { select?: { weightKg?: boolean } }) =>
          args.select?.weightKg ? [{ exerciseId: "00000000-0000-0000-0000-000000000001", weightKg: 80, reps: 8 }] : [],
        ),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ aiPlanPreferences: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      aiProviderSetting: {
        findUnique: vi.fn().mockResolvedValue({
          provider: "GEMINI",
          model: "gemini-2.5-flash",
          encryptedApiKey: "9db15b393f1e30ac7d90c667:13945a205f5c7b42937fb97d67f732be:bac38457ec95f0afedeb8183",
        }),
      },
      exercise: {
        findMany: vi.fn().mockResolvedValue([
          ex("00000000-0000-0000-0000-000000000001", "Barbell Bench Press", "barbell", "chest"),
          ex("00000000-0000-0000-0000-000000000002", "Dumbbell Bench Press", "dumbbell", "chest"),
          ex("00000000-0000-0000-0000-000000000003", "Barbell Squat", "barbell", "quadriceps"),
          ex("00000000-0000-0000-0000-000000000004", "Seated Cable Rows", "cable", "middle back"),
          ex("00000000-0000-0000-0000-000000000005", "Medicine Ball Chest Pass", "medicine ball", "chest"),
        ]),
      },
      trainingPlan: {
        findUnique: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      profile: { findUnique: vi.fn().mockResolvedValue(null) },
      planSnapshot: { findUnique: vi.fn().mockResolvedValue(null), upsert },
      planExercise: { deleteMany: vi.fn(), createMany: vi.fn() },
    } as unknown as Parameters<typeof generatePlan>[0];

    const res = await generatePlan(fakePrisma, "user-1", {
      phase: "AUFBAU",
      coldStart: {
        frequencyPerWeek: 1,
        equipment: ["barbell", "dumbbell", "cable", "machine", "body only"],
        experience: "beginner",
        goal: "muscle_gain",
        sessionDurationMinutes: 45,
      },
    });

    expect(res.status).toBe("draft");
    if (res.status !== "draft") return;
    const { draft } = res;
    expect(draft.rationale).toBe("Ganzkörper mit Fokus auf Grundübungen.");
    // 45 min → 4 exercises; one from the model, three filled up — never the medicine ball.
    expect(draft.items).toHaveLength(4);
    expect(draft.items.map((i) => i.exerciseId)).not.toContain("00000000-0000-0000-0000-000000000005");
    const bench = draft.items[0];
    expect(bench).toMatchObject({
      exerciseId: "00000000-0000-0000-0000-000000000001",
      repRangeMin: 8,
      repRangeMax: 10,
      targetReps: 10,
      restSeconds: 150,
      notes: "Schulterblätter zusammenziehen",
      alternativeExerciseName: "Dumbbell Bench Press",
      filledByServer: false,
      // 80 kg × 8 → e1RM ≈ 101.3; at 10 reps + RIR 2 ≈ 72.4 kg, rounded down to 2.5 kg.
      startWeightKg: 70,
    });
    expect(draft.items.slice(1).every((i) => i.filledByServer)).toBe(true);

    const planExercise = (fakePrisma as unknown as { planExercise: { deleteMany: ReturnType<typeof vi.fn> } }).planExercise;
    expect(planExercise.deleteMany).not.toHaveBeenCalled();

    const updateMany = (fakePrisma as unknown as { trainingPlan: { updateMany: ReturnType<typeof vi.fn> } })
      .trainingPlan.updateMany;
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", trainingGoal: null },
      data: { trainingGoal: "MUSCLE_GAIN" },
    });
  });
});
