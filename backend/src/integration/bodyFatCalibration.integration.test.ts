import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authed, hasTestDb, signUp, startApp, type Session } from "./testApp.js";

describe.skipIf(!hasTestDb)("body-fat calibration (integration)", () => {
  let app: FastifyInstance;
  let session: Session;
  let other: Session;

  beforeAll(async () => {
    app = await startApp();
    session = await signUp(app, "calibration");
    other = await signUp(app, "calibration-other");
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: { in: [session.id, other.id] } } });
    await app.close();
  });

  const calibrate = (s: Session, payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/body-fat-calibrations", headers: authed(s), payload });
  const profile = (s: Session) =>
    app.inject({
      method: "PUT",
      url: "/api/profile",
      headers: authed(s),
      payload: { weightKg: 82, heightCm: 182, age: 30, gender: "MALE", activityLevel: "MODERATE", goal: "MAINTAIN" },
    });
  const measure = (s: Session, payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/body-composition", headers: authed(s), payload });

  it("needs a profile, then a tape measurement near the reference day", async () => {
    const noProfile = await calibrate(session, { measuredOn: "2026-11-01", referencePercent: 18 });
    expect(noProfile.statusCode).toBe(400);
    expect(noProfile.json().message).toContain("Größe und Geschlecht");

    expect((await profile(session)).statusCode).toBe(200);
    const noMeasurement = await calibrate(session, { measuredOn: "2026-11-01", referencePercent: 18 });
    expect(noMeasurement.statusCode).toBe(400);
    expect(noMeasurement.json().message).toContain("Taillenumfang");

    // A measurement 10 days away is still too far.
    await measure(session, { weightKg: 82, waistCm: 88, neckCm: 39, measuredAt: "2026-11-11T08:00:00.000Z" });
    expect((await calibrate(session, { measuredOn: "2026-11-01", referencePercent: 18 })).statusCode).toBe(400);
  });

  it("stores reference, estimate and offset, lists, exports and deletes", async () => {
    await measure(session, { weightKg: 82, waistCm: 88, neckCm: 39, measuredAt: "2026-11-02T08:00:00.000Z" });
    // 182 cm / waist 88 / neck 39: RFM 22.6, Navy 17.3 -> middle 20.0 (19.95 rounded to the shown decimal)
    const created = await calibrate(session, { measuredOn: "2026-11-01", referencePercent: 18 });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.referencePercent).toBe(18);
    expect(body.estimatePercent).toBeCloseTo(20, 0);
    expect(body.offsetPercent).toBeCloseTo(-2, 0);
    expect(body.measuredOn).toBe("2026-11-01");

    const list = await app.inject({ method: "GET", url: "/api/body-fat-calibrations", headers: authed(session) });
    expect(list.json().items).toHaveLength(1);
    const backup = await app.inject({ method: "GET", url: "/api/export/backup.json", headers: authed(session) });
    expect(backup.json().bodyFatCalibrations).toHaveLength(1);

    // Another account sees and can change nothing of it.
    const otherList = await app.inject({ method: "GET", url: "/api/body-fat-calibrations", headers: authed(other) });
    expect(otherList.json().items).toHaveLength(0);
    const foreignDelete = await app.inject({ method: "DELETE", url: `/api/body-fat-calibrations/${body.id}`, headers: authed(other) });
    expect(foreignDelete.statusCode).toBe(404);

    const removed = await app.inject({ method: "DELETE", url: `/api/body-fat-calibrations/${body.id}`, headers: authed(session) });
    expect(removed.statusCode).toBe(204);
  });

  it("rejects an impossible date and implausible reference values", async () => {
    expect((await calibrate(session, { measuredOn: "2026-02-31", referencePercent: 18 })).statusCode).toBe(400);
    expect((await calibrate(session, { measuredOn: "2026-11-01", referencePercent: 1 })).statusCode).toBe(400);
    expect((await calibrate(session, { measuredOn: "2026-11-01", referencePercent: 90 })).statusCode).toBe(400);
  });
});
