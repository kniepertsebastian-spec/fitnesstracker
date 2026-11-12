import { describe, expect, it } from "vitest";
import { buildActivityReport, resolveReportRange } from "./activity.service.js";
describe("resolveReportRange", () => {
    it("defaults to the last 28 days ending today", () => {
        expect(resolveReportRange({}, new Date("2026-11-04T10:00:00Z"))).toEqual({ from: "2026-10-08", to: "2026-11-04" });
    });
    it("accepts an explicit range", () => {
        expect(resolveReportRange({ from: "2026-10-01", to: "2026-10-31" })).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    });
    it("rejects a reversed range", () => {
        expect(() => resolveReportRange({ from: "2026-11-02", to: "2026-11-01" })).toThrow();
    });
    it("rejects a range longer than 92 days", () => {
        expect(() => resolveReportRange({ from: "2026-01-01", to: "2026-11-01" })).toThrow(/at most/);
    });
});
describe("buildActivityReport", () => {
    const user = { firstName: "Max", lastName: "Mustermann", email: "max@example.com" };
    const now = new Date("2026-11-04T12:00:00Z");
    it("sums steps, distance and bike sessions", () => {
        const report = buildActivityReport({
            user,
            from: "2026-10-08",
            to: "2026-11-04",
            now,
            days: [
                { date: new Date("2026-10-08T00:00:00Z"), steps: 8000, distanceKm: { toString: () => "6.10" }, source: "FITBIT" },
                { date: new Date("2026-10-09T00:00:00Z"), steps: 0, distanceKm: { toString: () => "0" }, source: "FITBIT" },
                { date: new Date("2026-10-10T00:00:00Z"), steps: 12000, distanceKm: { toString: () => "9.25" }, source: "FITBIT" },
            ],
            bike: [
                { performedAt: new Date("2026-10-12T17:00:00Z"), machine: "BIKE", durationMinutes: 45, distanceKm: { toString: () => "18.4" }, source: "FITBIT" },
                { performedAt: new Date("2026-10-14T17:00:00Z"), machine: "BIKE", durationMinutes: 30, distanceKm: null, source: "MANUAL" },
            ],
        });
        expect(report.totals).toEqual({
            steps: 20000,
            stepsDistanceKm: 15.4,
            daysWithSteps: 2,
            bikeSessions: 2,
            bikeKm: 18.4,
            bikeMinutes: 75,
            manualBikeSessions: 1,
        });
        expect(report.days[0]).toEqual({ date: "2026-10-08", steps: 8000, distanceKm: 6.1, source: "FITBIT" });
        expect(report.bikeSessions[1].distanceKm).toBeNull();
        expect(report.generatedAt).toBe("2026-11-04T12:00:00.000Z");
    });
    it("returns zero totals for an empty period", () => {
        const report = buildActivityReport({ user, from: "2026-10-08", to: "2026-11-04", days: [], bike: [], now });
        expect(report.totals.steps).toBe(0);
        expect(report.totals.bikeKm).toBe(0);
    });
});
//# sourceMappingURL=activity.service.test.js.map