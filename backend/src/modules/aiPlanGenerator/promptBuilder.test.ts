import { describe, expect, it } from "vitest";
import type { ColdStartInput } from "@fitnesstracker/shared";
import { buildColdStartContext, buildQuestionsPrompt, buildSystemPrompt } from "./promptBuilder.js";
import { resolveSplit } from "./planAssembly.js";

const base: ColdStartInput = {
  frequencyPerWeek: 3,
  split: "push_pull_legs",
  equipment: ["barbell", "dumbbell"],
  experience: "intermediate",
  goal: "muscle_gain",
  sessionDurationMinutes: 60,
  includeCardio: false,
  includeStretching: false,
};

describe("buildColdStartContext", () => {
  it("adds answered follow-up questions and leaves skipped ones out", () => {
    const context = buildColdStartContext({
      ...base,
      followUps: [
        { question: "Machst du nebenbei Sport?", answer: "Fußball am Wochenende" },
        { question: "Sind Seitheben okay?", answer: "  " },
      ],
    });
    expect(context).toContain("Antworten auf Rückfragen");
    expect(context).toContain("Machst du nebenbei Sport? → Fußball am Wochenende");
    expect(context).not.toContain("Seitheben");
  });

  it("has no follow-up section without answers", () => {
    expect(buildColdStartContext(base)).not.toContain("Rückfragen");
  });
});

describe("prompts", () => {
  it("asks for JSON questions", () => {
    expect(buildQuestionsPrompt()).toContain('"questions"');
  });

  it("states the per-day balance rules with the small-muscle cap", () => {
    const prompt = buildSystemPrompt("AUFBAU", [], resolveSplit("push_pull_legs", 3), 5);
    expect(prompt).toContain("AUSGEWOGENHEIT");
    expect(prompt).toContain("höchstens 2 Übung(en)");
  });
});
