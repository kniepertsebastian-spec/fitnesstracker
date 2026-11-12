import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { healthSyncWebhookRoutes } from "./healthSync.routes.js";
import { hashSyncToken } from "./healthSync.service.js";
const TOKEN = "fth_" + "a".repeat(43);
async function buildTestApp() {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const tokenUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
        healthSyncToken: {
            findUnique: vi.fn(async ({ where }) => where.tokenHash === hashSyncToken(TOKEN) ? { id: "t1", userId: "u1" } : null),
            update: tokenUpdate,
        },
        dailyActivity: { findMany: vi.fn().mockResolvedValue([]), createMany, update: vi.fn() },
        cyclingSession: { upsert: vi.fn() },
        $transaction: (operations) => Promise.all(operations),
    };
    const app = Fastify();
    await app.register(rateLimit, { global: false });
    app.decorate("prisma", prisma);
    await app.register(healthSyncWebhookRoutes, { prefix: "/api" });
    return { app, createMany, tokenUpdate };
}
const post = (app, body, authorization) => app.inject({
    method: "POST",
    url: "/api/health-sync/webhook",
    headers: { "content-type": "application/json; charset=utf-8", ...(authorization ? { authorization } : {}) },
    payload: JSON.stringify(body),
});
describe("POST /api/health-sync/webhook", () => {
    const apps = [];
    afterEach(async () => {
        await Promise.all(apps.splice(0).map((a) => a.close()));
    });
    const setup = async () => {
        const built = await buildTestApp();
        apps.push(built.app);
        return built;
    };
    it("rejects a request without a valid bearer token and writes nothing", async () => {
        const { app, createMany } = await setup();
        expect((await post(app, { daily_totals: [] })).statusCode).toBe(401);
        expect((await post(app, { daily_totals: [] }, "Bearer nope")).statusCode).toBe(401);
        expect((await post(app, { daily_totals: [] }, `Basic ${TOKEN}`)).statusCode).toBe(401);
        expect(createMany).not.toHaveBeenCalled();
    });
    it("stores the days of a payload for the token's user", async () => {
        const { app, createMany, tokenUpdate } = await setup();
        const response = await post(app, { sequence: 3, daily_totals: [{ date: "2026-10-04", steps: 8421, distance_meters: 6210.4 }] }, `Bearer ${TOKEN}`);
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ ok: true, days: 1, rides: 0 });
        expect(createMany).toHaveBeenCalledWith({
            data: [{ userId: "u1", date: new Date("2026-10-04T00:00:00.000Z"), steps: 8421, distanceMeters: 6210.4, sequence: 3 }],
            skipDuplicates: true,
        });
        expect(tokenUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t1" }, data: expect.objectContaining({ lastSequence: 3 }) }));
    });
    it("answers a test ping without touching any data", async () => {
        const { app, createMany } = await setup();
        const response = await post(app, { test: true, message: "ping" }, `Bearer ${TOKEN}`);
        expect(response.json()).toEqual({ ok: true, test: true });
        expect(createMany).not.toHaveBeenCalled();
    });
    it("rejects a body that is not a JSON object", async () => {
        const { app } = await setup();
        expect((await post(app, [1, 2, 3], `Bearer ${TOKEN}`)).statusCode).toBe(422);
    });
});
//# sourceMappingURL=healthSync.routes.test.js.map