import { inflateRawSync } from "node:zlib";

// Minimal reader for the first worksheet of an .xlsx file (a zip of XML parts), enough for
// tabular data exports such as the BLS: shared strings, inline strings, numbers, booleans.
// No formulas evaluated (the cached value is used), no styles, no dates. Kept dependency-free
// on purpose: it only runs in the import script, never on user uploads.

export type XlsxCell = string | number | boolean | null;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Reads every entry of a zip archive into memory, by path. */
export function readZip(buf: Buffer): Map<string, Buffer> {
  // End of central directory: last 22 bytes plus an optional comment of up to 64 KiB.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Keine gültige ZIP-/XLSX-Datei");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== CENTRAL_SIGNATURE) throw new Error("Beschädigtes ZIP-Verzeichnis");
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (buf.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) throw new Error(`Beschädigter ZIP-Eintrag ${name}`);
    const dataStart = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const data = buf.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, inflateRawSync(data));
    else throw new Error(`ZIP-Kompression ${method} wird nicht unterstützt (${name})`);
  }
  return files;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) =>
    e.startsWith("#x") ? String.fromCodePoint(parseInt(e.slice(2), 16)) : e.startsWith("#") ? String.fromCodePoint(parseInt(e.slice(1), 10)) : ENTITIES[e]!,
  );
}

/** Concatenated text of all <t> runs (plain and rich text), without phonetic hints (<rPh>). */
function textOf(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  for (const m of withoutPhonetic.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1];
  return decodeXml(out);
}

function sharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => (m[1] === undefined ? "" : textOf(m[1])));
}

/** "A" -> 0, "Z" -> 25, "AA" -> 26 */
export function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function firstSheetPath(files: Map<string, Buffer>): string {
  const workbook = files.get("xl/workbook.xml")?.toString("utf8");
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  const rid = workbook?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (rid && rels) {
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      if (m[0].includes(`Id="${rid}"`)) {
        const target = m[0].match(/Target="([^"]+)"/)?.[1];
        if (target) return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      }
    }
  }
  return "xl/worksheets/sheet1.xml";
}

/**
 * Rows of the first worksheet as arrays indexed by column (gaps are null), in sheet order.
 * Empty rows are skipped.
 */
export function readXlsxRows(buf: Buffer): XlsxCell[][] {
  const files = readZip(buf);
  const strings = sharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8"));
  const sheetPath = firstSheetPath(files);
  const sheet = files.get(sheetPath)?.toString("utf8");
  if (!sheet) throw new Error(`Arbeitsblatt ${sheetPath} fehlt`);

  const rows: XlsxCell[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const body = rowMatch[1];
    if (!body) continue;
    const row: XlsxCell[] = [];
    let next = 0;
    for (const c of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]!;
      const inner = c[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      const col = ref ? columnIndex(ref) : next;
      next = col + 1;
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value: XlsxCell = null;
      if (type === "s") value = v === undefined ? null : (strings[Number(v)] ?? null);
      else if (type === "inlineStr") value = textOf(inner.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "");
      else if (type === "str" || type === "e") value = v === undefined ? null : decodeXml(v);
      else if (type === "b") value = v === "1";
      else if (v !== undefined) value = Number(v);
      while (row.length < col) row.push(null);
      row[col] = value;
    }
    if (row.some((x) => x !== null && x !== "")) rows.push(row);
  }
  return rows;
}
