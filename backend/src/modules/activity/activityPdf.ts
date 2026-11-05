import PDFDocument from "pdfkit";
import type { ActivityReport, ActivityWeek } from "@fitnesstracker/shared";

// One-glance PDF of the activity report: totals, one table row per week, and a block per week with
// the step bars Monday to Sunday. Built-in Helvetica only (no font files to ship), so the text
// sticks to characters in its WinAnsi set (umlauts, "Ø", "–", "·" are fine).

const MARGIN = 40;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const BOTTOM = 842 - MARGIN;
const ACCENT = "#0d9488";
const TEXT = "#111827";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const HEAD_FILL = "#f3f4f6";
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const int = (value: number) => Math.round(value).toLocaleString("de-DE");
const dec = (value: number, digits = 1) =>
  value.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: digits });
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const shortDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.`;
const longDate = (date: string) => `${shortDate(date)}${date.slice(0, 4)}`;
const weekLabel = (week: ActivityWeek) => `KW ${week.isoWeek.slice(6)} · ${shortDate(week.weekStart)}–${shortDate(week.weekEnd)}`;

export function buildActivityPdf(report: ActivityReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      info: { Title: "Aktivitätsbericht", Author: "Fitnesstracker", Subject: `${report.range.from} bis ${report.range.to}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, report);
    drawTotals(doc, report);
    drawWeekTable(doc, report);
    drawWeekBlocks(doc, report);
    doc.end();
  });
}

function drawHeader(doc: PDFKit.PDFDocument, report: ActivityReport) {
  doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(20).text("Aktivitätsbericht", MARGIN, MARGIN);
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(
      `Zeitraum ${longDate(report.range.from)} bis ${longDate(report.range.to)} · ${report.weeks.length} Wochen · erstellt am ${longDate(report.generatedAt.slice(0, 10))} · Zeitzone ${report.timeZone}`,
      MARGIN,
      doc.y + 2,
    );
  doc.moveDown(0.8);
}

function drawTotals(doc: PDFKit.PDFDocument, report: ActivityReport) {
  const { totals } = report;
  const cards: { title: string; lines: string[] }[] = [
    {
      title: "Schritte",
      lines: [
        `Summe ${int(totals.steps.total)}`,
        totals.steps.averagePerDay === null ? "Ø pro Tag –" : `Ø pro Tag ${int(totals.steps.averagePerDay)}`,
        plural(totals.steps.daysWithData, "Tag mit Daten", "Tage mit Daten"),
      ],
    },
    {
      title: "Rad draußen",
      lines: [
        `${int(totals.cyclingOutdoor.minutes)} Min.`,
        totals.cyclingOutdoor.km === null ? "Strecke –" : `${dec(totals.cyclingOutdoor.km)} km`,
        plural(totals.cyclingOutdoor.rides, "Fahrt", "Fahrten"),
      ],
    },
    {
      title: "Rad Studio",
      lines: [`${int(totals.cyclingStudio.minutes)} Min.`, plural(totals.cyclingStudio.sessions, "Einheit", "Einheiten")],
    },
    {
      title: "Krafttraining",
      lines: [plural(totals.strength.trainingDays, "Trainingstag", "Trainingstage"), `${int(totals.strength.sets)} Sätze`, `${int(totals.strength.volumeKg)} kg Volumen`],
    },
  ];
  const gap = 8;
  const width = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  const top = doc.y;
  cards.forEach((card, i) => {
    const x = MARGIN + i * (width + gap);
    doc.roundedRect(x, top, width, 62, 6).fillAndStroke(HEAD_FILL, LINE);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(8.5).text(card.title.toUpperCase(), x + 8, top + 7, { width: width - 16 });
    doc.fillColor(TEXT).font("Helvetica").fontSize(9);
    card.lines.forEach((line, row) => doc.text(line, x + 8, top + 21 + row * 12, { width: width - 16 }));
  });
  doc.y = top + 62 + 16;
}

