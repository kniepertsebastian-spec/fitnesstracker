import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getOrCreateTodayChallenge } from "../modules/dailyChallenge/dailyChallenge.service.js";
import { getWeeklyPlanStatus } from "../modules/trainingPlan/planWeekStatus.service.js";
import { authed, hasTestDb, signUp, startApp, type Session } from "./testApp.js";

describe.skipIf(!hasTestDb)("account time zone (integration)", () => {
  let app: FastifyInstance;
  let berlin: Session;
  let newYork: Session;
  let exerciseId: string;

  beforeAll(async () => {
    app = await startApp();
    berlin = await signUp(app, "tz-berlin");
    newYork = await signUp(app, "tz-newyork");
    const exercise = await app.prisma.exercise.create({
      data: { name: `Integration pushup ${randomUUID()}`, equipment: "body only", category: "strength", primaryMuscles: ["chest"] },
    });
    exerciseId = exercise.id;
  });
  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: { in: [berlin.id, newYork.id] } } });
    await app.prisma.exercise.delete({ where: { id: exerciseId } }).catch(() => undefined);
    await app.close();
  });

  const setZone = (session: Session, timeZone: string) =>
    app.inject({ method: "PUT", url: "/api/auth/me/time-zone", headers: authed(session), payload: { timeZone } });

  it("stores the zone, returns it with the user and rejects unknown zones", async () => {
    expect((await setZone(berlin, "Europe/Berlin")).json().timeZone).toBe("Europe/Berlin");
    expect((await setZone(newYork, "America/New_York")).json().timeZone).toBe("America/New_York");
    expect((await setZone(berlin, "Mars/Olympus")).statusCode).toBe(400);
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: authed(berlin) });
    expect(me.json().timeZone).toBe("Europe/Berlin");
  });

  it("switches the daily challenge at local midnight", async () => {
    // Sunday 8 Nov 2026, 23:30 UTC: already Monday 00:30 in Berlin, still Sunday 18:30 in New York.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-08T23:30:00Z") });
    const inBerlin = await getOrCreateTodayChallenge(app.prisma, berlin.id);
    const inNewYork = await getOrCreateTodayChallenge(app.prisma, newYork.id);
    expect(inBerlin.length).toBeGreaterThan(0);
    expect(inNewYork.length).toBeGreaterThan(0);
    expect(inBerlin[0]!.date.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(inNewYork[0]!.date.toISOString()).toBe("2026-11-08T00:00:00.000Z");
  });

  it("counts a set from Monday 00:30 local time to the new week", async () => {
    const plan = await app.inject({ method: "GET", url: "/api/training-plan", headers: authed(berlin) });
    const phase = plan.json().currentPhase as string;
    const added = await app.inject({
      method: "POST",
      url: "/api/plan-exercises",
      headers: authed(berlin),
      payload: { phase, exerciseId, targetSets: 1, targetReps: 5 },
    });
    expect(added.statusCode).toBe(201);
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-08T23:30:00Z") }); // Monday 00:30 in Berlin
    const logged = async () => {
      const status = await getWeeklyPlanStatus(app.prisma, berlin.id, phase as never);
      return status.days.flatMap((d) => d.exercises).find((e) => e.exerciseId === exerciseId)?.loggedThisWeek;
    };
    const logSet = (performedAt: string) =>
      app.prisma.workoutLog.create({
        data: { clientId: randomUUID(), userId: berlin.id, exerciseId, setNumber: 1, reps: 5, weightKg: 0, performedAt: new Date(performedAt) },
      });

    // Sunday 22:00 Berlin (21:00 UTC) belongs to the old week, although UTC's week started days earlier.
    await logSet("2026-11-08T21:00:00Z");
    expect(await logged()).toBe(false);
    // Monday 00:15 Berlin (Sunday 23:15 UTC) is already the new week.
    await logSet("2026-11-08T23:15:00Z");
    expect(await logged()).toBe(true);
  });
});
