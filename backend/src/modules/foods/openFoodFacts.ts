import { HttpError } from "../../errors/httpErrors.js";
import { emptyNutrients, type NutrientBasis, type NutrientKey, type NutrientValues } from "../nutrition/nutrients.js";

// Layer 3 of the food database: Open Food Facts, asked live for a barcode nobody has here yet.
// The caller caches the result in PostgreSQL for good (Food with source OFF), so every barcode is
// fetched at most once. Data: Open Food Facts contributors, Open Database License (ODbL).

const OFF_URL = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS = [
  "code",
  "product_name",
  "product_name_de",
  "brands",
  "nutriments",
  "product_quantity",
  "product_quantity_unit",
  "serving_quantity",
  "serving_quantity_unit",
].join(",");
// OFF asks API clients to identify themselves. A generic name, no contact data of the operator.
const USER_AGENT = "Kalorientracker/1.0";
export const OFF_ATTRIBUTION = "Open Food Facts (openfoodfacts.org), Lizenz ODbL 1.0";
const TIMEOUT_MS = 6000;

export interface OffProduct {
  barcode: string;
  name: string;
  brand: string | null;
  basis: NutrientBasis;
  nutrients: NutrientValues;
  units: { label: string; baseAmount: number }[];
}

const OFF_KEYS: [NutrientKey, string][] = [
  ["proteinG", "proteins_100g"],
  ["carbsG", "carbohydrates_100g"],
  ["fatG", "fat_100g"],
  ["fiberG", "fiber_100g"],
  ["sugarG", "sugars_100g"],
  ["saturatedFatG", "saturated-fat_100g"],
  ["saltG", "salt_100g"],
];

const KJ_PER_KCAL = 4.184;

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

// Maps an OFF API answer. Values the product page does not state stay null (unknown); kcal
// derived from kJ and salt derived from sodium are marked as estimated.
export function mapOffProduct(barcode: string, body: unknown): OffProduct | null {
  if (!body || typeof body !== "object") return null;
  const { status, product } = body as { status?: unknown; product?: Record<string, unknown> };
  if (status !== 1 || !product || typeof product !== "object") return null;

  const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
  const values = emptyNutrients();
  const estimated: NutrientKey[] = [];

  values.kcal = num(nutriments["energy-kcal_100g"]);
  if (values.kcal === null) {
    const kj = num(nutriments["energy-kj_100g"]) ?? num(nutriments["energy_100g"]);
    if (kj !== null) {
      values.kcal = kj / KJ_PER_KCAL;
      estimated.push("kcal");
    }
  }
  for (const [key, field] of OFF_KEYS) values[key] = num(nutriments[field]);
  if (values.saltG === null) {
    const sodium = num(nutriments["sodium_100g"]);
    if (sodium !== null) {
      values.saltG = sodium * 2.5;
      estimated.push("saltG");
    }
  }

  const quantityUnit = text(product.product_quantity_unit)?.toLowerCase();
  const basis: NutrientBasis = quantityUnit === "ml" || quantityUnit === "l" || quantityUnit === "cl" ? "PER_100ML" : "PER_100G";
  const baseUnit = basis === "PER_100ML" ? "ml" : "g";
  const units: OffProduct["units"] = [];
  const packQuantity = num(product.product_quantity);
  if (packQuantity && (quantityUnit === undefined || quantityUnit === baseUnit)) {
    units.push({ label: "Packung", baseAmount: packQuantity });
  }
  const servingQuantity = num(product.serving_quantity);
  const servingUnit = text(product.serving_quantity_unit)?.toLowerCase();
  if (servingQuantity && (servingUnit === undefined || servingUnit === baseUnit)) {
    units.push({ label: "Portion", baseAmount: servingQuantity });
  }

  const brand = text(product.brands)?.split(",")[0]?.trim() || null;
  const name = text(product.product_name_de) ?? text(product.product_name) ?? `Produkt ${barcode}`;
  return { barcode, name, brand, basis, nutrients: { values, estimated }, units };
}

export type OffFetcher = (barcode: string) => Promise<OffProduct | null>;

export const fetchOpenFoodFacts: OffFetcher = async (barcode) => {
  let res: Response;
  try {
    res = await fetch(`${OFF_URL}/${encodeURIComponent(barcode)}?fields=${FIELDS}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, "Open Food Facts ist gerade nicht erreichbar");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, "Open Food Facts ist gerade nicht erreichbar");
  return mapOffProduct(barcode, await res.json().catch(() => null));
};
