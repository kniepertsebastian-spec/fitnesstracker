import {
  NUTRIENT_KEYS,
  roundNutrients,
  roundTo,
  sumNutrients,
  type NutrientKey,
  type NutrientValues,
  type Nutrients,
} from "../nutrition/nutrients.js";

// The export report (PDF, CSV, Markdown, JSON), built only from the stored snapshots of the
// logged meals: what the user ate as it was recorded, never recalculated from today's foods.
// Pure functions, covered by nutritionReport.test.ts.

export interface ReportEntryInput {
  name: string;
  brand: string | null;
  quantity: number;
  unitLabel: string;
  grams: number | null;
  nutrients: NutrientValues;
}

export interface ReportMealInput {
  date: string;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  eatenAt: string | null;
  entries: ReportEntryInput[];
}

export interface ReportTargets {
  targetCalories: number;
  targetProteinG: number;
  fatG: number;
  carbsG: number;
  nutritionPhase: string;
}

export interface ReportInput {
  from: string;
  to: string;
  timeZone: string;
  generatedAt: string;
  meals: ReportMealInput[];
  ratings: { date: string; score: number; note: string | null }[];
  // Today's targets from the Fitnesstracker profile. Past targets are not stored, so the deltas of
  // every day are measured against the current ones (the report says so).
  targets: ReportTargets | null;
}

export interface ReportDay {
  date: string;
  logged: boolean;
  totals: Nutrients;
  estimatedFields: NutrientKey[];
  delta: { kcal: number | null; proteinG: number | null } | null;
  rating: { score: number; note: string | null } | null;
  meals: { mealType: ReportMealInput["mealType"]; eatenAt: string | null; totals: Nutrients; entries: ReportEntryInput[] }[];
}

export interface NutritionReport {
  range: { from: string; to: string; days: number };
  timeZone: string;
  generatedAt: string;
  targets: ReportTargets | null;
  targetsNote: string;
  days: ReportDay[];
  averages: {
    loggedDays: number;
    // Averaged over the days with at least one entry: a day without any log is a gap in the
    // record, not a day with 0 kcal.
    perLoggedDay: Nutrients;
    deltaKcal: number | null;
    deltaProteinG: number | null;
    ratedDays: number;
    rating: number | null;
  };
}

export const MEAL_LABELS: Record<ReportMealInput["mealType"], string> = {
  BREAKFAST: "Frühstück",
  LUNCH: "Mittagessen",
  DINNER: "Abendessen",
  SNACK: "Snack",
};
const MEAL_ORDER = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;

export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
  return days;
}

// "days=7" means the last 7 days including today.
export function rangeForDays(today: string, days: number): { from: string; to: string } {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return { from, to: today };
}

const r1 = (v: number | null) => (v === null ? null : roundTo(v, 1));

export function buildNutritionReport(input: ReportInput): NutritionReport {
  const ratings = new Map(input.ratings.map((r) => [r.date, r]));
  const days: ReportDay[] = daysBetween(input.from, input.to).map((date) => {
    const mealsOfDay = input.meals
      .filter((m) => m.date === date)
      .sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType) || (a.eatenAt ?? "").localeCompare(b.eatenAt ?? ""));
    const entries = mealsOfDay.flatMap((m) => m.entries);
    const total = roundNutrients(sumNutrients(entries.map((e) => e.nutrients)));
    const logged = entries.length > 0;
    const rating = ratings.get(date);
    return {
      date,
      logged,
      totals: total.values,
      estimatedFields: total.estimated,
      delta:
        logged && input.targets
          ? {
              kcal: total.values.kcal === null ? null : r1(total.values.kcal - input.targets.targetCalories),
              proteinG: total.values.proteinG === null ? null : r1(total.values.proteinG - input.targets.targetProteinG),
            }
          : null,
      rating: rating ? { score: rating.score, note: rating.note } : null,
      meals: mealsOfDay
        .filter((m) => m.entries.length > 0)
        .map((m) => ({
          mealType: m.mealType,
          eatenAt: m.eatenAt,
          totals: roundNutrients(sumNutrients(m.entries.map((e) => e.nutrients))).values,
          entries: m.entries,
        })),
    };
  });

  const loggedDays = days.filter((d) => d.logged);
  const perLoggedDay = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) {
    const known = loggedDays.map((d) => d.totals[key]).filter((v): v is number => v !== null);
    perLoggedDay[key] = known.length ? roundTo(known.reduce((a, b) => a + b, 0) / known.length, key === "kcal" ? 0 : 1) : null;
  }
  const rated = days.filter((d) => d.rating);
  const t = input.targets;
  return {
    range: { from: input.from, to: input.to, days: days.length },
    timeZone: input.timeZone,
    generatedAt: input.generatedAt,
    targets: t,
    targetsNote: t
      ? "Abweichungen gegen die heutigen Zielwerte aus dem Fitnesstracker-Profil (frühere Zielwerte werden nicht gespeichert)."
      : "Kein Fitnesstracker-Profil: ohne Zielwerte keine Abweichungen.",
    days,
    averages: {
      loggedDays: loggedDays.length,
      perLoggedDay,
      deltaKcal: t && perLoggedDay.kcal !== null ? r1(perLoggedDay.kcal - t.targetCalories) : null,
      deltaProteinG: t && perLoggedDay.proteinG !== null ? r1(perLoggedDay.proteinG - t.targetProteinG) : null,
      ratedDays: rated.length,
      rating: rated.length ? roundTo(rated.reduce((s, d) => s + d.rating!.score, 0) / rated.length, 1) : null,
    },
  };
}

