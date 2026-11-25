import PDFDocument from "pdfkit";
import { MEAL_LABELS, type NutritionReport } from "./nutritionReport.js";

// PDF of the nutrition report: averages against the targets, one table row per day, then the
// meals of each day. Built-in Helvetica (WinAnsi only, like activityPdf.ts): user-entered names
// are reduced to characters it can print.

const MARGIN = 40;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const BOTTOM = 842 - MARGIN;
const ACCENT = "#7c3aed";
const TEXT = "#111827";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const HEAD_FILL = "#f3f4f6";

const printable = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF–—„“”‚‘’…•€]/g, "?");
const de = (v: number | null, digits = 1) =>
  v === null ? "–" : v.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: digits });
const signed = (v: number | null) => (v === null ? "–" : `${v > 0 ? "+" : ""}${de(v, 0)}`);
const shortDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.`;
const longDate = (date: string) => `${shortDate(date)}${date.slice(0, 4)}`;

export function buildNutritionPdf(report: NutritionReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      info: { Title: "Ernährungsbericht", Author: "Kalorientracker", Subject: `${report.range.from} bis ${report.range.to}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, report);
    drawAverages(doc, report);
    drawDayTable(doc, report);
    drawMeals(doc, report);
    doc.end();
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > BOTTOM) doc.addPage();
}

function drawHeader(doc: PDFKit.PDFDocument, report: NutritionReport) {
  doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(20).text("Ernährungsbericht", MARGIN, MARGIN);
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(
      `Zeitraum ${longDate(report.range.from)} bis ${longDate(report.range.to)} · ${report.range.days} Tage, ${report.averages.loggedDays} mit Einträgen · erstellt am ${longDate(report.generatedAt.slice(0, 10))} · Zeitzone ${report.timeZone}`,
      MARGIN,
      doc.y + 2,
      { width: CONTENT_WIDTH },
    );
  doc.moveDown(0.8);
}

function drawAverages(doc: PDFKit.PDFDocument, report: NutritionReport) {
  const a = report.averages;
  const t = report.targets;
  const tiles: [string, string, string][] = [
    ["Ø kcal", de(a.perLoggedDay.kcal, 0), t ? `Ziel ${de(t.targetCalories, 0)} · ${signed(a.deltaKcal)}` : "kein Ziel"],
    ["Ø Protein", `${de(a.perLoggedDay.proteinG)} g`, t ? `Ziel ${de(t.targetProteinG, 0)} g · ${signed(a.deltaProteinG)} g` : "kein Ziel"],
    ["Ø KH / Fett", `${de(a.perLoggedDay.carbsG, 0)} / ${de(a.perLoggedDay.fatG, 0)} g`, t ? `Ziel ${de(t.carbsG, 0)} / ${de(t.fatG, 0)} g` : ""],
    ["Ø Bewertung", a.rating === null ? "–" : `${de(a.rating)} / 10`, `${a.ratedDays} Tage bewertet`],
  ];
  const w = CONTENT_WIDTH / tiles.length;
  const top = doc.y;
  tiles.forEach(([label, value, sub], i) => {
    const x = MARGIN + i * w;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(label, x, top, { width: w - 8 });
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(15).text(value, x, top + 11, { width: w - 8 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(sub, x, top + 31, { width: w - 8 });
  });
  doc.y = top + 46;
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(7.5).text(report.targetsNote, MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(1);
}

const COLUMNS: { title: string; width: number }[] = [
  { title: "Datum", width: 70 },
  { title: "kcal", width: 55 },
  { title: "Diff. kcal", width: 60 },
  { title: "Protein", width: 55 },
  { title: "Diff. P", width: 50 },
  { title: "KH", width: 50 },
  { title: "Fett", width: 50 },
  { title: "Ballast.", width: 50 },
  { title: "Bewertung", width: CONTENT_WIDTH - 440 },
];

function drawRow(doc: PDFKit.PDFDocument, cells: string[], y: number, bold = false) {
  let x = MARGIN;
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(TEXT);
  cells.forEach((cell, i) => {
    const col = COLUMNS[i]!;
    doc.text(cell, x + 3, y + 4, { width: col.width - 6, align: i === 0 ? "left" : "right", lineBreak: false });
    x += col.width;
  });
}

function drawDayTable(doc: PDFKit.PDFDocument, report: NutritionReport) {
  const rowH = 16;
  const head = () => {
    ensureSpace(doc, rowH * 2);
    const y = doc.y;
    doc.rect(MARGIN, y, CONTENT_WIDTH, rowH).fill(HEAD_FILL);
    drawRow(doc, COLUMNS.map((c) => c.title), y, true);
    doc.y = y + rowH;
  };
  head();
  for (const d of report.days) {
    if (doc.y + rowH > BOTTOM) {
      doc.addPage();
      head();
    }
    const y = doc.y;
    const est = d.estimatedFields.length ? "*" : "";
    const v = (n: number | null, digits = 0) => (d.logged ? de(n, digits) : "–");
    drawRow(
      doc,
      [
        longDate(d.date),
        d.logged ? `${de(d.totals.kcal, 0)}${est}` : "–",
        signed(d.delta?.kcal ?? null),
        v(d.totals.proteinG),
        signed(d.delta?.proteinG ?? null),
        v(d.totals.carbsG),
        v(d.totals.fatG),
        v(d.totals.fiberG),
        d.rating ? `${d.rating.score}/10` : "–",
      ],
      y,
    );
    doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + CONTENT_WIDTH, y + rowH).strokeColor(LINE).lineWidth(0.5).stroke();
    doc.y = y + rowH;
  }
  doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text("* enthält geschätzte oder teils unbekannte Werte · Gramm-Angaben gerundet", MARGIN, doc.y + 4);
  doc.moveDown(1.2);
}

function drawMeals(doc: PDFKit.PDFDocument, report: NutritionReport) {
  const days = report.days.filter((d) => d.logged || d.rating);
  if (days.length === 0) return;
  ensureSpace(doc, 40);
  doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(13).text("Mahlzeiten", MARGIN, doc.y);
  doc.moveDown(0.4);
  for (const d of days) {
    ensureSpace(doc, 36);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(10).text(
      `${longDate(d.date)} · ${de(d.totals.kcal, 0)} kcal · ${de(d.totals.proteinG)} g Protein${d.rating ? ` · Bewertung ${d.rating.score}/10` : ""}`,
      MARGIN,
      doc.y,
    );
    if (d.rating?.note) doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8).text(printable(d.rating.note), { width: CONTENT_WIDTH });
    for (const m of d.meals) {
      ensureSpace(doc, 24);
      doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(8.5).text(`${MEAL_LABELS[m.mealType]} · ${de(m.totals.kcal, 0)} kcal`, MARGIN + 6, doc.y + 2);
      for (const e of m.entries) {
        ensureSpace(doc, 12);
        const amount = `${de(e.quantity, 2)} ${e.unitLabel}${e.grams !== null && e.unitLabel.toLowerCase() !== "g" ? ` (${de(e.grams, 0)} g)` : ""}`;
        const n = e.nutrients.values;
        doc
          .fillColor(TEXT)
          .font("Helvetica")
          .fontSize(8)
          .text(
            printable(`${e.name}${e.brand ? ` (${e.brand})` : ""}, ${amount}: ${de(n.kcal, 0)} kcal · ${de(n.proteinG)} g P · ${de(n.carbsG)} g KH · ${de(n.fatG)} g F`),
            MARGIN + 14,
            doc.y,
            { width: CONTENT_WIDTH - 14 },
          );
      }
    }
    doc.moveDown(0.6);
  }
}
