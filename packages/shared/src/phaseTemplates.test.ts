import { describe, expect, it } from "vitest";
import { PHASE_TEMPLATES, PHASE_TEMPLATE_SLOTS, getPhaseWeeks, phaseTemplateConfigs, phaseTemplateWeeks } from "./phaseTemplates.js";
import { TRAINING_GOALS } from "./schemas/cardioPlan.schema.js";
import { phaseConfigItemSchema } from "./schemas/trainingPlan.schema.js";

describe("phase templates", () => {
  it.each(TRAINING_GOALS)("%s fits the plan: valid configs, unique slots, at most 8 phases", (goal) => {
    const configs = phaseTemplateConfigs(goal);
    expect(configs.length).toBeGreaterThanOrEqual(3);
    expect(configs.length).toBeLessThanOrEqual(PHASE_TEMPLATE_SLOTS.length);
    expect(new Set(configs.map((c) => c.phase)).size).toBe(configs.length);
    for (const c of configs) expect(phaseConfigItemSchema.safeParse(c).success).toBe(true);
  });

  it("starts the muscle-gain template with hypertrophy and a one-week deload after it", () => {
    const [first, second] = PHASE_TEMPLATES.MUSCLE_GAIN.phases;
    expect(first.label).toBe("Hypertrophie");
    expect(second).toMatchObject({ label: "Deload", weeks: 1 });
    expect(phaseTemplateConfigs("MUSCLE_GAIN").map((c) => c.label)).toEqual([
      "Hypertrophie",
      "Deload",
      "Maximalkraft",
      "Definition",
      "Erhalt",
    ]);
  });

  it("sums up the weeks", () => {
    expect(phaseTemplateWeeks("MUSCLE_GAIN")).toBe(8 + 1 + 6 + 6 + 4);
  });

  it("falls back to 8 weeks for a phase without a configured length", () => {
    expect(getPhaseWeeks([{ phase: "AUFBAU" }], "AUFBAU")).toBe(8);
    expect(getPhaseWeeks([{ phase: "AUFBAU", weeks: 3 }], "AUFBAU")).toBe(3);
    expect(getPhaseWeeks(undefined, "NEGATIV")).toBe(8);
  });
});
