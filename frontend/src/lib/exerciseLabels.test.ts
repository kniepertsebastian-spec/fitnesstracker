import { describe, expect, it } from "vitest";
import { categoryLabel, equipmentLabel, imageAlt, muscleLabel } from "./exerciseLabels";

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
  it("numbers alt texts only when there are several images", () => {
    expect(imageAlt("Kniebeuge", 0, 1)).toBe("Kniebeuge");
    expect(imageAlt("Kniebeuge", 0, 2)).toBe("Kniebeuge – Ansicht 1");
    expect(imageAlt("Kniebeuge", 1, 2)).toBe("Kniebeuge – Ansicht 2");
  });
});
