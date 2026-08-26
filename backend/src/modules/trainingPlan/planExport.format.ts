// Hand-rolled CSV/JSON/XML (de)serialization for the plan export/import — no parser dependency
// needed since the row shape is small and fixed (phase, exerciseName, targetSets, targetReps,
// order), and a real XML parser would be overkill (and pulls in XXE-adjacent surface) for a
// handful of flat tags.

export interface PlanExportRow {
  phase: string;
  exerciseName: string;
  targetSets: number | null;
  targetReps: number | null;
  order: number;
}

// Raw, not-yet-validated fields as read from an uploaded file — see planExport.service.ts's
// normalizeRow for validation/coercion.
export interface RawImportRow {
  phase?: unknown;
  exerciseName?: unknown;
  targetSets?: unknown;
  targetReps?: unknown;
  order?: unknown;
}

const CSV_COLUMNS = ["phase", "exerciseName", "targetSets", "targetReps", "order"] as const;

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv(rows: PlanExportRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.phase,
        csvEscape(row.exerciseName),
        row.targetSets ?? "",
        row.targetReps ?? "",
        row.order,
      ].join(","),
    );
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
  const table = csvToTable(text);
  if (table.length === 0) return [];
  const header = table[0].map((h) => h.trim());
  return table.slice(1).map((cols) => {
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      row[key] = cols[index] ?? "";
    });
    return row;
  });
}

export function rowsToJson(rows: PlanExportRow[]): string {
  return JSON.stringify(rows, null, 2);
}

export function parseJson(text: string): RawImportRow[] {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error("JSON root must be an array");
  }
  return data as RawImportRow[];
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
      (row) => `  <entry>
    <phase>${xmlEscape(row.phase)}</phase>
    <exerciseName>${xmlEscape(row.exerciseName)}</exerciseName>
    <targetSets>${row.targetSets ?? ""}</targetSets>
    <targetReps>${row.targetReps ?? ""}</targetReps>
    <order>${row.order}</order>
  </entry>`,
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
  return entries.map((block) => ({
    phase: extractTag(block, "phase"),
    exerciseName: extractTag(block, "exerciseName"),
    targetSets: extractTag(block, "targetSets"),
    targetReps: extractTag(block, "targetReps"),
    order: extractTag(block, "order"),
  }));
}
