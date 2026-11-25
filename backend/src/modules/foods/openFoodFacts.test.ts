import { describe, expect, it } from "vitest";
import { mapOffProduct } from "./openFoodFacts.js";

describe("mapOffProduct", () => {
  it("maps nutrients per 100 g, pack and serving", () => {
    const p = mapOffProduct("4000000000001", {
      status: 1,
      product: {
        product_name_de: "Proteinpasta",
        product_name: "Protein pasta",
        brands: "Beispielmarke, Andere",
        product_quantity: "250",
        product_quantity_unit: "g",
        serving_quantity: 125,
        nutriments: {
          "energy-kcal_100g": 350,
          proteins_100g: 25,
          carbohydrates_100g: "50",
          fat_100g: 3,
          fiber_100g: 8,
          sugars_100g: 2.5,
          "saturated-fat_100g": 0.6,
          salt_100g: 0.02,
        },
      },
    });
    expect(p).not.toBeNull();
    expect(p!.name).toBe("Proteinpasta");
    expect(p!.brand).toBe("Beispielmarke");
    expect(p!.basis).toBe("PER_100G");
    expect(p!.nutrients.values).toEqual({ kcal: 350, proteinG: 25, carbsG: 50, fatG: 3, fiberG: 8, sugarG: 2.5, saturatedFatG: 0.6, saltG: 0.02 });
    expect(p!.nutrients.estimated).toEqual([]);
    expect(p!.units).toEqual([
      { label: "Packung", baseAmount: 250 },
      { label: "Portion", baseAmount: 125 },
    ]);
  });

  it("keeps missing values unknown and marks derived ones as estimated", () => {
    const p = mapOffProduct("4000000000002", {
      status: 1,
      product: { product_name: "Saft", product_quantity: 1000, product_quantity_unit: "ml", nutriments: { "energy-kj_100g": 184.1, sodium_100g: 0.004 } },
    });
    expect(p!.basis).toBe("PER_100ML");
    expect(p!.nutrients.values.kcal).toBeCloseTo(44, 2);
    expect(p!.nutrients.values.saltG).toBeCloseTo(0.01, 6);
    expect(p!.nutrients.values.proteinG).toBeNull();
    expect(p!.nutrients.values.fatG).toBeNull();
    expect(p!.nutrients.estimated).toEqual(["kcal", "saltG"]);
    expect(p!.units).toEqual([{ label: "Packung", baseAmount: 1000 }]);
  });

  it("does not turn a pack in liters into a gram measure", () => {
    const p = mapOffProduct("4000000000003", { status: 1, product: { product_name: "Milch", product_quantity: 1, product_quantity_unit: "l", nutriments: {} } });
    expect(p!.basis).toBe("PER_100ML");
    expect(p!.units).toEqual([]);
  });

  it("returns null for unknown products and junk", () => {
    expect(mapOffProduct("1", { status: 0, status_verbose: "product not found" })).toBeNull();
    expect(mapOffProduct("1", null)).toBeNull();
    expect(mapOffProduct("1", "<html>")).toBeNull();
  });

  it("rejects negative or non-numeric values instead of using them", () => {
    const p = mapOffProduct("4000000000004", { status: 1, product: { product_name: "X", nutriments: { "energy-kcal_100g": -5, proteins_100g: "abc" } } });
    expect(p!.nutrients.values.kcal).toBeNull();
    expect(p!.nutrients.values.proteinG).toBeNull();
  });
});
