import { describe, expect, it, vi } from "vitest";
import { findSyncToken, generateSyncToken, hashSyncToken, ingestActivity } from "./healthSync.service.js";
function fakePrisma(existing) {
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const update = vi.fn().mockImplementation((args) => Promise.resolve(args));
    const upsert = vi.fn().mockImplementation((args) => Promise.resolve(args));
    const findUnique = vi.fn();
    const prisma = {
        dailyActivity: {
            findMany: vi.fn().mockResolvedValue(existing.map((e) => ({ date: new Date(`${e.date}T00:00:00.000Z`), sequence: e.sequence }))),
            createMany,
            update,
        },
        cyclingSession: { upsert },
        healthSyncToken: { findUnique },
        $transaction: (operations) => Promise.all(operations),
    };
    return { prisma: prisma, createMany, update, upsert, findUnique };
}
const activity = (over) => ({
    isTest: false,
    sequence: 10,
    days: [],
    rides: [],
    ...over,
});
describe("sync token", () => {
    it("is a prefixed random secret and only its hash is looked up", async () => {
        const token = generateSyncToken();
        expect(token).toMatch(/^fth_[A-Za-z0-9_-]{43}$/);
        expect(generateSyncToken()).not.toBe(token);
        expect(hashSyncToken(token)).toMatch(/^[0-9a-f]{64}$/);
        expect(hashSyncToken(token)).not.toContain(token);
        const { prisma, findUnique } = fakePrisma([]);
        findUnique.mockResolvedValue({ id: "t1", userId: "u1" });
        expect(await findSyncToken(prisma, token)).toEqual({ id: "t1", userId: "u1" });
        expect(findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashSyncToken(token) }, select: { id: true, userId: true } });
    });
    it("rejects tokens of the wrong shape without touching the database", async () => {
        const { prisma, findUnique } = fakePrisma([]);
        expect(await findSyncToken(prisma, "not-a-token")).toBeNull();
        expect(await findSyncToken(prisma, `fth_${"a".repeat(500)}`)).toBeNull();
        expect(findUnique).not.toHaveBeenCalled();
    });
});
describe("ingestActivity", () => {
    it("creates new days and updates a stored day with a newer or equal sequence", async () => {
        const { prisma, createMany, update } = fakePrisma([{ date: "2026-10-04", sequence: 5 }]);
        const result = await ingestActivity(prisma, "u1", activity({
            sequence: 7,
            days: [
                { date: "2026-10-03", steps: 9000, distanceMeters: null },
                { date: "2026-10-04", steps: 4100, distanceMeters: 3000 },
            ],
        }));
        expect(result).toEqual({ days: 2, rides: 0 });
        expect(createMany).toHaveBeenCalledWith({
            data: [{ userId: "u1", date: new Date("2026-10-03T00:00:00.000Z"), steps: 9000, distanceMeters: null, sequence: 7 }],
            skipDuplicates: true,
        });
        expect(update).toHaveBeenCalledWith({
            where: { userId_date: { userId: "u1", date: new Date("2026-10-04T00:00:00.000Z") } },
            data: { steps: 4100, distanceMeters: 3000, sequence: 7 },
        });
    });
    it("does not let an older payload overwrite a newer running total", async () => {
        const { prisma, createMany, update } = fakePrisma([{ date: "2026-10-04", sequence: 9 }]);
        const result = await ingestActivity(prisma, "u1", activity({ sequence: 4, days: [{ date: "2026-10-04", steps: 100, distanceMeters: null }] }));
        expect(result.days).toBe(0);
        expect(createMany).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });
    it("upserts rides by their Health Connect id and keeps an earlier distance when a later payload lacks it", async () => {
        const { prisma, upsert } = fakePrisma([]);
        await ingestActivity(prisma, "u1", activity({
            rides: [
                { externalId: "r1", startedAt: new Date("2026-10-04T16:00:00Z"), endedAt: new Date("2026-10-04T17:00:00Z"), durationSeconds: 3600, distanceMeters: null, title: null },
            ],
        }));
        const call = upsert.mock.calls[0][0];
        expect(call.where).toEqual({ userId_externalId: { userId: "u1", externalId: "r1" } });
        expect(call.update).not.toHaveProperty("distanceMeters");
    });
});
//# sourceMappingURL=healthSync.service.test.js.map