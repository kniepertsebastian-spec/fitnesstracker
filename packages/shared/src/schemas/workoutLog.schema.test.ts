import { describe, expect, it } from "vitest";
import { createWorkoutLogSchema, updateWorkoutLogSchema } from "./workoutLog.schema.js";

const validCreate = {
  clientId: "11111111-1111-4111-8111-111111111111",
  exerciseId: "22222222-2222-4222-8222-222222222222",
  setNumber: 1,
  reps: 10,
  weightKg: 80,
};

describe("createWorkoutLogSchema", () => {
  it("accepts a well-formed set", () => {
    expect(createWorkoutLogSchema.safeParse(validCreate).success).toBe(true);
  });

  it("rejects zero or negative reps", () => {
    expect(createWorkoutLogSchema.safeParse({ ...validCreate, reps: 0 }).success).toBe(false);
    expect(createWorkoutLogSchema.safeParse({ ...validCreate, reps: -5 }).success).toBe(false);
  });

  it("rejects negative weight but allows zero (bodyweight exercises)", () => {
    expect(createWorkoutLogSchema.safeParse({ ...validCreate, weightKg: -1 }).success).toBe(false);
    expect(createWorkoutLogSchema.safeParse({ ...validCreate, weightKg: 0 }).success).toBe(true);
  });

  it("rejects a non-integer set number", () => {
    expect(createWorkoutLogSchema.safeParse({ ...validCreate, setNumber: 1.5 }).success).toBe(false);
  });
});

describe("updateWorkoutLogSchema", () => {
  it("accepts a partial update with just one field", () => {
    expect(updateWorkoutLogSchema.safeParse({ reps: 12 }).success).toBe(true);
  });

  it("still rejects an invalid value for a field that is present", () => {
    expect(updateWorkoutLogSchema.safeParse({ reps: 0 }).success).toBe(false);
  });
});
