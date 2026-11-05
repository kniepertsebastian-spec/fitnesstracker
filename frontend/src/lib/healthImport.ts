// Reads body weight (and body fat) out of health-app exports. A browser app cannot talk to
// Apple Health, Samsung Health or Health Connect directly (they are on-device APIs of native
// apps), so the supported route is the export file each of them can produce:
//   - Apple Health: export.zip (or the export.xml inside it)
//   - Samsung Health: "Download personal data" -> ZIP with one CSV per category
//   - Google / anything else: a CSV with a date column and a weight column
// Everything stays on the device until the user confirms the import.
import { Unzip, UnzipInflate } from "fflate";

export interface HealthMeasurement {
  measuredAt: string; // ISO
  weightKg: number;
  bodyFatPercent?: number;
}

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;
const LB_TO_KG = 0.45359237;

function plausible(weightKg: number): boolean {
  return Number.isFinite(weightKg) && weightKg >= MIN_WEIGHT_KG && weightKg <= MAX_WEIGHT_KG;
}

// --- Apple Health (export.xml) --------------------------------------------------------------

// "2024-01-05 08:15:30 +0100" -> ISO. Returns null for anything else.
export function parseAppleDate(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const date = new Date(`${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function attribute(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}

// Collects weight and body fat records line by line (Apple writes one element per line), so a
// multi-hundred-megabyte export never has to be held in memory. Body fat is attached to the weight
// recorded at the same moment (smart scales write both).
export class AppleHealthScanner {
  private rest = "";
  private weights = new Map<string, number>();
  private fats = new Map<string, number>();

  push(text: string): void {
    const lines = (this.rest + text).split("\n");
    this.rest = lines.pop() ?? "";
    for (const line of lines) this.line(line);
  }

  private line(raw: string): void {
    if (!raw.includes("<Record") || !(raw.includes("BodyMass\"") || raw.includes("BodyFatPercentage\""))) return;
    const type = attribute(raw, "type");
    const startDate = attribute(raw, "startDate");
    const value = Number(attribute(raw, "value"));
    const at = startDate ? parseAppleDate(startDate) : null;
    if (!at || !Number.isFinite(value)) return;
    if (type === "HKQuantityTypeIdentifierBodyMass") {
      const kg = attribute(raw, "unit") === "lb" ? value * LB_TO_KG : value;
      if (plausible(kg)) this.weights.set(at, kg);
    } else if (type === "HKQuantityTypeIdentifierBodyFatPercentage") {
      // Stored as a fraction (0.21) by HealthKit; tolerate exports that already hold percent.
      const percent = value <= 1 ? value * 100 : value;
      if (percent > 0 && percent < 100) this.fats.set(at, percent);
    }
  }

  finish(): HealthMeasurement[] {
    if (this.rest) this.line(this.rest);
    this.rest = "";
    return [...this.weights.entries()]
      .map(([measuredAt, weightKg]) => {
        const fat = this.fats.get(measuredAt);
        return fat === undefined ? { measuredAt, weightKg } : { measuredAt, weightKg, bodyFatPercent: fat };
      })
      .sort((a, b) => (a.measuredAt < b.measuredAt ? -1 : 1));
  }
}

// --- CSV (Samsung Health, Google Takeout, spreadsheets) --------------------------------------

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(current);
      current = "";
    } else current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function detectDelimiter(line: string): string {
  const counts = [",", ";", "\t"].map((d) => ({ d, n: line.split(d).length }));
  return counts.sort((a, b) => b.n - a.n)[0].d;
}

const DATE_HEADER = /^(start_?time|create_?time|update_?time|measured_?at|date|datum|timestamp|zeit|time)\b/i;

function findColumn(headers: string[], test: (h: string) => boolean, prefer: (h: string) => boolean = () => false): number {
  const hits = headers.map((h, i) => ({ h, i })).filter(({ h }) => test(h));
  return (hits.find(({ h }) => prefer(h)) ?? hits[0])?.i ?? -1;
}

// ISO, "YYYY-MM-DD HH:mm:ss", "DD.MM.YYYY[ HH:mm]" or epoch seconds/milliseconds -> ISO.
// Date-only values are placed at noon local time so they stay on that day in any timezone.
export function parseFlexibleDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{9,}$/.test(v)) {
    const n = Number(v);
    return new Date(n > 1e11 ? n : n * 1000).toISOString();
  }
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(v);
  if (m) {
    const date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), m[4] ? Number(m[4]) : 12, m[5] ? Number(m[5]) : 0);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0).toISOString();
  const parsed = new Date(v.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

// Finds the header row (Samsung puts a one-line description above it), then the date, weight and —
// when present — body fat columns by name. Returns [] when no weight column can be identified.
export function parseHealthCsv(text: string): HealthMeasurement[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  for (let headerRow = 0; headerRow < Math.min(3, lines.length - 1); headerRow++) {
    const delimiter = detectDelimiter(lines[headerRow]);
    const headers = splitCsvLine(lines[headerRow], delimiter).map((h) => (h.startsWith("com.") ? h.slice(h.lastIndexOf(".") + 1) : h));
    const dateCol = findColumn(headers, (h) => DATE_HEADER.test(h), (h) => /^(start_?time|date|datum)/i.test(h));
    const weightCol = findColumn(
      headers,
      (h) => /(weight|gewicht)/i.test(h) && !/(height|muscle|goal|mass_index|ziel)/i.test(h),
      (h) => /^(weight|gewicht)$/i.test(h) || /(average|durchschnitt).*(weight|gewicht)/i.test(h),
    );
    const fatCol = findColumn(headers, (h) => /(body_?fat|körperfett|koerperfett|fat_?percent)/i.test(h) && !/mass/i.test(h));
    if (dateCol < 0 || weightCol < 0) continue;

    const result: HealthMeasurement[] = [];
    for (const line of lines.slice(headerRow + 1)) {
      const cells = splitCsvLine(line, delimiter);
      const measuredAt = parseFlexibleDate(cells[dateCol] ?? "");
      const weightKg = parseNumber(cells[weightCol] ?? "");
      if (!measuredAt || !plausible(weightKg)) continue;
      const fat = fatCol >= 0 ? parseNumber(cells[fatCol] ?? "") : NaN;
      result.push(
        Number.isFinite(fat) && fat > 0 && fat < 100
          ? { measuredAt, weightKg, bodyFatPercent: fat }
          : { measuredAt, weightKg },
      );
    }
    return result;
  }
  return [];
}

// --- Files -----------------------------------------------------------------------------------

async function* chunksOf(file: File): AsyncGenerator<Uint8Array> {
  const reader = file.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    yield value;
  }
}

function dedupe(measurements: HealthMeasurement[]): HealthMeasurement[] {
  const byTime = new Map<string, HealthMeasurement>();
  for (const m of measurements) byTime.set(m.measuredAt, { ...byTime.get(m.measuredAt), ...m });
  return [...byTime.values()].sort((a, b) => (a.measuredAt < b.measuredAt ? -1 : 1));
}

async function readZip(file: File): Promise<HealthMeasurement[]> {
  const apple = new AppleHealthScanner();
  const found: HealthMeasurement[] = [];
  const pending: Promise<void>[] = [];
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (entry) => {
    const name = entry.name.toLowerCase();
    const isAppleXml = name.endsWith("export.xml");
    const isCsv = name.endsWith(".csv") && /(weight|gewicht|body|metrics|fit)/.test(name);
    if (!isAppleXml && !isCsv) return;
    const decoder = new TextDecoder();
    let csv = "";
    pending.push(
      new Promise<void>((resolve, reject) => {
        entry.ondata = (error, data, final) => {
          if (error) return reject(error);
          const text = decoder.decode(data, { stream: !final });
          if (isAppleXml) apple.push(text);
          else csv += text;
          if (final) {
            if (isCsv) found.push(...parseHealthCsv(csv));
            resolve();
          }
        };
        entry.start();
      }),
    );
  };
  for await (const chunk of chunksOf(file)) unzip.push(chunk, false);
  unzip.push(new Uint8Array(0), true);
  await Promise.all(pending);
  return [...apple.finish(), ...found];
}

async function readXml(file: File): Promise<HealthMeasurement[]> {
  const apple = new AppleHealthScanner();
  const decoder = new TextDecoder();
  for await (const chunk of chunksOf(file)) apple.push(decoder.decode(chunk, { stream: true }));
  apple.push(decoder.decode());
  return apple.finish();
}

// Detects the format from the file name; throws a readable message for anything else.
export async function readHealthFile(file: File): Promise<HealthMeasurement[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) return dedupe(await readZip(file));
  if (name.endsWith(".xml")) return dedupe(await readXml(file));
  if (name.endsWith(".csv") || name.endsWith(".txt")) return dedupe(parseHealthCsv(await file.text()));
  throw new Error("Bitte eine ZIP-, XML- oder CSV-Datei wählen.");
}
