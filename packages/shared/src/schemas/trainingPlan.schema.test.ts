import { describe, expect, it } from "vitest";
import { changeTrainingPhaseSchema } from "./trainingPlan.schema.js";

describe("changeTrainingPhaseSchema", () => {
  it("accepts each supported training phase", () => {
    expect(changeTrainingPhaseSchema.safeParse({ phase: "AUFBAU" }).success).toBe(true);
    expect(changeTrainingPhaseSchema.safeParse({ phase: "MUSKELAUSDAUER" }).success).toBe(true);
    expect(changeTrainingPhaseSchema.safeParse({ phase: "NEGATIV" }).success).toBe(true);
  });

  it("rejects unsupported phases and malformed bodies", () => {
    expect(changeTrainingPhaseSchema.safeParse({ phase: "BULK" }).success).toBe(false);
    expect(changeTrainingPhaseSchema.safeParse({}).success).toBe(false);
    expect(changeTrainingPhaseSchema.safeParse(null).success).toBe(false);
  });
});
