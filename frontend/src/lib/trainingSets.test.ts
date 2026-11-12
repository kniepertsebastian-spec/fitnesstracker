import { describe, expect, it } from "vitest";
import { formatLastTime } from "./trainingSets";

const sets = (reps: number[], weights: number[]) => reps.map((r, i) => ({ reps: r, weightKg: weights[i] ?? weights[0] }));

describe("formatLastTime", () => {
  it("shows a dash without earlier sets", () => {
    expect(formatLastTime([])).toBe("–");
  });

  it("collapses equal reps and weight to sets × reps", () => {
    expect(formatLastTime(sets([10, 10, 10], [82.5]))).toBe("3 × 10 · 82,5 kg");
  });

  it("lists the reps actually done when they differ", () => {
    expect(formatLastTime(sets([10, 9, 8], [82.5]))).toBe("10/9/8 · 82,5 kg");
  });

  it("shows a weight range when the weight changed between sets", () => {
    expect(formatLastTime(sets([8, 8, 6], [80, 80, 85]))).toBe("8/8/6 · 80–85 kg");
  });

  it("shortens very long set lists", () => {
    expect(formatLastTime(sets([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], [20]))).toBe("10/9/8/7/6/5/4/3/… · 20 kg");
  });
});