const TABLE_COLUMNS: { title: string; width: number; align: "left" | "right" }[] = [
  { title: "Woche", width: 108, align: "left" },
  { title: "Kraft Tage", width: 44, align: "right" },
  { title: "Sätze", width: 40, align: "right" },
  { title: "Vol. kg", width: 54, align: "right" },
  { title: "Schritte", width: 62, align: "right" },
  { title: "Ø/Tag", width: 50, align: "right" },
  { title: "Rad draußen Min.", width: 66, align: "right" },
  { title: "km", width: 44, align: "right" },
  { title: "Studio Min.", width: 47, align: "right" },
];

function drawWeekTable(doc: PDFKit.PDFDocument, report: ActivityReport) {
  doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(12).text("Wochenübersicht", MARGIN, doc.y);
  doc.moveDown(0.4);

  const rowHeight = 17;
  const headerHeight = 26;
  const drawRow = (cells: string[], y: number, header: boolean) => {
    let x = MARGIN;
    if (header) doc.rect(MARGIN, y, CONTENT_WIDTH, headerHeight).fill(HEAD_FILL);
    cells.forEach((cell, i) => {
      const column = TABLE_COLUMNS[i];
      doc
        .fillColor(header ? MUTED : TEXT)
        .font(header ? "Helvetica-Bold" : "Helvetica")
        .fontSize(header ? 7.5 : 8.5)
        .text(cell, x + 3, y + (header ? 4 : 5), { width: column.width - 6, align: column.align });
      x += column.width;
    });
    if (!header) doc.moveTo(MARGIN, y + rowHeight).lineTo(MARGIN + CONTENT_WIDTH, y + rowHeight).strokeColor(LINE).lineWidth(0.5).stroke();
  };

  let y = doc.y;
  drawRow(TABLE_COLUMNS.map((c) => c.title), y, true);
  y += headerHeight;
  for (const week of [...report.weeks].reverse()) {
    if (y + rowHeight > BOTTOM) {
      doc.addPage();
      y = MARGIN;
      drawRow(TABLE_COLUMNS.map((c) => c.title), y, true);
      y += headerHeight;
    }
    drawRow(
      [
        `${weekLabel(week)}${week.partial ? " *" : ""}`.replace(/ · /, " "),
        String(week.strength.trainingDays),
        int(week.strength.sets),
        int(week.strength.volumeKg),
        week.steps.daysWithData > 0 ? int(week.steps.total) : "–",
        week.steps.averagePerDay === null ? "–" : int(week.steps.averagePerDay),
        week.cyclingOutdoor.totalMinutes > 0 ? int(week.cyclingOutdoor.totalMinutes) : "–",
        week.cyclingOutdoor.totalKm === null ? "–" : dec(week.cyclingOutdoor.totalKm),
        week.cyclingStudio.totalMinutes > 0 ? int(week.cyclingStudio.totalMinutes) : "–",
      ],
      y,
      false,
    );
    y += rowHeight;
  }
  doc.y = y + 4;
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(7.5)
    .text("* laufende Woche, nur die bisherigen Tage. Ø/Tag bei Schritten = Summe über die Tage mit Daten.", MARGIN, doc.y, { width: CONTENT_WIDTH });
}

const BLOCK_HEIGHT = 128;

