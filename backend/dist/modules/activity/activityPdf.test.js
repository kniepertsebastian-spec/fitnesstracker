import { describe, expect, it } from "vitest";
import { buildActivityPdf } from "./activityPdf.js";
import { composeActivityReport } from "./activityReport.js";
describe("buildActivityPdf", () => {
    it("renders a PDF document for a multi-week report, including empty weeks", async () => {
        const report = composeActivityReport({
            workoutSets: [{ performedAt: new Date("2026-10-27T17:00:00Z"), reps: 10, weightKg: 60, rir: 2, primaryMuscles: ["chest"] }],
            studioBike: [{ performedAt: new Date("2026-10-27T08:00:00Z"), durationMinutes: 30 }],
            days: [{ date: "2026-10-27", steps: 10234, distanceMeters: null }],
            rides: [{ startedAt: new Date("2026-10-28T17:00:00Z"), durationSeconds: 3600, distanceMeters: 20000 }],
        }, { weeks: 12, timeZone: "Europe/Berlin", now: new Date("2026-11-05T10:00:00Z") });
        const pdf = await buildActivityPdf(report);
        expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
        expect(pdf.length).toBeGreaterThan(2000);
        expect(pdf.subarray(-6).toString("latin1")).toContain("%%EOF");
    });
});
//# sourceMappingURL=activityPdf.test.js.map