import { describe, expect, it } from "vitest";
import type { CalcFood } from "../foods/food.service.js";
import { WEEKLY_DROP_CATALOG } from "./weeklyDrops.catalog.js";
import { CATALOG_BLS_FIXTURE } from "./weeklyDrops.fixture.js";
import { DROPS_PER_WEEK, MAX_KCAL, MIN_DROPS, MIN_PROTEIN_G, REPEAT_LOCK_WEEKS, computeCatalogRecipe, dropWeekStart, pickDrops } from "./weeklyDrops.service.js";

const foods = new Map<string, CalcFood>(
  Object.entries(CATALOG_BLS_FIXTURE).map(([code, [kcal, proteinG, carbsG, fatG]]) => [
    code,
    {
      id: `food-${code}`,
      name: code,
      brand: null,
      basis: "PER_100G",
      densityGPerMl: null,
      units: [],
      per100: { values: { kcal, proteinG, carbsG, fatG, fiberG: null, sugarG: null, saturatedFatG: null, saltG: null }, estimated: [] },
    },
  ]),
);

describe("dropWeekStart (Sunday 06:00 Berlin)", () => {
  it.each([
    ["2026-11-25T12:00:00Z", "2026-11-22"], // Wednesday
    ["2026-11-29T04:59:00Z", "2026-11-22"], // Sunday 05:59 CET: not yet
    ["2026-11-29T05:00:00Z", "2026-11-29"], // Sunday 06:00 CET
    ["2026-11-28T23:30:00Z", "2026-11-22"], // Sunday 00:30 in Berlin, Saturday in UTC
    ["2026-07-05T03:59:00Z", "2026-06-28"], // Sunday 05:59 CEST
    ["2026-07-05T04:00:00Z", "2026-07-05"], // Sunday 06:00 CEST
    ["2026-12-31T22:00:00Z", "2026-12-27"], // New Year's Eve
  ])("%s -> %s", (now, week) => {
    expect(dropWeekStart(new Date(now))).toBe(week);
  });
});

describe("catalog", () => {
  it("has unique keys and only codes with BLS values", () => {
    expect(new Set(WEEKLY_DROP_CATALOG.map((r) => r.key)).size).toBe(WEEKLY_DROP_CATALOG.length);
    for (const r of WEEKLY_DROP_CATALOG) for (const i of r.ingredients) expect(CATALOG_BLS_FIXTURE[i.bls], `${r.key}: ${i.bls}`).toBeDefined();
  });

  it.each(WEEKLY_DROP_CATALOG.map((r) => [r.key, r] as const))("%s: >= 30 g protein, <= 600 kcal per serving", (_key, recipe) => {
    const drop = computeCatalogRecipe(recipe, foods);
    expect(drop.missing).toEqual([]);
    expect(drop.perServing.values.proteinG!).toBeGreaterThanOrEqual(MIN_PROTEIN_G);
    expect(drop.perServing.values.kcal!).toBeLessThanOrEqual(MAX_KCAL);
    expect(drop.qualifies).toBe(true);
  });

  it("is big enough that the repeat lock never has to give way", () => {
    expect(WEEKLY_DROP_CATALOG.length).toBeGreaterThanOrEqual(DROPS_PER_WEEK * (REPEAT_LOCK_WEEKS + 1));
  });
});

describe("computeCatalogRecipe", () => {
  const porridge = WEEKLY_DROP_CATALOG.find((r) => r.key === "protein-porridge")!;

  it("sums raw weights: 60 g oats + 200 g quark + 100 g blueberries", () => {
    const drop = computeCatalogRecipe(porridge, foods);
    // 0.6*348 + 2*66 + 1*61 = 401.8 kcal; 0.6*13.22 + 2*11.85 + 0.5 = 32.13 g protein
    expect(drop.perServing.values.kcal).toBe(401.8);
    expect(drop.perServing.values.proteinG).toBe(32.13);
    expect(drop.ingredients.map((i) => i.foodId)).toEqual(["food-C133000", "food-M713100", "food-F304100"]);
  });

  it("does not offer a dish with a missing food", () => {
    const partial = new Map(foods);
    partial.delete("M713100");
    const drop = computeCatalogRecipe(porridge, partial);
    expect(drop.missing).toEqual(["Magerquark"]);
    expect(drop.qualifies).toBe(false);
  });
});

describe("pickDrops", () => {
  const all = () => true;

  it("is deterministic per week and differs between weeks", () => {
    const a = pickDrops(WEEKLY_DROP_CATALOG, "2026-11-22", new Set(), all).map((r) => r.key);
    expect(pickDrops(WEEKLY_DROP_CATALOG, "2026-11-22", new Set(), all).map((r) => r.key)).toEqual(a);
    expect(a).toHaveLength(DROPS_PER_WEEK);
    expect(pickDrops(WEEKLY_DROP_CATALOG, "2026-11-29", new Set(), all).map((r) => r.key)).not.toEqual(a);
  });

  it("skips dishes that are not eligible", () => {
    const picked = pickDrops(WEEKLY_DROP_CATALOG, "2026-11-22", new Set(), (key) => key.includes("haehnchen"));
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((r) => r.key.includes("haehnchen"))).toBe(true);
  });

  it("does not repeat a dish within the lock over a year of weeks", () => {
    const history: string[][] = [];
    let week = Date.parse("2026-01-04T00:00:00Z");
    for (let i = 0; i < 52; i++, week += 7 * 86400000) {
      const recent = new Set(history.slice(-REPEAT_LOCK_WEEKS).flat());
      const picked = pickDrops(WEEKLY_DROP_CATALOG, new Date(week).toISOString().slice(0, 10), recent, all).map((r) => r.key);
      expect(picked).toHaveLength(DROPS_PER_WEEK);
      for (const key of picked) expect(recent.has(key)).toBe(false);
      history.push(picked);
    }
  });

  it("brings back older dishes when too few fresh ones are left", () => {
    const recent = new Set(WEEKLY_DROP_CATALOG.slice(1).map((r) => r.key));
    const picked = pickDrops(WEEKLY_DROP_CATALOG, "2026-11-22", recent, all);
    expect(picked).toHaveLength(MIN_DROPS);
    expect(picked[0]!.key).toBe(WEEKLY_DROP_CATALOG[0]!.key);
  });
});
