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
  techniques: [],
  schemes: [],
  periodizations: [],
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

describe("buildSystemPrompt: techniques", () => {
  const days = resolveSplit("push_pull_legs", 3);

  it("says nothing about techniques unless the user ticked some", () => {
    const prompt = buildSystemPrompt("AUFBAU", [], days, 6, null, base);
    expect(prompt).not.toContain("INTENSITÄTSTECHNIKEN");
    expect(prompt).not.toContain("SATZSCHEMATA");
  });

  it("adds the technique rules and the extra JSON fields when some are ticked", () => {
    const prompt = buildSystemPrompt("AUFBAU", [], days, 6, null, { ...base, techniques: ["SUPERSET", "DROPSET"], schemes: ["PYRAMID"], periodizations: ["LINEAR"] });
    expect(prompt).toContain("INTENSITÄTSTECHNIKEN");
    expect(prompt).toContain("SPARSAM");
    expect(prompt).toContain("techniqueGroup");
    expect(prompt).toContain("periodization");
  });

  it("leaves them out of a deload phase", () => {
    const prompt = buildSystemPrompt("MUSKELAUSDAUER", [], days, 6, "DELOAD", { ...base, techniques: ["DROPSET"] });
    expect(prompt).not.toContain("INTENSITÄTSTECHNIKEN");
  });
});
