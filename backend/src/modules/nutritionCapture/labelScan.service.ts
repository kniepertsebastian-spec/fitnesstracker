import { labelScanAiSchema, type AiNumber, type CaptureStatus, type LabelScanAi } from "@fitnesstracker/shared";
import { NUTRIENT_KEYS, emptyNutrients, type NutrientBasis, type NutrientKey, type Nutrients } from "../nutrition/nutrients.js";
import { parseAiAnswer, type GeminiCaller, type GeminiMedia } from "./gemini.js";
import { checkPlausibility, type PlausibilityResult } from "./plausibility.js";

// Scan & Learn: the photo of a nutrition table (and optionally the front of the pack or the
// spoken product name) becomes a draft of the user's own food. Nothing is saved here: the app
// shows the draft with every field's status, the user corrects what is marked, and saving goes
// through the normal food upsert (layer 1, with the barcode), so the next scan finds it at once.

export function labelScanPrompt(hints: { productName?: string | null; barcode?: string | null; hasFront: boolean }): string {
  const name = hints.productName ? `Der Nutzer nennt das Produkt ${JSON.stringify(hints.productName)}.` : "";
  return `Du liest die Nährwerttabelle eines Lebensmittels von einem Foto ab${hints.hasFront ? " (zweites Bild: Vorderseite der Packung für Name und Marke)" : ""}. ${name}
Regeln:
- Übertrage nur, was lesbar auf dem Bild steht. Erfinde keine Werte und schätze keine Werte aus allgemeinem Wissen.
- Nutze die Spalte "pro 100 g" bzw. "pro 100 ml". Steht nur ein Wert pro Portion da und ist die Portionsgröße lesbar, rechne auf 100 um und setze status "estimated".
- Ein Wert, der fehlt, verdeckt oder unleserlich ist: value null, status "unknown".
- status "read" nur für Werte, die du eindeutig gelesen hast. kJ-Angaben nicht als kcal übernehmen; fehlt kcal, dann unknown.
- Natrium ist nicht Salz: Steht nur Natrium da, saltG = Natrium * 2,5 mit status "estimated".
- Zahlen mit Punkt als Dezimaltrenner (1,5 -> 1.5). "<0,5" -> 0.5 mit status "estimated". "Spuren" -> 0 mit status "estimated".
- basis: "PER_100ML" bei Getränken/Flüssigkeiten mit Angabe pro 100 ml, sonst "PER_100G"; null, wenn nicht erkennbar.
- name und brand nur, wenn sie auf einem Bild stehen oder vom Nutzer genannt wurden, sonst null.
- packageSize: Füllmenge der Packung (z. B. 500 g), servingSize: angegebene Portion (z. B. 30 g, label "Portion").
- notes: kurze Hinweise auf Lesbarkeitsprobleme (deutsch), sonst leer.
Antworte ausschließlich mit JSON in genau dieser Form:
{"name":string|null,"brand":string|null,"basis":"PER_100G"|"PER_100ML"|null,
"nutrients":{"kcal":{"value":number|null,"status":"read"|"estimated"|"unknown"},"proteinG":{...},"carbsG":{...},"fatG":{...},"fiberG":{...},"sugarG":{...},"saturatedFatG":{...},"saltG":{...}},
"packageSize":{"value":number|null,"unit":"g"|"ml"|null,"status":"read"|"estimated"|"unknown"},
"servingSize":{"value":number|null,"unit":"g"|"ml"|null,"label":string|null,"status":"read"|"estimated"|"unknown"},
"notes":[string]}`;
}

export interface SuggestedUnit {
  label: string;
  baseAmount: number;
  status: CaptureStatus;
}

export interface LabelScanDraft {
  name: string | null;
  nameStatus: CaptureStatus;
  brand: string | null;
  barcode: string | null;
  basis: NutrientBasis;
  basisStatus: CaptureStatus;
  per100: Nutrients;
  status: Record<NutrientKey, CaptureStatus>;
  /** The keys to save as estimated with the food (status "estimated"). */
  estimatedFields: NutrientKey[];
  suggestedUnits: SuggestedUnit[];
  plausibility: PlausibilityResult;
  notes: string[];
}

const toStatus = (s: AiNumber["status"]): CaptureStatus => (s === "read" ? "verified" : s);

export function toLabelScanDraft(ai: LabelScanAi, hints: { productName?: string | null; barcode?: string | null }): LabelScanDraft {
  const per100 = emptyNutrients();
  const status = {} as Record<NutrientKey, CaptureStatus>;
  for (const key of NUTRIENT_KEYS) {
    const v = ai.nutrients[key];
    per100[key] = v.value;
    status[key] = toStatus(v.status);
  }
  const basis: NutrientBasis = ai.basis ?? "PER_100G";
  const unitOk = (unit: "g" | "ml" | null) => unit === (basis === "PER_100G" ? "g" : "ml");

  const suggestedUnits: SuggestedUnit[] = [];
  const pkg = ai.packageSize;
  if (pkg && pkg.value !== null && pkg.status !== "unknown" && unitOk(pkg.unit)) {
    suggestedUnits.push({ label: "Packung", baseAmount: pkg.value, status: toStatus(pkg.status) });
  }
  const serving = ai.servingSize;
  if (serving && serving.value !== null && serving.status !== "unknown" && unitOk(serving.unit)) {
    const label = (serving.label ?? "Portion").slice(0, 40);
    if (!suggestedUnits.some((u) => u.label.toLowerCase() === label.toLowerCase())) {
      suggestedUnits.push({ label, baseAmount: serving.value, status: toStatus(serving.status) });
    }
  }

  // A name the user said beats a guess; a name read from the pack beats nothing.
  const spoken = hints.productName?.trim() || null;
  const name = ai.name ?? spoken;
  const notes = [...ai.notes];
  if (!ai.basis) notes.push("Bezugsgröße nicht erkannt, pro 100 g angenommen.");

  return {
    name,
    nameStatus: ai.name ? "verified" : spoken ? "verified" : "unknown",
    brand: ai.brand,
    barcode: hints.barcode ?? null,
    basis,
    basisStatus: ai.basis ? "verified" : "estimated",
    per100,
    status,
    estimatedFields: NUTRIENT_KEYS.filter((k) => status[k] === "estimated"),
    suggestedUnits,
    plausibility: checkPlausibility(per100, basis),
    notes,
  };
}

export async function scanNutritionLabel(
  callGemini: GeminiCaller,
  input: { label: GeminiMedia; front?: GeminiMedia | null; productName?: string | null; barcode?: string | null },
): Promise<LabelScanDraft> {
  const media = [input.label, ...(input.front ? [input.front] : [])];
  const answer = await callGemini({ prompt: labelScanPrompt({ productName: input.productName, barcode: input.barcode, hasFront: !!input.front }), media, timeoutMs: 45_000 });
  return toLabelScanDraft(parseAiAnswer(labelScanAiSchema, answer, "Nährwerttabelle"), input);
}
