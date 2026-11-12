import { describe, expect, it } from "vitest";
import { categoryLabel, equipmentLabel, muscleLabel } from "./exerciseLabels";

describe("exercise labels", () => {
  it("translates catalog keys", () => {
    expect(muscleLabel("abdominals")).toBe("Bauch");
    expect(muscleLabel("Lower Back")).toBe("Unterer Rücken");
    expect(equipmentLabel("dumbbell")).toBe("Kurzhantel");
    expect(categoryLabel("strength")).toBe("Kraft");
  });
  it("keeps unknown and already German values", () => {
    expect(muscleLabel("Rotatorenmanschette")).toBe("Rotatorenmanschette");
    expect(equipmentLabel("Kurzhantel")).toBe("Kurzhantel");
  });
});
