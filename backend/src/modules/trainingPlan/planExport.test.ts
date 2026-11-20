import { describe, expect, it } from "vitest";
import {
  parseCsv,
  parseJson,
  parseXml,
  rowsToCsv,
  rowsToJson,
  rowsToXml,
  type PlanExportRow,
} from "./planExport.format.js";
import { normalizeRows, previewPlanImport } from "./planExport.service.js";

const row = (over: Partial<PlanExportRow> = {}): PlanExportRow => ({
  phase: "AUFBAU",
  exerciseName: "Bankdrücken, mittlerer Griff (Langhantel)",
  targetSets: 4,
  targetReps: 10,
  order: 0,
  dayLabel: "Push (Brust, Schultern, Trizeps)",
  repRangeMin: 8,
  repRangeMax: 10,
  targetRir: 2,
  restSeconds: 120,
  notes: 'Schulterblätter "zusammen", Pause\nnicht zu lang',
  startWeightKg: 62.5,
  alternativeExerciseName: "Schrägbankdrücken (Kurzhantel)",
  technique: "SUPERSET",
  techniqueGroup: "G1",
  setScheme: "PYRAMID",
  ...over,
});

describe("plan file formats", () => {
  const rows = [row(), row({ exerciseName: "Seitheben", order: 1, notes: null, startWeightKg: null, alternativeExerciseName: null })];

  it.each([
    ["csv", rowsToCsv, parseCsv],
    ["json", rowsToJson, parseJson],
    ["xml", rowsToXml, parseXml],
  ] as const)("%s keeps day, rep range, notes and alternative through a round trip", (_name, write, read) => {
    const back = normalizeRows(read(write(rows))).rows;
    expect(back).toHaveLength(2);
    expect(back[0]).toMatchObject({
      phase: "AUFBAU",
      dayLabel: "Push (Brust, Schultern, Trizeps)",
      repRangeMin: 8,
      repRangeMax: 10,
      targetRir: 2,
      restSeconds: 120,
      startWeightKg: 62.5,
      alternativeExerciseName: "Schrägbankdrücken (Kurzhantel)",
      notes: 'Schulterblätter "zusammen", Pause\nnicht zu lang',
    });
    expect(back[1].notes).toBeNull();
  });

  it("guards spreadsheet formulas in CSV and restores the text on import", () => {
    const csv = rowsToCsv([row({ notes: "=1+1" })]);
    expect(csv).toContain("'=1+1");
    expect(parseCsv(csv)[0].notes).toBe("=1+1");
  });

  it("reads a file of the first format: missing columns stay untouched (undefined)", () => {
    const old = "phase,exerciseName,targetSets,targetReps,order\r\nAUFBAU,Seitheben,3,12,0\r\n";
    const [parsed] = normalizeRows(parseCsv(old)).rows;
    expect(parsed).toMatchObject({ phase: "AUFBAU", exerciseName: "Seitheben", targetSets: 3, targetReps: 12 });
    expect(parsed.dayLabel).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
    expect(parsed.repRangeMin).toBeUndefined();
  });

  it("an empty cell clears the value (null) while an absent column does not", () => {
    const csv = "phase,exerciseName,notes\r\nAUFBAU,Seitheben,\r\n";
    const [parsed] = normalizeRows(parseCsv(csv)).rows;
    expect(parsed.notes).toBeNull();
    expect(parsed.targetSets).toBeUndefined();
  });

  it("accepts a wrapped JSON file", () => {
    expect(parseJson(JSON.stringify({ exercises: [{ phase: "AUFBAU", exerciseName: "X" }] }))).toHaveLength(1);
    expect(() => parseJson("{}")).toThrow();
  });
});

describe("previewPlanImport", () => {
  it("lists the phases of a file with counts and days", () => {
    const preview = previewPlanImport([
      { phase: "AUFBAU", exerciseName: "A", dayLabel: "Push" },
      { phase: "AUFBAU", exerciseName: "B", dayLabel: "Pull" },
      { phase: "NEGATIV", exerciseName: "C" },
      { phase: "QUATSCH", exerciseName: "D" },
    ]);
    expect(preview.phases).toEqual([
      { phase: "AUFBAU", count: 2, days: ["Push", "Pull"] },
      { phase: "NEGATIV", count: 1, days: [] },
    ]);
    expect(preview.errors).toEqual(['Zeile 5: ungültige Phase "QUATSCH"']);
  });
});
