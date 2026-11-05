import { describe, expect, it } from "vitest";
import { buildExclusions, isExcluded } from "./injuryFilter.js";

const bench = { name: "Barbell Bench Press", nameDe: "Bankdrücken", primaryMuscles: ["chest"] };
const lateral = { name: "Side Lateral Raise", nameDe: null, primaryMuscles: ["shoulders"] };
const legPress = { name: "Leg Press", nameDe: "Beinpresse", primaryMuscles: ["quadriceps"] };
const row = { name: "Seated Cable Rows", nameDe: null, primaryMuscles: ["middle back"] };

describe("injury filter", () => {
  it("excludes shoulder-heavy exercises for a shoulder limitation", () => {
    const ex = buildExclusions("Schulterprobleme rechts");
    expect(isExcluded(bench, ex)).toBe(true);
    expect(isExcluded(lateral, ex)).toBe(true);
    expect(isExcluded(row, ex)).toBe(false);
  });

  it("matches English wording and ignores unrelated text", () => {
    expect(isExcluded(bench, buildExclusions("right shoulder pain"))).toBe(true);
    expect(isExcluded(bench, buildExclusions("keine"))).toBe(false);
    expect(isExcluded(bench, buildExclusions(undefined, null))).toBe(false);
  });

  it("does not treat a plain muscle mention as an injury", () => {
    expect(isExcluded(bench, buildExclusions("Schultern und Rücken priorisieren"))).toBe(false);
    expect(isExcluded(bench, buildExclusions("Rechte Schulter schmerzt seit Wochen"))).toBe(true);
  });

  it("keeps unrelated regions untouched", () => {
    expect(isExcluded(legPress, buildExclusions("Schulter"))).toBe(false);
  });
});
