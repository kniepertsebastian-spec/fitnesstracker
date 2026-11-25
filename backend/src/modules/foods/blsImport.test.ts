import { describe, expect, it } from "vitest";
import type { XlsxCell } from "../../lib/xlsx.js";
import { BLS_MICRO_CODES, mapBlsRows, parseBlsValue } from "./blsImport.js";

// Header as in BLS_4_0_Daten_2025_DE.xlsx: per nutrient value, origin, reference.
const nutrientCols: [string, string][] = [
  ["ENERCC Energie (Kilokalorien)", "kcal"],
  ["PROT625 Protein (Nx6,25)", "g"],
  ["FAT Fett", "g"],
  ["CHO Kohlenhydrate, verfügbar", "g"],
  ["FIBT Ballaststoffe, gesamt", "g"],
  ["NACL Salz (Natriumchlorid)", "g"],
  ["SUGAR Zucker (Mono- und Disaccharide), gesamt", "g"],
  ["FASAT Fettsäuren, gesättigt, gesamt", "g"],
  ["VITC Vitamin C", "mg"],
  ["VITD Vitamin D", "µg"],
];
const header: XlsxCell[] = ["BLS Code", "Lebensmittelbezeichnung", "Food name"];
for (const [title, unit] of nutrientCols) {
  const code = title.split(" ")[0];
  header.push(`${title} [${unit}/100g]`, `${code} Datenherkunft`, `${code} Referenz`);
}
const row = (code: string, name: string, values: XlsxCell[]): XlsxCell[] => [code, name, "en", ...values.flatMap((v) => [v, "Analyse", "Ref"])];

describe("parseBlsValue", () => {
  it("keeps numbers, treats traces as estimated 0 and '-' as unknown", () => {
    expect(parseBlsValue(11.375)).toEqual({ value: 11.375, estimated: false });
    expect(parseBlsValue("3,5")).toEqual({ value: 3.5, estimated: false });
    expect(parseBlsValue("TR")).toEqual({ value: 0, estimated: true });
    expect(parseBlsValue("<LOD")).toEqual({ value: 0, estimated: true });
    expect(parseBlsValue("<LOD or <LOQ")).toEqual({ value: 0, estimated: true });
    expect(parseBlsValue("-")).toBeNull();
    expect(parseBlsValue(null)).toBeNull();
    expect(parseBlsValue(-1)).toBeNull();
    expect(parseBlsValue("k.A.")).toBeNull();
  });
});

describe("mapBlsRows", () => {
  const { foods, skipped, missingMicros } = mapBlsRows([
    header,
    row("B111000", "Weizenmehl Type 405", [343, 11.375, 1.0, 70.9, 4, 0.002, 0.7, 0.15, "-", "TR"]),
    row("M111100", "Vollmilch 3,5 %", [64, 3.3, 3.5, 4.7, "-", 0.11, 4.7, "<LOQ", 1.7, 0.08]),
    row("", "ohne Code", [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    row("B111000", "Duplikat", [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
  ]);

  it("maps the main nutrients by code, German name", () => {
    expect(foods).toHaveLength(2);
    expect(skipped).toBe(2);
    expect(foods[0]).toMatchObject({
      code: "B111000",
      name: "Weizenmehl Type 405",
      nutrients: { kcal: 343, proteinG: 11.375, fatG: 1, carbsG: 70.9, fiberG: 4, saltG: 0.002, sugarG: 0.7, saturatedFatG: 0.15 },
      estimatedFields: [],
    });
  });

  it("marks traces as estimated and leaves missing values unknown", () => {
    const milk = foods[1]!;
    expect(milk.nutrients.fiberG).toBeNull();
    expect(milk.nutrients.saturatedFatG).toBe(0);
    expect(milk.estimatedFields).toEqual(["saturatedFatG"]);
  });

  it("stores micronutrients with the unit from the header", () => {
    expect(foods[0]!.micronutrients).toEqual({ VITD: { value: 0, unit: "µg", estimated: true } });
    expect(foods[1]!.micronutrients).toEqual({ VITC: { value: 1.7, unit: "mg" }, VITD: { value: 0.08, unit: "µg" } });
    expect(missingMicros).toHaveLength(BLS_MICRO_CODES.length - 2);
  });

  it("refuses a file without the main nutrient columns", () => {
    expect(() => mapBlsRows([["BLS Code", "Lebensmittelbezeichnung", "ENERCC Energie [kcal/100g]"]])).toThrow(/Hauptnährwerte/);
  });
});