// ─── Text formats ──────────────────────────────────────────────────────────────────────────────

const de = (v: number | null, digits = 1) =>
  v === null ? "–" : v.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: digits });
const signed = (v: number | null) => (v === null ? "–" : `${v > 0 ? "+" : ""}${de(v, 0)}`);
const csvNum = (v: number | null) => (v === null ? "" : String(v));

function csvCell(value: string): string {
  // Neutralise spreadsheet formulas (numbers such as "-120" stay numbers) and quote separators.
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// One row per day (semicolon-separated, decimal point: opens cleanly in German spreadsheets with
// the import dialog and in every script).
export function reportToCsv(report: NutritionReport): string {
  const head = ["Datum", "kcal", "Protein_g", "KH_g", "Fett_g", "Ballaststoffe_g", "Zucker_g", "Ges_Fett_g", "Salz_g", "Delta_kcal", "Delta_Protein_g", "Bewertung", "Mahlzeiten", "geschaetzt"];
  const rows = report.days.map((d) =>
    [
      d.date,
      ...NUTRIENT_KEYS.map((k) => (d.logged ? csvNum(d.totals[k]) : "")),
      csvNum(d.delta?.kcal ?? null),
      csvNum(d.delta?.proteinG ?? null),
      d.rating ? String(d.rating.score) : "",
      String(d.meals.length),
      d.estimatedFields.join(" "),
    ]
      .map(csvCell)
      .join(";"),
  );
  return `${[head.join(";"), ...rows].join("\r\n")}\r\n`;
}

const mdEscape = (s: string) => s.replace(/[|\\`*_[\]<>]/g, (c) => `\\${c}`);

export function reportToMarkdown(report: NutritionReport): string {
  const a = report.averages;
  const t = report.targets;
  const lines: string[] = [
    `# Ernährungsbericht ${report.range.from} bis ${report.range.to}`,
    "",
    `${report.range.days} Tage, davon ${a.loggedDays} mit Einträgen · Zeitzone ${report.timeZone} · erstellt ${report.generatedAt.slice(0, 16).replace("T", " ")} UTC`,
    "",
    "## Durchschnitt pro erfasstem Tag",
    "",
    "| | kcal | Protein | KH | Fett | Ballaststoffe |",
    "| :-- | --: | --: | --: | --: | --: |",
    `| Ist | ${de(a.perLoggedDay.kcal, 0)} | ${de(a.perLoggedDay.proteinG)} g | ${de(a.perLoggedDay.carbsG)} g | ${de(a.perLoggedDay.fatG)} g | ${de(a.perLoggedDay.fiberG)} g |`,
  ];
  if (t) {
    lines.push(`| Ziel | ${de(t.targetCalories, 0)} | ${de(t.targetProteinG)} g | ${de(t.carbsG)} g | ${de(t.fatG)} g | |`);
    lines.push(`| Abweichung | ${signed(a.deltaKcal)} | ${signed(a.deltaProteinG)} g | | | |`);
  }
  lines.push("", `Bewertung: ${a.rating === null ? "–" : `${de(a.rating)} / 10 (${a.ratedDays} Tage)`}`, "", `_${report.targetsNote}_`, "", "## Tage", "");
  lines.push("| Datum | kcal | Δ kcal | Protein | Δ Protein | KH | Fett | Bewertung |", "| :-- | --: | --: | --: | --: | --: | --: | --: |");
  for (const d of report.days) {
    if (!d.logged && !d.rating) {
      lines.push(`| ${d.date} | – | | | | | | |`);
      continue;
    }
    const est = d.estimatedFields.length ? " *" : "";
    lines.push(
      `| ${d.date} | ${d.logged ? de(d.totals.kcal, 0) + est : "–"} | ${signed(d.delta?.kcal ?? null)} | ${d.logged ? de(d.totals.proteinG) : "–"} | ${signed(d.delta?.proteinG ?? null)} | ${d.logged ? de(d.totals.carbsG) : "–"} | ${d.logged ? de(d.totals.fatG) : "–"} | ${d.rating ? d.rating.score : "–"} |`,
    );
  }
  lines.push("", "\\* enthält geschätzte oder teils unbekannte Werte", "");
  for (const d of report.days.filter((x) => x.logged || x.rating)) {
    lines.push(`### ${d.date}`, "");
    if (d.rating) lines.push(`Bewertung ${d.rating.score}/10${d.rating.note ? `: ${mdEscape(d.rating.note)}` : ""}`, "");
    for (const m of d.meals) {
      lines.push(`**${MEAL_LABELS[m.mealType]}** (${de(m.totals.kcal, 0)} kcal, ${de(m.totals.proteinG)} g Protein)`, "");
      for (const e of m.entries) {
        const amount = `${de(e.quantity, 2)} ${e.unitLabel}${e.grams !== null && e.unitLabel.toLowerCase() !== "g" ? ` (${de(e.grams, 0)} g)` : ""}`;
        lines.push(`- ${mdEscape(e.name)}${e.brand ? ` (${mdEscape(e.brand)})` : ""}, ${amount}: ${de(e.nutrients.values.kcal, 0)} kcal, ${de(e.nutrients.values.proteinG)} g P, ${de(e.nutrients.values.carbsG)} g KH, ${de(e.nutrients.values.fatG)} g F`);
      }
      lines.push("");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
