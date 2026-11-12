import { describe, expect, it } from "vitest";
import { germanExerciseName, loadNameTranslations } from "./nameTranslations.js";

describe("exercise name translations", () => {
  it("loads the shipped table", () => {
    expect(Object.keys(loadNameTranslations()).length).toBeGreaterThan(500);
  });
  it("translates a known name and returns undefined for an unknown one", () => {
    expect(germanExerciseName("Ab Crunch Machine")).toBe("Bauch-Crunch-Maschine");
    expect(germanExerciseName("Totally Unknown Exercise")).toBeUndefined();
  });
});
