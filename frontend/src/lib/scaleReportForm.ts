import { saveScaleReportSchema, type SaveScaleReportInput, type ScaleReportDraft } from "@fitnesstracker/shared";

// The review form of a scale report: every number of the draft is a text field the user can fix
// (OCR now and then reads a digit wrong), and the texts are turned back into a validated payload.

export interface ReportField {
  id: string; // dotted path into { weightKg, ..., details: { ... } }
  label: string;
  unit: string;
  section: "main" | "more" | "imp20" | "imp100";
  // Label under which the draft lists the value as not covered by any check.
  uncertainAs?: string;
}

const SEGMENTS = [
  ["rightArm", "Rechter Arm"],
  ["leftArm", "Linker Arm"],
  ["trunk", "Rumpf"],
  ["rightLeg", "Rechtes Bein"],
  ["leftLeg", "Linkes Bein"],
] as const;

export const REPORT_FIELDS: ReportField[] = [
  { id: "weightKg", label: "Gewicht", unit: "kg", section: "main" },
  { id: "details.fatMassKg", label: "Fettmasse", unit: "kg", section: "main" },
  { id: "bodyFatPercent", label: "Körperfett", unit: "%", section: "main" },
  { id: "muscleMassKg", label: "Muskelmasse", unit: "kg", section: "main" },
  { id: "details.waterKg", label: "Wasser", unit: "kg", section: "main" },
  { id: "bodyWaterPercent", label: "Wasser", unit: "%", section: "main" },
  { id: "details.fatFreeMassKg", label: "Fettfreie Masse", unit: "kg", section: "more" },
  { id: "details.boneMassKg", label: "Knochenmasse", unit: "kg", section: "more" },
  { id: "details.proteinKg", label: "Eiweiß", unit: "kg", section: "more" },
  { id: "details.skeletalMuscleKg", label: "Skelettmuskel", unit: "kg", section: "more" },
  { id: "details.subcutaneousFatPercent", label: "Subkutanes Fett", unit: "%", section: "more", uncertainAs: "Subkutanes Fett" },
  { id: "details.visceralFat", label: "Viszeralfett", unit: "", section: "more", uncertainAs: "Viszeralfett" },
  { id: "details.basalMetabolicRateKcal", label: "Grundumsatz", unit: "kcal", section: "more", uncertainAs: "Grundumsatz" },
  { id: "details.bodyAge", label: "Körperalter", unit: "Jahre", section: "more", uncertainAs: "Körperalter" },
  { id: "details.asmi", label: "ASMI", unit: "kg/m²", section: "more", uncertainAs: "ASMI" },
  { id: "details.waistHipRatio", label: "WHR", unit: "", section: "more", uncertainAs: "WHR" },
  { id: "details.score", label: "Körperpunktzahl", unit: "", section: "more", uncertainAs: "Körperpunktzahl" },
  ...(["khz20", "khz100"] as const).flatMap((band) =>
    SEGMENTS.map(([segment, label]) => ({
      id: `details.impedance.${band}.${segment}`,
      label,
      unit: "Ω",
      section: (band === "khz20" ? "imp20" : "imp100") as ReportField["section"],
    })),
  ),
];

function getPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), source);
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let node = target;
  for (const key of keys.slice(0, -1)) {
    node = (node[key] ??= {}) as Record<string, unknown>;
  }
  node[keys.at(-1)!] = value;
}

const formatNumber = (value: number) => String(value).replace(".", ",");
const parseNumber = (text: string) => Number(text.trim().replace(",", "."));

export function draftToTexts(draft: ScaleReportDraft): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const field of REPORT_FIELDS) {
    const value = getPath(draft, field.id);
    texts[field.id] = typeof value === "number" ? formatNumber(value) : "";
  }
  return texts;
}

export type TextsResult = { ok: true; input: SaveScaleReportInput } | { ok: false; message: string };

// Empty fields are left out; a field with text that is not a number, or values the server would
// refuse, produce a message naming the problem.
export function textsToInput(draft: ScaleReportDraft, texts: Record<string, string>): TextsResult {
  const payload: Record<string, unknown> = { measuredAt: draft.measuredAt, details: { source: "fitdays-report" } };
  for (const field of REPORT_FIELDS) {
    const text = texts[field.id]?.trim() ?? "";
    if (text === "") continue;
    const value = parseNumber(text);
    if (!Number.isFinite(value)) return { ok: false, message: `„${field.label}“ ist keine Zahl.` };
    setPath(payload, field.id, value);
  }
  // A band counts only when all five segments are there.
  const impedance = (payload.details as { impedance?: Record<string, Record<string, number>> }).impedance;
  if (impedance) {
    for (const band of ["khz20", "khz100"]) {
      if (impedance[band] && Object.keys(impedance[band]).length < SEGMENTS.length) delete impedance[band];
    }
    if (Object.keys(impedance).length === 0) delete (payload.details as Record<string, unknown>).impedance;
  }
  const parsed = saveScaleReportSchema.safeParse(payload);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.join(".") ?? "";
    const field = REPORT_FIELDS.find((f) => f.id === path);
    return { ok: false, message: field ? `Bitte „${field.label}${field.unit ? ` (${field.unit})` : ""}“ prüfen.` : "Bitte die Werte prüfen (Gewicht, Fett, Muskeln und Wasser sind Pflicht)." };
  }
  return { ok: true, input: parsed.data };
}
