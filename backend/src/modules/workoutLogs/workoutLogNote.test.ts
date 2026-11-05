import { describe, expect, it } from "vitest";
import { createWorkoutLogSchema, updateWorkoutLogSchema } from "@fitnesstracker/shared";

const base = {
  clientId: "00000000-0000-4000-8000-000000000001",
  exerciseId: "00000000-0000-4000-8000-000000000002",
  setNumber: 1,
  reps: 8,
  weightKg: 50,
};

describe("workout log note", () => {
  it("is optional and trimmed", () => {
    expect(createWorkoutLogSchema.parse(base).note).toBeUndefined();
    expect(createWorkoutLogSchema.parse({ ...base, note: "  Sitz 4  " }).note).toBe("Sitz 4");
  });

  it("stores blank text as no note and lets an update clear it with null", () => {
    expect(createWorkoutLogSchema.parse({ ...base, note: "   " }).note).toBeNull();
    expect(updateWorkoutLogSchema.parse({ note: null }).note).toBeNull();
    expect(updateWorkoutLogSchema.parse({}).note).toBeUndefined();
  });

  it("rejects notes longer than 500 characters", () => {
    expect(() => createWorkoutLogSchema.parse({ ...base, note: "x".repeat(501) })).toThrow();
  });
});
