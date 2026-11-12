import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { authed, hasTestDb, signUp, startApp } from "./testApp.js";

describe.skipIf(!hasTestDb)("health and push endpoint (integration)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await startApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("reports ok while the database answers", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("reports 503 when the database is unreachable", async () => {
    const spy = vi.spyOn(app.prisma, "$queryRaw").mockRejectedValueOnce(new Error("connection refused"));
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: "unavailable" });
    spy.mockRestore();
  });

  it("rejects push subscriptions that point at internal or unknown hosts", async () => {
    const session = await signUp(app, "push");
    for (const endpoint of ["http://fcm.googleapis.com/x", "https://169.254.169.254/x", "https://backend:3000/x"]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/push/subscribe",
        headers: authed(session),
        payload: { endpoint, keys: { p256dh: "p", auth: "a" } },
      });
      expect(res.statusCode).toBe(400);
    }
    const ok = await app.inject({
      method: "POST",
      url: "/api/push/subscribe",
      headers: authed(session),
      payload: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p", auth: "a" } },
    });
    expect(ok.statusCode).toBeLessThan(300);
  });
});
