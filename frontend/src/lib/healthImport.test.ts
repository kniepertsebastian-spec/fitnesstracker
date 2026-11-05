import { describe, expect, it } from "vitest";
import { parseFlexibleDate, parseHealthCsv } from "./healthImport";

// Local-time ISO for a wall-clock moment, so the expectations hold in any timezone the tests run in.
const local = (y: number, mo: number, d: number, h = 12, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s).toISOString();

describe("parseFlexibleDate", () => {
  it("reads day-first dates with dots or slashes, with and without seconds", () => {
    expect(parseFlexibleDate("18.10.2026 06:42")).toBe(local(2026, 10, 18, 6, 42));
    expect(parseFlexibleDate("18/10/2026 06:42:07")).toBe(local(2026, 10, 18, 6, 42, 7));
  });

  it("reads a slash date month-first only when the second number cannot be a month", () => {
    expect(parseFlexibleDate("10/18/2026 06:42:07")).toBe(local(2026, 10, 18, 6, 42, 7));
    expect(parseFlexibleDate("05/06/2026")).toBe(local(2026, 6, 5));
  });

  it("rejects impossible calendar dates", () => {
    expect(parseFlexibleDate("31.02.2026")).toBeNull();
  });

  it("keeps ISO, date-only and epoch values working", () => {
    expect(parseFlexibleDate("2024-01-05")).toBe(local(2024, 1, 5));
    expect(parseFlexibleDate("2024-01-05 08:15:30")).toBe(local(2024, 1, 5, 8, 15, 30));
    expect(parseFlexibleDate("1704438930")).toBe(new Date(1704438930 * 1000).toISOString());
  });
});

describe("parseHealthCsv", () => {
  it("reads a scale-app export with English headers: weight, body fat, muscle mass and body water", () => {
    const csv = [
      "Time,Weight(kg),BMI,Body Fat(%),Subcutaneous Fat(%),Body Water(%),Skeletal Muscle(%),Muscle Mass(kg),Bone Mass(kg)",
      "2026-10-18 06:42:07,120.3,35.1,20.4,14.6,58.3,46.4,89.2,6.4",
    ].join("\n");
    expect(parseHealthCsv(csv)).toEqual([
      {
        measuredAt: local(2026, 10, 18, 6, 42, 7),
        weightKg: 120.3,
        bodyFatPercent: 20.4,
        muscleMassKg: 89.2,
        bodyWaterPercent: 58.3,
      },
    ]);
  });

  it("reads a German semicolon export with decimal commas and day-first dates", () => {
    const csv = [
      "Testzeit;Gewicht(kg);Körperfett(%);Wassergehalt(%);Muskelmasse(kg);Skelettmuskel(kg);Fettfreies Körpergewicht(kg)",
      "18/10/2026 06:42:07;120,3;20,4;58,3;89,2;55,8;95,6",
    ].join("\n");
    expect(parseHealthCsv(csv)).toEqual([
      {
        measuredAt: local(2026, 10, 18, 6, 42, 7),
        weightKg: 120.3,
        bodyFatPercent: 20.4,
        muscleMassKg: 89.2,
        bodyWaterPercent: 58.3,
      },
    ]);
  });

  it("does not mistake fat-free weight or skeletal muscle for weight and muscle mass", () => {
    const csv = ["Date;Fat-free Body Weight;Weight;Skeletal Muscle Mass", "2026-10-18;95,6;120,3;55,8"].join("\n");
    const [row] = parseHealthCsv(csv);
    expect(row.weightKg).toBe(120.3);
    expect(row.muscleMassKg).toBeUndefined();
  });

  it("converts a water column in kilograms (Samsung's total_body_water) into a share of the weight", () => {
    const csv = [
      "com.samsung.health.body_composition,1,2",
      "create_time,weight,body_fat,body_fat_mass,muscle_mass,total_body_water",
      "2024-01-05 08:15:30.000,80.0,20.0,16.0,35.0,48.0",
    ].join("\n");
    expect(parseHealthCsv(csv)).toEqual([
      {
        measuredAt: local(2024, 1, 5, 8, 15, 30),
        weightKg: 80,
        bodyFatPercent: 20,
        muscleMassKg: 35,
        bodyWaterPercent: 60,
      },
    ]);
  });

  it("drops implausible muscle and water values but keeps the measurement", () => {
    const csv = ["Date,Weight,Muscle Mass,Body Water(%)", "2026-10-18,80,95,3"].join("\n");
    expect(parseHealthCsv(csv)).toEqual([{ measuredAt: local(2026, 10, 18), weightKg: 80 }]);
  });

  it("converts weights exported in pounds", () => {
    const [row] = parseHealthCsv(["Date,Weight(lb)", "2026-10-18,200"].join("\n"));
    expect(row.weightKg).toBeCloseTo(90.72, 2);
  });

  it("still reads a plain date + weight file without optional columns", () => {
    expect(parseHealthCsv(["date,weight", "2024-01-05,76.5"].join("\n"))).toEqual([
      { measuredAt: local(2024, 1, 5), weightKg: 76.5 },
    ]);
  });

  it("returns nothing when no weight column can be identified", () => {
    expect(parseHealthCsv(["date,steps", "2024-01-05,8000"].join("\n"))).toEqual([]);
  });
});
