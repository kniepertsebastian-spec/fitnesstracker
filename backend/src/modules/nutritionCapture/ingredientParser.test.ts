import { describe, expect, it } from "vitest";
import { normalizeUnit, parseIngredientLine } from "./ingredientParser.js";

describe("parseIngredientLine", () => {
  it.each([
    ["200 g Mehl", 200, "g", "Mehl", "verified"],
    ["200g Magerquark", 200, "g", "Magerquark", "verified"],
    ["1,5 kg Kartoffeln", 1500, "g", "Kartoffeln", "verified"],
    ["0.5 l Milch", 500, "ml", "Milch", "verified"],
    ["250 ml Gemüsebrühe", 250, "ml", "Gemüsebrühe", "verified"],
    ["2 EL Olivenöl", 2, "EL", "Olivenöl", "verified"],
    ["1/2 TL Salz", 0.5, "TL", "Salz", "verified"],
    ["1 1/2 Tassen Reis", 1.5, "Tasse", "Reis", "verified"],
    ["½ Bund Petersilie", 0.5, "Bund", "Petersilie", "verified"],
    ["1½ Dosen Tomaten", 1.5, "Dose", "Tomaten", "verified"],
    ["3 Eier", 3, "Stück", "Eier", "verified"],
    ["2-3 Knoblauchzehen", 2.5, "Stück", "Knoblauchzehen", "estimated"],
    ["2 – 3 Zehen Knoblauch", 2.5, "Zehe", "Knoblauch", "estimated"],
    ["1 Pck. Backpulver", 1, "Packung", "Backpulver", "verified"],
  ])("%s", (line, quantity, unit, name, status) => {
    expect(parseIngredientLine(line)).toMatchObject({ quantity, unit, name, status });
  });

  it.each(["Salz und Pfeffer", "etwas Öl zum Braten", "Petersilie nach Belieben"])("%s has no amount: unknown", (line) => {
    expect(parseIngredientLine(line)).toMatchObject({ quantity: null, unit: null, status: "unknown", name: line });
  });

  it("keeps the original line", () => {
    expect(parseIngredientLine("  200  g   Mehl ").raw).toBe("200 g Mehl");
  });

  it("does not take a word starting like a unit as the unit", () => {
    // "Gurke" starts with "g", "Liebstöckel" with "l": only whole words are units.
    expect(parseIngredientLine("1 Gurke")).toMatchObject({ quantity: 1, unit: "Stück", name: "Gurke" });
    expect(parseIngredientLine("2 Limetten")).toMatchObject({ quantity: 2, unit: "Stück", name: "Limetten" });
  });

  it("treats a zero amount as unknown", () => {
    expect(parseIngredientLine("0 g Zucker")).toMatchObject({ quantity: null, status: "unknown" });
  });
});

describe("normalizeUnit", () => {
  it.each([
    ["Gramm", "g", 1],
    ["gramm", "g", 1],
    ["Kilogramm", "g", 1000],
    ["Milliliter", "ml", 1],
    ["Liter", "ml", 1000],
    ["Esslöffel", "EL", 1],
    ["EL", "EL", 1],
    ["Teelöffel", "TL", 1],
    ["Stück", "Stück", 1],
    ["Scheiben", "Scheibe", 1],
  ])("%s -> %s", (unit, label, factor) => {
    expect(normalizeUnit(unit)).toEqual({ label, factor });
  });

  it("keeps unknown units as said and returns null without one", () => {
    expect(normalizeUnit("Riegel")).toEqual({ label: "Riegel", factor: 1 });
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit("  ")).toBeNull();
  });
});