function drawWeekBlocks(doc: PDFKit.PDFDocument, report: ActivityReport) {
  const maxSteps = Math.max(1, ...report.weeks.flatMap((w) => w.steps.days.map((d) => d.steps ?? 0)));
  // Heading and the first block stay together; when they do not fit under the table, start a page.
  if (doc.y + 30 + BLOCK_HEIGHT > BOTTOM) doc.addPage();
  else doc.y += 18;
  doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(12).text("Die Wochen im Einzelnen", MARGIN, doc.y);
  let y = doc.y + 8;

  for (const week of [...report.weeks].reverse()) {
    if (y + BLOCK_HEIGHT > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
    drawWeekBlock(doc, week, y, maxSteps);
    y += BLOCK_HEIGHT + 10;
  }
}

function drawWeekBlock(doc: PDFKit.PDFDocument, week: ActivityWeek, top: number, maxSteps: number) {
  doc.moveTo(MARGIN, top).lineTo(MARGIN + CONTENT_WIDTH, top).strokeColor(LINE).lineWidth(0.5).stroke();
  doc
    .fillColor(TEXT)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(`${weekLabel(week)}${week.partial ? "  (laufende Woche)" : ""}`, MARGIN, top + 6);

  // Strength column.
  const { strength, steps, cyclingOutdoor, cyclingStudio } = week;
  const leftX = MARGIN;
  const textTop = top + 24;
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(8).text("KRAFTTRAINING", leftX, textTop);
  doc.fillColor(TEXT).font("Helvetica").fontSize(9);
  const strengthLines = [
    plural(strength.trainingDays, "Trainingstag", "Trainingstage"),
    `${int(strength.sets)} Sätze · ${int(strength.reps)} Wdh.`,
    `${int(strength.volumeKg)} kg Volumen`,
    strength.averageRir === null ? "Ø RIR –" : `Ø RIR ${dec(strength.averageRir)}`,
  ];
  strengthLines.forEach((line, i) => doc.text(line, leftX, textTop + 13 + i * 12, { width: 120 }));

  // Steps bars.
  const chartX = MARGIN + 140;
  const chartTop = textTop;
  const barAreaHeight = 48;
  const barWidth = 26;
  const barGap = 6;
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(8).text("SCHRITTE", chartX, chartTop);
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8)
    .text(
      steps.daysWithData > 0 ? `Summe ${int(steps.total)} · Ø ${int(steps.averagePerDay ?? 0)} pro Tag` : "keine Daten",
      chartX + 50,
      chartTop,
    );
  const baseY = chartTop + 26 + barAreaHeight;
  steps.days.forEach((day, i) => {
    const x = chartX + i * (barWidth + barGap);
    const value = day.steps ?? 0;
    const height = Math.max(day.steps === null ? 0 : 1, (value / maxSteps) * barAreaHeight);
    if (height > 0) doc.rect(x, baseY - height, barWidth, height).fill(ACCENT);
    doc
      .fillColor(TEXT)
      .font("Helvetica")
      .fontSize(6.5)
      .text(day.steps === null ? "–" : int(day.steps), x - 3, baseY - height - 9, { width: barWidth + 6, align: "center" });
    doc.fillColor(MUTED).fontSize(7).text(WEEKDAYS[i], x, baseY + 3, { width: barWidth, align: "center" });
  });

  // Cycling column.
  const rightX = chartX + 7 * (barWidth + barGap) + 14;
  const rightWidth = MARGIN + CONTENT_WIDTH - rightX;
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(8).text("FAHRRAD", rightX, textTop);
  doc.fillColor(TEXT).font("Helvetica").fontSize(8.5);
  const cyclingLines = [
    "Draußen",
    `${int(cyclingOutdoor.totalMinutes)} Min. · ${cyclingOutdoor.totalKm === null ? "– km" : `${dec(cyclingOutdoor.totalKm)} km`}`,
    `Ø ${dec(cyclingOutdoor.averageMinutesPerDay)} Min./Tag${cyclingOutdoor.averageKmPerDay === null ? "" : ` · ${dec(cyclingOutdoor.averageKmPerDay, 2)} km`}`,
    "Studio",
    `${int(cyclingStudio.totalMinutes)} Min. · ${plural(cyclingStudio.rides, "Einheit", "Einheiten")}`,
    `Ø ${dec(cyclingStudio.averageMinutesPerDay)} Min./Tag`,
  ];
  cyclingLines.forEach((line, i) => {
    doc.font(i % 3 === 0 ? "Helvetica-Bold" : "Helvetica").fillColor(i % 3 === 0 ? MUTED : TEXT);
    doc.text(line, rightX, textTop + 13 + i * 11, { width: rightWidth });
  });
}
