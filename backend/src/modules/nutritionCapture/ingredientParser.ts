import type { CaptureStatus } from "@fitnesstracker/shared";

// Deterministic parsing of amounts: ingredient lines from a JSON-LD recipe ("200 g Mehl",
// "1/2 TL Salz", "2-3 Knoblauchzehen") and units the AI heard in a spoken meal. Only what is
// written is taken: a range becomes its middle and is marked estimated, a line without an amount
// ("Salz und Pfeffer", "etwas Öl") keeps quantity null and is marked unknown, so the app asks.

export interface ParsedAmount {
  quantity: number | null;
  /** Normalised unit label: g, ml, EL, TL, Stück, ... or the unit as written; null without one. */
  unit: string | null;
  status: CaptureStatus;
}

export interface ParsedIngredient extends ParsedAmount {
  name: string;
  raw: string;
}

const UNICODE_FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

// Lower-case spelling -> unit label (and factor to it). Units with a fixed weight convert to g/ml.
const UNITS: Record<string, { label: string; factor?: number }> = {
  g: { label: "g" },
  gr: { label: "g" },
  gramm: { label: "g" },
  grams: { label: "g" },
  gram: { label: "g" },
  kg: { label: "g", factor: 1000 },
  kilogramm: { label: "g", factor: 1000 },
  ml: { label: "ml" },
  milliliter: { label: "ml" },
  cl: { label: "ml", factor: 10 },
  dl: { label: "ml", factor: 100 },
  l: { label: "ml", factor: 1000 },
  liter: { label: "ml", factor: 1000 },
  el: { label: "EL" },
  essl: { label: "EL" },
  esslöffel: { label: "EL" },
  tbsp: { label: "EL" },
  tl: { label: "TL" },
  teel: { label: "TL" },
  teelöffel: { label: "TL" },
  tsp: { label: "TL" },
  stück: { label: "Stück" },
  stk: { label: "Stück" },
  st: { label: "Stück" },
  prise: { label: "Prise" },
  prisen: { label: "Prise" },
  msp: { label: "Messerspitze" },
  messerspitze: { label: "Messerspitze" },
  dose: { label: "Dose" },
  dosen: { label: "Dose" },
  packung: { label: "Packung" },
  packungen: { label: "Packung" },
  pck: { label: "Packung" },
  pkg: { label: "Packung" },
  päckchen: { label: "Packung" },
  becher: { label: "Becher" },
  bund: { label: "Bund" },
  zehe: { label: "Zehe" },
  zehen: { label: "Zehe" },
  scheibe: { label: "Scheibe" },
  scheiben: { label: "Scheibe" },
  tasse: { label: "Tasse" },
  tassen: { label: "Tasse" },
  cup: { label: "Tasse" },
  cups: { label: "Tasse" },
  glas: { label: "Glas" },
  gläser: { label: "Glas" },
  handvoll: { label: "Handvoll" },
  portion: { label: "Portion" },
  portionen: { label: "Portion" },
};

/** Maps a spoken or written unit to its label ("Gramm" -> "g", "Esslöffel" -> "EL"); unknown units stay as written. */
export function normalizeUnit(unit: string | null | undefined): { label: string; factor: number } | null {
  if (!unit) return null;
  const key = unit.trim().toLowerCase().replace(/\.$/, "");
  if (!key) return null;
  const hit = UNITS[key];
  return hit ? { label: hit.label, factor: hit.factor ?? 1 } : { label: unit.trim().slice(0, 40), factor: 1 };
}

// Order matters: the mixed number and the fraction before the plain number, or "1/2" stops at "1".
const NUMBER = String.raw`(?:\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?(?:\s*[½¼¾⅓⅔⅛])?|[½¼¾⅓⅔⅛])`;
const AMOUNT_RE = new RegExp(String.raw`^\s*(${NUMBER})(?:\s*(?:-|–|bis)\s*(${NUMBER}))?\s*(.*)$`, "i");

function parseNumber(text: string): number | null {
  const t = text.trim();
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (fraction) return Number(fraction[2]) === 0 ? null : Number(fraction[1]) / Number(fraction[2]);
  const withUnicode = /^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔⅛])?$/.exec(t);
  if (withUnicode && (withUnicode[1] || withUnicode[2])) {
    const whole = withUnicode[1] ? Number(withUnicode[1].replace(",", ".")) : 0;
    return whole + (withUnicode[2] ? UNICODE_FRACTIONS[withUnicode[2]]! : 0);
  }
  return null;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function parseIngredientLine(line: string): ParsedIngredient {
  const raw = line.replace(/\s+/g, " ").trim();
  const match = AMOUNT_RE.exec(raw);
  if (!match) return { raw, name: raw, quantity: null, unit: null, status: "unknown" };

  const from = parseNumber(match[1]!);
  const to = match[2] ? parseNumber(match[2]) : null;
  if (from === null) return { raw, name: raw, quantity: null, unit: null, status: "unknown" };
  let quantity = to !== null && to > from ? (from + to) / 2 : from;
  const status: CaptureStatus = to !== null && to > from ? "estimated" : "verified";

  let rest = match[3]!.trim();
  let unit: string | null = null;
  const unitMatch = /^([A-Za-zÄÖÜäöüß]+)\.?(?:\s+|$)(.*)$/.exec(rest);
  if (unitMatch) {
    const known = UNITS[unitMatch[1]!.toLowerCase()];
    if (known) {
      unit = known.label;
      quantity *= known.factor ?? 1;
      rest = unitMatch[2]!.trim();
    }
  }
  // "3 Eier" has no unit: the count is pieces.
  if (!unit) unit = "Stück";
  const name = rest.replace(/^(?:von|vom|der|die|das)\s+/i, "").trim() || raw;
  if (quantity <= 0) return { raw, name, quantity: null, unit, status: "unknown" };
  return { raw, name, quantity: round(quantity), unit, status };
}
