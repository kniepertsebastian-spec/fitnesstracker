import { describe, expect, it } from "vitest";
import { detectSetCountAsymmetries } from "./trainingAsymmetry.service.js";

describe("detectSetCountAsymmetries", () => {
  it("flags a material opposing-muscle imbalance", () => {
    expect(detectSetCountAsymmetries(new Map([["chest", 16], ["lats", 4]]))).toEqual([
      "Rücken/Ziehen wurde deutlich seltener trainiert als Brust/Drücken (4 vs. 16 Sätze in 8 Wochen). Im nächsten Plan ausgleichen.",
    ]);
  });

  it("does not flag balanced or insufficient history", () => {
    expect(detectSetCountAsymmetries(new Map([["quadriceps", 10], ["hamstrings", 6]]))).toEqual([]);
    expect(detectSetCountAsymmetries(new Map([["abdominals", 4], ["lower back", 1]]))).toEqual([]);
  });
});
