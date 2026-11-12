import { describe, expect, it } from "vitest";
import { addDays, composeActivityReport, isoWeekLabel, localDate, mondayOf, reportRange } from "./activityReport.js";
// Thursday 2026-11-05 in Berlin (CET, UTC+1): the running week is Mon 2 Nov - Sun 8 Nov, 4 days in.
const NOW = new Date("2026-11-05T10:00:00Z");
const TZ = "Europe/Berlin";
describe("date helpers", () => {
    it("cuts days at local midnight, not UTC midnight", () => {
        expect(localDate(new Date("2026-11-01T23:30:00Z"), TZ)).toBe("2026-11-02");
        expect(localDate(new Date("2026-11-01T23:30:00Z"), "UTC")).toBe("2026-11-01");
    });
    it("finds Mondays and ISO weeks", () => {
        expect(mondayOf("2026-11-05")).toBe("2026-11-02");
        expect(mondayOf("2026-11-01")).toBe("2026-10-26"); // Sunday belongs to the week before
        expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
        expect(isoWeekLabel("2026-10-26")).toBe("2026-W44");
        expect(isoWeekLabel("2026-12-28")).toBe("2026-W53");
        expect(isoWeekLabel("2027-01-04")).toBe("2027-W01");
    });
    it("spans the requested number of weeks including the running one", () => {
        expect(reportRange(2, TZ, NOW)).toEqual({ today: "2026-11-05", currentMonday: "2026-11-02", firstMonday: "2026-10-26", lastSunday: "2026-11-08" });
    });
});
describe("composeActivityReport", () => {
    const report = composeActivityReport({
        workoutSets: [
            { performedAt: new Date("2026-10-27T17:00:00Z"), reps: 10, weightKg: 60, rir: 2, primaryMuscles: ["chest"] },
            { performedAt: new Date("2026-10-27T17:10:00Z"), reps: 8, weightKg: 70, rir: null, primaryMuscles: ["chest", "triceps"] },
            { performedAt: new Date("2026-11-03T23:30:00Z"), reps: 5, weightKg: 100, rir: 1, primaryMuscles: ["quadriceps"] }, // 4 Nov, 00:30 local
        ],
        studioBike: [{ performedAt: new Date("2026-10-27T08:00:00Z"), durationMinutes: 30 }],
        days: [
            { date: "2026-10-26", steps: 8000, distanceMeters: null },
            { date: "2026-10-27", steps: 10000, distanceMeters: null },
            { date: "2026-11-02", steps: 6000, distanceMeters: null },
            { date: "2026-11-03", steps: 9000, distanceMeters: null },
            { date: "2026-09-01", steps: 1, distanceMeters: null }, // outside the range
        ],
        rides: [
            { startedAt: new Date("2026-10-28T17:00:00Z"), durationSeconds: 3600, distanceMeters: 20000 },
            { startedAt: new Date("2026-10-28T19:00:00Z"), durationSeconds: 1800, distanceMeters: null },
            { startedAt: new Date("2026-11-01T23:30:00Z"), durationSeconds: 1200, distanceMeters: 5000 }, // 2 Nov, 00:30 local
        ],
    }, { weeks: 2, timeZone: TZ, now: NOW });
    const [first, second] = report.weeks;
    it("lays out Monday-to-Sunday weeks and marks the running one", () => {
        expect(report.weeks.map((w) => [w.isoWeek, w.weekStart, w.weekEnd, w.partial, w.daysCounted])).toEqual([
            ["2026-W44", "2026-10-26", "2026-11-01", false, 7],
            ["2026-W45", "2026-11-02", "2026-11-08", true, 4],
        ]);
        expect(report.range).toEqual({ from: "2026-10-26", to: "2026-11-05" });
        expect(first.steps.days.map((d) => d.steps)).toEqual([8000, 10000, null, null, null, null, null]);
    });
    it("sums steps and averages over the days that have data", () => {
        expect(first.steps).toMatchObject({ total: 18000, daysWithData: 2, averagePerDay: 9000 });
        expect(second.steps).toMatchObject({ total: 15000, daysWithData: 2, averagePerDay: 7500 });
        expect(report.totals.steps).toEqual({ total: 33000, daysWithData: 4, averagePerDay: 8250 });
    });
    it("counts outdoor rides by local day and averages over the days that count", () => {
        expect(first.cyclingOutdoor).toMatchObject({ totalMinutes: 90, totalKm: 20, rides: 2, averageMinutesPerDay: 12.9, averageKmPerDay: 2.86 });
        expect(first.cyclingOutdoor.days[2]).toEqual({ date: "2026-10-28", minutes: 90, km: 20 });
        // The 00:30 ride belongs to Monday 2 Nov, and the running week divides by its 4 elapsed days.
        expect(second.cyclingOutdoor).toMatchObject({ totalMinutes: 20, totalKm: 5, rides: 1, averageMinutesPerDay: 5, averageKmPerDay: 1.25 });
    });
    it("keeps the studio bike apart and without distance", () => {
        expect(first.cyclingStudio).toMatchObject({ totalMinutes: 30, totalKm: null, rides: 1, averageMinutesPerDay: 4.3 });
        expect(second.cyclingStudio).toMatchObject({ totalMinutes: 0, rides: 0 });
        expect(report.totals.cyclingStudio).toEqual({ minutes: 30, sessions: 1 });
    });
    it("summarises the strength history per week", () => {
        expect(first.strength).toEqual({
            trainingDays: 1,
            sets: 2,
            reps: 18,
            volumeKg: 1160,
            averageRir: 2,
            setsByMuscle: { chest: 2, triceps: 1 },
        });
        expect(second.strength).toMatchObject({ trainingDays: 1, sets: 1, volumeKg: 500, averageRir: 1 });
        expect(report.totals.strength).toEqual({ trainingDays: 2, sets: 3, volumeKg: 1660 });
    });
    it("emits health-export-like records inside the range, oldest first", () => {
        const types = new Set(report.records.map((r) => r.type));
        expect(types).toEqual(new Set(["DailySteps", "CyclingOutdoorDuration", "CyclingOutdoorDistance", "CyclingStudioDuration", "StrengthTrainingSets", "StrengthTrainingVolume"]));
        expect(report.records.find((r) => r.startDate.startsWith("2026-09-01"))).toBeUndefined();
        const starts = report.records.map((r) => r.startDate);
        expect([...starts].sort()).toEqual(starts);
        expect(report.records.find((r) => r.type === "DailySteps")).toEqual({
            type: "DailySteps",
            unit: "count",
            startDate: "2026-10-26T00:00:00",
            endDate: "2026-10-26T23:59:59",
            value: 8000,
            sourceName: "Health Connect",
        });
        expect(report.records.find((r) => r.type === "CyclingOutdoorDistance")).toMatchObject({ unit: "km", value: 20 });
    });
    it("reports no average and no distance when there is no data", () => {
        const empty = composeActivityReport({ workoutSets: [], studioBike: [], days: [], rides: [] }, { weeks: 1, timeZone: TZ, now: NOW });
        expect(empty.weeks[0].steps).toMatchObject({ total: 0, daysWithData: 0, averagePerDay: null });
        expect(empty.weeks[0].cyclingOutdoor).toMatchObject({ totalMinutes: 0, totalKm: null, averageKmPerDay: null });
        expect(empty.weeks[0].strength).toMatchObject({ sets: 0, averageRir: null });
        expect(empty.records).toEqual([]);
    });
});
//# sourceMappingURL=activityReport.test.js.map