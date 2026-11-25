import { describe, expect, it } from "vitest";
import { emptyNutrients, type NutrientValues } from "../nutrition/nutrients.js";
import { buildNutritionReport, rangeForDays, reportToCsv, reportToMarkdown, type ReportInput } from "./nutritionReport.js";
import { buildNutritionPdf } from "./nutritionPdf.js";

const n = (kcal: number | null, proteinG: number | null, carbsG = 0, fatG = 0, estimated: NutrientValues["estimated"] = []): NutrientValues => ({
  values: { ...emptyNutrients(), kcal, proteinG, carbsG, fatG },
  estimated,
});

const entry = (name: string, nutrients: NutrientValues) => ({ name, brand: null, quantity: 100, unitLabel: "g", grams: 100, nutrients });

const input: ReportInput = {
  from: "2026-11-01",
  to: "2026-11-03",
  timeZone: "Europe/Berlin",
  generatedAt: "2026-11-04T08:00:00.000Z",
  meals: [
    { date: "2026-11-01", mealType: "DINNER", eatenAt: null, entries: [entry("Proteinpasta", n(1200, 120, 100, 40))] },
    { date: "2026-11-01", mealType: "BREAKFAST", eatenAt: null, entries: [entry("Haferflocken", n(800, 40, 120, 15))] },
    // 3 Nov: one entry with unknown protein (free entry), one with an estimated kcal value.
    {
      date: "2026-11-03",
      mealType: "LUNCH",
      eatenAt: null,
      entries: [entry("=Kantine;Menü", n(900, null)), entry("Apfel", n(100, 0.5, 25, 0, ["kcal"]))],
    },
  ],
  ratings: [
    { date: "2026-11-01", score: 8, note: null },
    { date: "2026-11-02", score: 3, note: "Geburtstag" },
  ],
  targets: { targetCalories: 2500, targetProteinG: 160, fatG: 83, carbsG: 279, nutritionPhase: "MAINTAIN" },
};

describe("buildNutritionReport", () => {
  const report = buildNutritionReport(input);

  it("covers every day of the range, with or without logs", () => {
    expect(report.range).toEqual({ from: "2026-11-01", to: "2026-11-03", days: 3 });
    expect(report.days.map((d) => [d.date, d.logged])).toEqual([
      ["2026-11-01", true],
      ["2026-11-02", false],
      ["2026-11-03", true],
    ]);
  });

  it("sums snapshots per day and per meal, meals in day order", () => {
    const d1 = report.days[0]!;
    expect(d1.totals.kcal).toBe(2000);
    expect(d1.totals.proteinG).toBe(160);
    expect(d1.meals.map((m) => m.mealType)).toEqual(["BREAKFAST", "DINNER"]);
    expect(d1.delta).toEqual({ kcal: -500, proteinG: 0 });
  });

  it("marks partly unknown and estimated sums", () => {
    const d3 = report.days[2]!;
    expect(d3.totals.kcal).toBe(1000);
    expect(d3.totals.proteinG).toBe(0.5);
    expect(d3.estimatedFields).toContain("kcal");
    expect(d3.estimatedFields).toContain("proteinG");
  });

  it("averages over logged days only, ratings over rated days", () => {
    expect(report.averages.loggedDays).toBe(2);
    expect(report.averages.perLoggedDay.kcal).toBe(1500);
    expect(report.averages.deltaKcal).toBe(-1000);
    expect(report.averages.rating).toBe(5.5);
    expect(report.averages.ratedDays).toBe(2);
    expect(report.days[1]!.delta).toBeNull();
    expect(report.days[1]!.rating).toEqual({ score: 3, note: "Geburtstag" });
  });

  it("has no deltas without targets", () => {
    const r = buildNutritionReport({ ...input, targets: null });
    expect(r.days[0]!.delta).toBeNull();
    expect(r.averages.deltaKcal).toBeNull();
  });

  it("rangeForDays includes today", () => {
    expect(rangeForDays("2026-11-25", 7)).toEqual({ from: "2026-11-19", to: "2026-11-25" });
    expect(rangeForDays("2026-03-01", 31)).toEqual({ from: "2026-01-30", to: "2026-03-01" });
  });
});

describe("export formats", () => {
  const report = buildNutritionReport(input);

  it("CSV: one row per day, negative deltas stay numbers", () => {
    const lines = reportToCsv(report).trim().split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]!.startsWith("Datum;kcal;Protein_g")).toBe(true);
    expect(lines[1]).toContain(";-500;0;8;2;");
    expect(lines[2]).toBe("2026-11-02;;;;;;;;;;;3;0;");
  });

  it("Markdown escapes user text and shows averages", () => {
    const md = reportToMarkdown(report);
    expect(md).toContain("# Ernährungsbericht 2026-11-01 bis 2026-11-03");
    expect(md).toContain("| Abweichung | -1.000 |");
    expect(md).toContain("Bewertung 3/10: Geburtstag");
    expect(md).toContain("=Kantine;Menü");
    expect(md).not.toMatch(/\| =Kantine/);
  });

  it("PDF renders", async () => {
    const pdf = await buildNutritionPdf(report);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
