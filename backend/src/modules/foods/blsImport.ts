import type { Prisma, PrismaClient } from "@prisma/client";
import type { XlsxCell } from "../../lib/xlsx.js";
import { NUTRIENT_KEYS, type NutrientKey, type Nutrients } from "../nutrition/nutrients.js";

// Bundeslebensmittelschlüssel 4.0 -> Food rows of layer 2 (source BLS, shared: userId null).
// The data file is the official "BLS_4_0_Daten_2025_DE.xlsx": one row per food, per nutrient the
// three columns "<CODE> <Name> [<unit>/100g]", "<CODE> Datenherkunft", "<CODE> Referenz".
// Columns are found by their code, never by position, so a reordered release still maps right.

export const BLS_ATTRIBUTION =
  "Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0, Lizenz CC BY 4.0";

const CORE_CODES: Record<string, NutrientKey> = {
  ENERCC: "kcal",
  PROT625: "proteinG",
  CHO: "carbsG",
  FAT: "fatG",
  FIBT: "fiberG",
  SUGAR: "sugarG",
  FASAT: "saturatedFatG",
  NACL: "saltG",
};

// Further nutrients kept as micronutrients JSON (EuroFIR codes as in the BLS).
export const BLS_MICRO_CODES = [
  "VITA", "VITD", "VITE", "VITK", "THIA", "RIBF", "NIAEQ", "PANTAC", "VITB6", "BIOT", "FOL", "VITB12", "VITC",
  "NA", "K", "CA", "MG", "P", "FE", "ZN", "ID", "CU", "MN", "FD", "CR", "MO", "CLD",
  "CHORL", "FAMS", "FAPU", "FAPUN3", "FAPUN6", "WATER", "ALC", "STARCH", "LACS",
] as const;

// A type alias (not an interface), so it is assignable to Prisma's JSON input type.
export type Micronutrient = {
  value: number;
  unit: string;
  estimated?: true;
};

export interface BlsFood {
  code: string;
  name: string;
  nutrients: Nutrients;
  estimatedFields: NutrientKey[];
  micronutrients: Record<string, Micronutrient>;
}

export type BlsValue = { value: number; estimated: boolean } | null;

/**
 * One BLS cell. Numbers are measured values. "TR" (trace) and "<LOD" / "<LOQ" (below the limit of
 * detection / quantification) count as 0, marked estimated: the true value is small but not
 * known. "-" means not analysed: null (unknown), never 0.
 */
export function parseBlsValue(cell: XlsxCell): BlsValue {
  if (typeof cell === "number") return Number.isFinite(cell) && cell >= 0 ? { value: cell, estimated: false } : null;
  if (typeof cell !== "string") return null;
  const s = cell.trim();
  if (s === "" || s === "-") return null;
  if (s.toUpperCase() === "TR" || s.startsWith("<")) return { value: 0, estimated: true };
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? { value: n, estimated: false } : null;
}

interface ValueColumn {
  index: number;
  unit: string;
}

const VALUE_HEADER = /^(\S+)\s.*\[([^\]/]+)\/100\s?g\]$/;

export function mapBlsColumns(header: XlsxCell[]) {
  const value = new Map<string, ValueColumn>();
  let code = -1;
  let name = -1;
  header.forEach((h, index) => {
    if (typeof h !== "string") return;
    const title = h.trim();
    if (title === "BLS Code") code = index;
    else if (title === "Lebensmittelbezeichnung") name = index;
    const m = title.match(VALUE_HEADER);
    if (m && !value.has(m[1]!)) value.set(m[1]!, { index, unit: m[2]!.trim() });
  });
  const missing = [...Object.keys(CORE_CODES), ...BLS_MICRO_CODES].filter((c) => !value.has(c));
  if (code < 0 || name < 0) throw new Error("BLS-Datei: Spalten „BLS Code“ / „Lebensmittelbezeichnung“ fehlen");
  if (Object.keys(CORE_CODES).some((c) => !value.has(c))) throw new Error(`BLS-Datei: Hauptnährwerte fehlen (${missing.join(", ")})`);
  return { code, name, value, missingMicros: missing };
}

/** Maps all data rows (first row = header). Rows without code or name are skipped. */
export function mapBlsRows(rows: XlsxCell[][]): { foods: BlsFood[]; skipped: number; missingMicros: string[] } {
  const [header, ...data] = rows;
  if (!header) return { foods: [], skipped: 0, missingMicros: [] };
  const cols = mapBlsColumns(header);
  const foods: BlsFood[] = [];
  let skipped = 0;
  const seen = new Set<string>();

  for (const row of data) {
    const code = String(row[cols.code] ?? "").trim();
    const name = String(row[cols.name] ?? "").trim();
    if (!code || !name || seen.has(code)) {
      skipped++;
      continue;
    }
    seen.add(code);

    const nutrients = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, null])) as Nutrients;
    const estimatedFields: NutrientKey[] = [];
    for (const [blsCode, key] of Object.entries(CORE_CODES)) {
      const v = parseBlsValue(row[cols.value.get(blsCode)!.index] ?? null);
      nutrients[key] = v?.value ?? null;
      if (v?.estimated) estimatedFields.push(key);
    }

    const micronutrients: Record<string, Micronutrient> = {};
    for (const blsCode of BLS_MICRO_CODES) {
      const col = cols.value.get(blsCode);
      if (!col) continue;
      const v = parseBlsValue(row[col.index] ?? null);
      if (v) micronutrients[blsCode] = v.estimated ? { value: v.value, unit: col.unit, estimated: true } : { value: v.value, unit: col.unit };
    }

    foods.push({ code, name, nutrients, estimatedFields, micronutrients });
  }
  return { foods, skipped, missingMicros: cols.missingMicros };
}

function foodData(f: BlsFood) {
  return {
    name: f.name,
    basis: "PER_100G" as const,
    ...f.nutrients,
    estimatedFields: f.estimatedFields,
    micronutrients: f.micronutrients satisfies Prisma.InputJsonValue,
    deletedAt: null,
  };
}

/**
 * Writes the BLS foods idempotently, keyed by (BLS, code): new codes are created, known ones
 * updated in place (same id, so recipes and logs that point at them stay linked; their own
 * snapshots are unaffected anyway). Never touches USER or OFF rows.
 */
export async function importBlsFoods(prisma: PrismaClient, foods: BlsFood[], batchSize = 250) {
  const existing = new Set(
    (await prisma.food.findMany({ where: { source: "BLS" }, select: { sourceRef: true } })).map((f) => f.sourceRef),
  );
  const fresh = foods.filter((f) => !existing.has(f.code));
  const known = foods.filter((f) => existing.has(f.code));

  for (let i = 0; i < fresh.length; i += batchSize) {
    await prisma.food.createMany({
      data: fresh.slice(i, i + batchSize).map((f) => ({ source: "BLS" as const, sourceRef: f.code, userId: null, ...foodData(f) })),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < known.length; i += batchSize) {
    await prisma.$transaction(
      known.slice(i, i + batchSize).map((f) =>
        prisma.food.update({ where: { source_sourceRef: { source: "BLS", sourceRef: f.code } }, data: foodData(f) }),
      ),
    );
  }
  return { created: fresh.length, updated: known.length };
}
