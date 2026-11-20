// Hand-rolled CSV/JSON/XML (de)serialization for the plan export/import — no parser dependency
// needed since the row shape is small and fixed, and a real XML parser would be overkill (and
// pulls in XXE-adjacent surface) for a handful of flat tags.
//
// Format v2 carries everything a plan entry has (day, rep range, RIR, pause, notes, start weight,
// alternative, technique, group, set scheme), so a phase can be moved between phases or accounts without losing the split days.
// Files of the first format (phase, exerciseName, targetSets, targetReps, order) still import: a
// field that is absent from the file stays untouched, a field that is present but empty clears it.

export interface PlanExportRow {
  phase: string;
  exerciseName: string;
  targetSets: number | null;
  targetReps: number | null;
  order: number;
  dayLabel: string | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
  targetRir: number | null;
  restSeconds: number | null;
  notes: string | null;
  startWeightKg: number | null;
  alternativeExerciseName: string | null;
  technique: string | null;
  techniqueGroup: string | null;
  setScheme: string | null;
}

// Raw, not-yet-validated fields as read from an uploaded file — see planExport.service.ts's
// normalizeRow for validation/coercion. `undefined` = the file has no such column.
export interface RawImportRow {
  phase?: unknown;
  exerciseName?: unknown;
  targetSets?: unknown;
  targetReps?: unknown;
  order?: unknown;
  dayLabel?: unknown;
  repRangeMin?: unknown;
  repRangeMax?: unknown;
  targetRir?: unknown;
  restSeconds?: unknown;
  notes?: unknown;
  startWeightKg?: unknown;
  alternativeExerciseName?: unknown;
  technique?: unknown;
  techniqueGroup?: unknown;
  setScheme?: unknown;
}

export const PLAN_COLUMNS = [
  "phase",
  "exerciseName",
  "targetSets",
  "targetReps",
  "order",
  "dayLabel",
  "repRangeMin",
  "repRangeMax",
  "targetRir",
  "restSeconds",
  "notes",
  "startWeightKg",
  "alternativeExerciseName",
  "technique",
  "techniqueGroup",
  "setScheme",
] as const satisfies readonly (keyof PlanExportRow)[];

type Column = (typeof PLAN_COLUMNS)[number];

function cell(row: PlanExportRow, column: Column): string {
  const value = row[column];
  return value === null || value === undefined ? "" : String(value);
}

function csvEscape(value: string): string {
  // A cell that starts with = + - @ would run as a formula when the file is opened in a spreadsheet.
  const safe = /^[=+@]/.test(value) || /^-(?!\d)/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function rowsToCsv(rows: PlanExportRow[]): string {
  const lines = [PLAN_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(PLAN_COLUMNS.map((column) => csvEscape(cell(row, column))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

// Full-text tokenizer (not line-split) so a quoted field containing a newline doesn't break
// row boundaries.
function csvToTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i++;
    } else if (ch === "\r") {
      i++;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function parseCsv(text: string): RawImportRow[] {
  const table = csvToTable(text.replace(/^\uFEFF/, ""));
  if (table.length === 0) return [];
  const header = table[0].map((h) => h.trim());
  return table.slice(1).map((cols) => {
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      // Undo the formula guard of csvEscape.
      const value = cols[index] ?? "";
      row[key] = value.startsWith("'") && /^'[=+\-@]/.test(value) ? value.slice(1) : value;
    });
    return row;
  });
}

export function rowsToJson(rows: PlanExportRow[]): string {
  return JSON.stringify(rows, null, 2);
}

export function parseJson(text: string): RawImportRow[] {
  const data: unknown = JSON.parse(text);
  if (Array.isArray(data)) return data as RawImportRow[];
  // Also accept { "exercises": [...] } so a hand-edited or wrapped file still works.
  const wrapped = (data as { exercises?: unknown } | null)?.exercises;
  if (Array.isArray(wrapped)) return wrapped as RawImportRow[];
  throw new Error("JSON root must be an array");
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlUnescape(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function rowsToXml(rows: PlanExportRow[]): string {
  const entries = rows
    .map(
      (row) =>
        `  <entry>\n${PLAN_COLUMNS.map((column) => `    <${column}>${xmlEscape(cell(row, column))}</${column}>`).join("\n")}\n  </entry>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<trainingPlan>\n${entries}\n</trainingPlan>\n`;
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? xmlUnescape(match[1]) : undefined;
}

export function parseXml(text: string): RawImportRow[] {
  const entries = text.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.map((block) => {
    const row: Record<string, string | undefined> = {};
    for (const column of PLAN_COLUMNS) row[column] = extractTag(block, column);
    return row;
  });
}
