import { describe, expect, it } from "vitest";
import { extractActivity } from "./healthSync.payload.js";
describe("extractActivity", () => {
    it("reads daily totals (steps, distance) of the documented webhook payload", () => {
        const result = extractActivity({
            timestamp: "2026-10-04T12:00:00Z",
            source: "health_connect",
            sequence: 1842,
            daily_totals: [{ date: "2026-10-04", steps: 8421, distance_meters: 6210.4, active_calories: 412 }],
            steps: [{ count: 1234, start_time: "2026-10-04T08:00:00Z", end_time: "2026-10-04T09:00:00Z", uuid: "x" }],
        });
        expect(result).toEqual({
            isTest: false,
            sequence: 1842,
            days: [{ date: "2026-10-04", steps: 8421, distanceMeters: 6210.4 }],
            rides: [],
        });
    });
    it("takes outdoor bike rides and sums the distance intervals that lie inside them", () => {
        const result = extractActivity({
            exercise: [
                { type: "8", name: "biking", uuid: "ride-1", title: "Feierabendrunde", start_time: "2026-10-04T16:00:00Z", end_time: "2026-10-04T17:00:00Z", duration_seconds: 3600 },
                { type: "9", name: "biking_stationary", uuid: "ride-2", start_time: "2026-10-05T16:00:00Z", end_time: "2026-10-05T17:00:00Z" },
                { type: "56", name: "running", uuid: "run-1", start_time: "2026-10-06T16:00:00Z", end_time: "2026-10-06T17:00:00Z" },
            ],
            distance: [
                { meters: 7000, start_time: "2026-10-04T16:00:00Z", end_time: "2026-10-04T16:30:00Z" },
                { meters: 6500.5, start_time: "2026-10-04T16:30:00Z", end_time: "2026-10-04T17:00:00Z" },
                { meters: 999, start_time: "2026-10-04T18:00:00Z", end_time: "2026-10-04T18:10:00Z" },
            ],
        });
        expect(result?.rides).toEqual([
            {
                externalId: "ride-1",
                startedAt: new Date("2026-10-04T16:00:00Z"),
                endedAt: new Date("2026-10-04T17:00:00Z"),
                durationSeconds: 3600,
                distanceMeters: 13500.5,
                title: "Feierabendrunde",
            },
        ]);
    });
    it("leaves the distance empty when no interval lies inside the ride, and derives id and duration", () => {
        const result = extractActivity({
            exercise: [{ name: "biking", start_time: "2026-10-04T16:00:00Z", end_time: "2026-10-04T16:45:00Z" }],
        });
        expect(result?.rides).toHaveLength(1);
        expect(result?.rides[0]).toMatchObject({
            externalId: "2026-10-04T16:00:00.000Z|2026-10-04T16:45:00.000Z",
            durationSeconds: 2700,
            distanceMeters: null,
            title: null,
        });
    });
    it("skips malformed entries instead of failing the payload", () => {
        const result = extractActivity({
            daily_totals: [
                { date: "2026-02-30", steps: 100 }, // not a calendar day
                { date: "04.10.2026", steps: 100 },
                { date: "2026-10-04", steps: -5 },
                { date: "2026-10-04", steps: "many" },
                { date: "2026-10-05", calories: 10 }, // no steps
                { date: "2026-10-06", steps: 4200.4 },
                null,
                "x",
            ],
            exercise: [
                { name: "biking", start_time: "2026-10-04T17:00:00Z", end_time: "2026-10-04T16:00:00Z" }, // ends before it starts
                { name: "biking", start_time: "nope", end_time: "2026-10-04T16:00:00Z" },
                { name: "biking", start_time: "2026-10-04T00:00:00Z", end_time: "2026-10-06T00:00:00Z" }, // 48 h
            ],
        });
        expect(result?.days).toEqual([{ date: "2026-10-06", steps: 4200, distanceMeters: null }]);
        expect(result?.rides).toEqual([]);
    });
    it("keeps the last entry when a day appears twice and flags a test ping", () => {
        const result = extractActivity({
            test: true,
            daily_totals: [
                { date: "2026-10-04", steps: 100 },
                { date: "2026-10-04", steps: 250 },
            ],
        });
        expect(result?.isTest).toBe(true);
        expect(result?.days).toEqual([{ date: "2026-10-04", steps: 250, distanceMeters: null }]);
    });
    it("returns null for anything that is not a JSON object", () => {
        expect(extractActivity(null)).toBeNull();
        expect(extractActivity([])).toBeNull();
        expect(extractActivity("steps")).toBeNull();
    });
});
//# sourceMappingURL=healthSync.payload.test.js.map