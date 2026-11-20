import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authed, hasTestDb, multipartFile, signUp, startApp, type Session } from "./testApp.js";

describe.skipIf(!hasTestDb)("techniques, set schemes and week patterns (integration)", () => {
  let app: FastifyInstance;
  let user: Session;
  const exerciseIds: string[] = [];
  const names = [`Kniebeuge ${randomUUID()}`, `Plank ${randomUUID()}`];

  const call = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown) =>
    app.inject({ method, url: `/api${url}`, headers: authed(user), payload: payload as Record<string, unknown> | undefined });

  beforeAll(async () => {
    app = await startApp();
    user = await signUp(app, "techniques");
    for (const name of names) {
      const res = await call("POST", "/exercises", { name });
      expect(res.statusCode, res.body).toBe(201);
      exerciseIds.push(res.json().id);
    }
    await call("GET", "/training-plan");
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: user.id } });
    await app.prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
    await app.close();
  });

  it("builds the per-set prescription from the scheme and keeps it in step with the sets", async () => {
    const created = await call("POST", "/plan-exercises", { phase: "AUFBAU", exerciseId: exerciseIds[0], targetSets: 4, targetReps: 10, technique: "NEGATIVES", setScheme: "PYRAMID" });
    expect(created.statusCode, created.body).toBe(201);
    const entry = created.json();
    expect(entry).toMatchObject({ technique: "NEGATIVES", setScheme: "PYRAMID" });
    expect(entry.setPlan).toHaveLength(4);
    expect(entry.setPlan[0].reps).toBeGreaterThan(entry.setPlan[3].reps);

    const fewer = await call("PATCH", `/plan-exercises/${entry.id}`, { targetSets: 3 });
    expect(fewer.json().setPlan).toHaveLength(3);

    const timed = await call("PATCH", `/plan-exercises/${entry.id}`, { setScheme: "TIME_BASED" });
    expect(timed.json().setScheme).toBe("TIME_BASED");
    expect(timed.json().setPlan.every((s: { seconds?: number }) => typeof s.seconds === "number")).toBe(true);

    const straight = await call("PATCH", `/plan-exercises/${entry.id}`, { setScheme: "STRAIGHT" });
    expect(straight.json()).toMatchObject({ setScheme: null, setPlan: null });

    expect((await call("PATCH", `/plan-exercises/${entry.id}`, { technique: "SUPER_DUPER" })).statusCode).toBe(400);
  });

  it("carries techniques through export and import", async () => {
    await call("POST", "/plan-exercises", { phase: "NEGATIV", exerciseId: exerciseIds[1], targetSets: 3, targetReps: 12, technique: "ISOMETRIC", setScheme: "TIME_BASED", dayLabel: "Core" });
    const file = (await call("GET", "/plan-exercises/export?format=json&phase=NEGATIV")).body;
    expect(JSON.parse(file)[0]).toMatchObject({ technique: "ISOMETRIC", setScheme: "TIME_BASED", dayLabel: "Core" });

    const part = multipartFile("file", "p.json", "application/json", Buffer.from(file));
    const res = await app.inject({
      method: "POST",
      url: "/api/plan-exercises/import?format=json&targetPhase=MUSKELAUSDAUER&mode=merge",
      headers: { ...authed(user), ...part.headers },
      payload: part.payload,
    });
    expect(res.json()).toMatchObject({ created: 1, errors: [] });
    const [entry] = (await call("GET", "/plan-exercises?phase=MUSKELAUSDAUER")).json().items;
    expect(entry).toMatchObject({ technique: "ISOMETRIC", setScheme: "TIME_BASED", dayLabel: "Core" });
    expect(entry.setPlan).toHaveLength(3);
  });

  it("logs how a set was done and refuses unknown techniques", async () => {
    const log = (extra: Record<string, unknown>) =>
      call("POST", "/workout-logs", { clientId: randomUUID(), exerciseId: exerciseIds[0], setNumber: 1, reps: 5, weightKg: 40, ...extra });
    const partial = await log({ technique: "PARTIAL_REPS" });
    expect(partial.statusCode, partial.body).toBe(201);
    expect(partial.json().technique).toBe("PARTIAL_REPS");
    const timed = await log({ reps: 1, weightKg: 0, durationSeconds: 45 });
    expect(timed.json()).toMatchObject({ durationSeconds: 45, technique: null });
    expect((await log({ technique: "FOO" })).statusCode).toBe(400);
    expect((await call("GET", "/workout-logs")).json().items.some((l: { technique: string | null }) => l.technique === "PARTIAL_REPS")).toBe(true);
  });

  it("shifts the rep targets by the week of the phase's pattern", async () => {
    const entry = await app.prisma.planExercise.findFirstOrThrow({ where: { userId: user.id, phase: "AUFBAU" } });
    await app.prisma.planExercise.update({ where: { id: entry.id }, data: { repRangeMin: 8, repRangeMax: 12, targetReps: 12, targetRir: 2, setScheme: null, setPlan: undefined } });
    const plan = await app.prisma.trainingPlan.findUniqueOrThrow({ where: { userId: user.id } });
    const configs = (plan.phaseConfigs as Array<Record<string, unknown>>).map((c) => (c.phase === "AUFBAU" ? { ...c, periodization: "WAVE" } : c));
    // Second week of the phase: the heavy week of the wave.
    const secondWeek = new Date(Date.now() - 9 * 86_400_000);
    secondWeek.setUTCHours(0, 0, 0, 0);
    await app.prisma.trainingPlan.update({ where: { id: plan.id }, data: { phaseConfigs: configs as unknown as Prisma.InputJsonValue, currentPhase: "AUFBAU", phaseStartedOn: secondWeek, pausedAt: null, extensionWeeks: 0 } });

    const status = (await call("GET", "/plan-exercises/week-status?phase=AUFBAU")).json();
    expect(status.periodization).toMatchObject({ kind: "WAVE", week: 2, label: "schwere Woche" });
    expect(status.days[0].exercises[0]).toMatchObject({ repRangeMin: 6, repRangeMax: 10, targetReps: 10, targetRir: 1 });

    // Another phase has no pattern: nothing is shifted there.
    const other = (await call("GET", "/plan-exercises/week-status?phase=MUSKELAUSDAUER")).json();
    expect(other.periodization ?? null).toBeNull();
  });

  it("takes the week pattern of an accepted draft over into the phase", async () => {
    await app.prisma.planSnapshot.upsert({
      where: { userId_phase_kind: { userId: user.id, phase: "NEGATIV", kind: "DRAFT" } },
      create: { userId: user.id, phase: "NEGATIV", kind: "DRAFT", days: [], items: [], periodization: "LINEAR" },
      update: { items: [], periodization: "LINEAR" },
    });
    expect((await call("POST", "/ai/plan-draft/accept", { phase: "NEGATIV" })).statusCode).toBe(200);
    const plan = (await call("GET", "/training-plan")).json();
    expect(plan.phases.find((p: { phase: string }) => p.phase === "NEGATIV").periodization).toBe("LINEAR");
  });

  it("takes a technique off a draft exercise together with its group", async () => {
    const item = (id: string, group: string | null) => ({ day: null, exerciseId: id, exerciseName: "x", technique: group ? "SUPERSET" : null, techniqueGroup: group, setScheme: null, setPlan: null });
    await app.prisma.planSnapshot.upsert({
      where: { userId_phase_kind: { userId: user.id, phase: "CUSTOM_1", kind: "DRAFT" } },
      create: { userId: user.id, phase: "CUSTOM_1", kind: "DRAFT", days: [], items: [item(exerciseIds[0], "G1"), item(exerciseIds[1], "G1"), item(randomUUID(), null)] },
      update: {},
    }).catch(() => undefined);
    // CUSTOM_1 is not in the default phases; the draft table does not care, the endpoint only reads the draft.
    const res = await call("POST", "/ai/plan-draft/clear-technique", { phase: "CUSTOM_1", index: 0 });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().draft.items.every((i: { technique: string | null; techniqueGroup: string | null }) => !i.technique && !i.techniqueGroup)).toBe(true);
  });
});
