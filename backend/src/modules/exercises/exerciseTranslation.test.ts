import { describe, expect, it } from "vitest";
import { isPlausibleTranslation } from "./exerciseTranslation.service.js";

const original = "Lie flat on a bench with a dumbbell in each hand.\n\nPress the weights up until your arms are straight.\n\nLower them slowly.";

describe("isPlausibleTranslation", () => {
  it("accepts a normal translation with the same steps", () => {
    expect(
      isPlausibleTranslation(original, "Lege dich flach auf eine Bank, in jeder Hand eine Kurzhantel.\n\nDrücke die Gewichte nach oben, bis deine Arme gestreckt sind.\n\nLasse sie langsam ab."),
    ).toBe(true);
  });

  it("rejects empty, unchanged and fenced answers", () => {
    expect(isPlausibleTranslation(original, "")).toBe(false);
    expect(isPlausibleTranslation(original, original)).toBe(false);
    expect(isPlausibleTranslation(original, '```json\n{"a":1}\n```')).toBe(false);
    expect(isPlausibleTranslation(original, '{"text": "Lege dich"}')).toBe(false);
  });

  it("rejects an answer that is far too short or too long", () => {
    expect(isPlausibleTranslation(original, "Hinlegen.")).toBe(false);
    expect(isPlausibleTranslation(original, "Lege dich hin. ".repeat(40))).toBe(false);
  });

  it("rejects an answer that lost or invented several steps", () => {
    const merged = "Lege dich flach auf eine Bank, in jeder Hand eine Kurzhantel. Drücke die Gewichte nach oben, bis deine Arme gestreckt sind. Lasse sie langsam ab.";
    expect(isPlausibleTranslation(original, merged)).toBe(false);
  });
});

// ---- the run itself, with the model and the database faked ----------------------------------------

import { vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("../aiPlanGenerator/aiPlanGenerator.service.js", () => ({ callModel: vi.fn() }));
vi.mock("./exercise.service.js", () => ({ isOperator: vi.fn().mockResolvedValue(true) }));

import { callModel } from "../aiPlanGenerator/aiPlanGenerator.service.js";
import { getTranslationState, startDescriptionTranslation } from "./exerciseTranslation.service.js";

describe("startDescriptionTranslation", () => {
  const english = "Lie flat on a bench with a dumbbell in each hand.\n\nPress the weights up until your arms are straight.";
  const good = "Lege dich flach auf eine Bank, in jeder Hand eine Kurzhantel.\n\nDrücke die Gewichte nach oben, bis deine Arme gestreckt sind.";

  it("stores plausible translations, skips the rest and stops when nothing is left", async () => {
    vi.mocked(callModel).mockResolvedValueOnce(
      JSON.stringify({ items: [{ id: "a", text: good }, { id: "b", text: english }] }),
    );
    let served = false;
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      exercise: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockImplementation(async () => {
          if (served) return [];
          served = true;
          return [
            { id: "a", name: "Dumbbell Bench Press", nameDe: "Bankdrücken (Kurzhantel)", description: english },
            { id: "b", name: "Dumbbell Fly", nameDe: "Fliegende (Kurzhantel)", description: english },
          ];
        }),
        update,
      },
    } as unknown as PrismaClient;

    await startDescriptionTranslation(prisma, "operator");
    for (let i = 0; i < 50 && (await getTranslationState(prisma, "operator")).running; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const state = await getTranslationState(prisma, "operator");
    expect(state).toMatchObject({ running: false, translated: 1, failed: 1, isOperator: true });
    // Only the plausible one was written; the unchanged text was not.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ where: { id: "a" }, data: { descriptionDe: good } });
  }, 15_000);
});
