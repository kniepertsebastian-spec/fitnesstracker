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
      analysis: {
        identifiedWeaknesses: ["Brust-Volumen"],
        asymmetries: ["Keine"],
        adjustmentsRationale: "Fokus auf Hypertrophie",
      },
      weeklySchedule: [
        {
          day: "Ganzkörper",
          targetMuscleGroups: ["Brust", "Rücken", "Beine"],
          exercises: [
            {
              exerciseName: "Bankdrücken",
              sets: 3,
              repRange: "8-12",
              targetRPE: 8,
              restPeriodSeconds: 90,
              formCues: "Schulterblätter zusammenziehen",
              alternativeExercise: "Liegestütze",
            },
          ],
        },
      ],
      items: [
        {
          day: "Ganzkörper",
          exerciseId: "00000000-0000-0000-0000-000000000001",
          targetSets: 3,
          targetReps: 10,
          order: 0,
        },
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

describe("aiPlanGenerator.service with GoogleGenAI", () => {
  it("generates plan via Gemini SDK when provider is GEMINI", async () => {
    const fakePrisma = {
      workoutLog: {
        count: vi.fn().mockResolvedValue(10),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
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
          {
            id: "00000000-0000-0000-0000-000000000001",
            name: "Bankdrücken",
            nameDe: "Bankdrücken",
            equipment: "barbell",
            primaryMuscles: ["chest"],
          },
        ]),
      },
      trainingPlan: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      profile: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb({
          planExercise: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
            findMany: vi.fn().mockResolvedValue([
              {
                id: "plan-1",
                userId: "user-1",
                phase: "AUFBAU",
                exerciseId: "00000000-0000-0000-0000-000000000001",
                targetSets: 3,
                targetReps: 10,
                order: 0,
                dayLabel: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                exercise: {
                  id: "00000000-0000-0000-0000-000000000001",
                  name: "Bankdrücken",
                  nameDe: "Bankdrücken",
                },
              },
            ]),
          },
        });
      }),
    } as unknown as Parameters<typeof generatePlan>[0];

    // Set dummy ENCRYPTION_KEY for decryptSecret
    process.env.AI_SETTINGS_ENCRYPTION_KEY = "0000000000000000000000000000000000000000000000000000000000000000";

    const res = await generatePlan(fakePrisma, "user-1", {
      phase: "AUFBAU",
      coldStart: {
        frequencyPerWeek: 1,
        equipment: "fullgym",
        experience: "beginner",
        goal: "muscle_gain",
        sessionDurationMinutes: 60,
      },
    });

    expect(res.status).toBe("generated");
    if (res.status === "generated") {
      expect(res.items.length).toBe(1);
      expect(res.items[0].exerciseId).toBe("00000000-0000-0000-0000-000000000001");
    }
  });
});
