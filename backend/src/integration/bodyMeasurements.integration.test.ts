import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authed, hasTestDb, signUp, startApp, type Session } from "./testApp.js";

describe.skipIf(!hasTestDb)("body measurements: waist, neck, hip (integration)", () => {
  let app: FastifyInstance;
  let session: Session;

  beforeAll(async () => {
    app = await startApp();
    session = await signUp(app, "body-measurements");
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: session.id } });
    await app.close();
  });

  const create = (payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/body-composition", headers: authed(session), payload });

  it("stores, lists and updates tape measurements", async () => {
    const created = await create({ weightKg: 82.4, waistCm: 88.5, neckCm: 39, hipCm: 101.2 });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ waistCm: 88.5, neckCm: 39, hipCm: 101.2 });

    const list = await app.inject({ method: "GET", url: "/api/body-composition", headers: authed(session) });
    expect(list.json().items[0]).toMatchObject({ waistCm: 88.5, neckCm: 39, hipCm: 101.2 });

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/body-composition/${created.json().id}`,
      headers: authed(session),
      payload: { waistCm: 87 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ waistCm: 87, neckCm: 39, hipCm: 101.2 });
  });

  it("keeps measurements optional: older entries and weight-only entries read back as null", async () => {
    const created = await create({ weightKg: 80 });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ waistCm: null, neckCm: null, hipCm: null });
  });

  it("rejects implausible values", async () => {
    expect((await create({ weightKg: 80, waistCm: 8 })).statusCode).toBe(400);
    expect((await create({ weightKg: 80, neckCm: 400 })).statusCode).toBe(400);
  });

  it("includes the measurements in the data export", async () => {
    const res = await app.inject({ method: "GET", url: "/api/export/backup.json", headers: authed(session) });
    expect(res.statusCode).toBe(200);
    const entries = res.json().bodyCompositionEntries as Array<{ waistCm: number | null }>;
    expect(entries.some((e) => e.waistCm === 87)).toBe(true);
  });
});
