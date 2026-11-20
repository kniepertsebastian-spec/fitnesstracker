import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authed, hasTestDb, multipartFile, signUp, startApp, type Session } from "./testApp.js";

describe.skipIf(!hasTestDb)("plan phases, phase import/export, templates, daily (integration)", () => {
  let app: FastifyInstance;
  let user: Session;
  const exerciseIds: string[] = [];
  const names = [`Bankdruecken ${randomUUID()}`, `Seitheben ${randomUUID()}`];

  const call = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown) =>
    app.inject({ method, url: `/api${url}`, headers: authed(user), payload: payload as Record<string, unknown> | undefined });

  const upload = (url: string, json: unknown) => {
    const part = multipartFile("file", "plan.json", "application/json", Buffer.from(typeof json === "string" ? json : JSON.stringify(json)));
    return app.inject({ method: "POST", url: `/api${url}`, headers: { ...authed(user), ...part.headers }, payload: part.payload });
  };

  const planEntries = async (phase: string) => (await call("GET", `/plan-exercises?phase=${phase}`)).json().items as Array<{ exerciseName: string; dayLabel: string | null }>;

  beforeAll(async () => {
    app = await startApp();
    user = await signUp(app, "plan-phases");
    for (const name of names) {
      const res = await call("POST", "/exercises", { name });
      expect(res.statusCode, res.body).toBe(201);
      exerciseIds.push(res.json().id);
    }
    await call("GET", "/training-plan");
    expect((await call("POST", "/plan-exercises", { phase: "AUFBAU", exerciseId: exerciseIds[0], targetSets: 4, targetReps: 8, dayLabel: "Push" })).statusCode).toBe(201);
    expect((await call("POST", "/plan-exercises", { phase: "AUFBAU", exerciseId: exerciseIds[1], targetSets: 3, targetReps: 12, dayLabel: "Pull" })).statusCode).toBe(201);
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: user.id } });
    await app.prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
    await app.close();
  });

  it("exports a single phase with its day labels", async () => {
    const res = await call("GET", "/plan-exercises/export?format=json&phase=AUFBAU");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toContain("trainingsplan-aufbau.json");
    const rows = res.json() as Array<{ phase: string; dayLabel: string | null; exerciseName: string }>;
    expect(rows.map((r) => r.dayLabel)).toEqual(["Push", "Pull"]);
    expect(rows.every((r) => r.phase === "AUFBAU")).toBe(true);
    const other = (await call("GET", "/plan-exercises/export?format=json&phase=NEGATIV")).json();
    expect(other).toEqual([]);
  });

  it("previews a file, then takes one phase over into another without touching the rotation", async () => {
    const before = (await call("GET", "/training-plan")).json();
    const file = (await call("GET", "/plan-exercises/export?format=json&phase=AUFBAU")).body;

    const preview = await upload("/plan-exercises/import/preview?format=json", file);
    expect(preview.statusCode, preview.body).toBe(200);
    expect(preview.json().phases).toEqual([{ phase: "AUFBAU", count: 2, days: ["Push", "Pull"] }]);

    const imported = await upload("/plan-exercises/import?format=json&sourcePhase=AUFBAU&targetPhase=MUSKELAUSDAUER&mode=merge", file);
    expect(imported.statusCode, imported.body).toBe(200);
    expect(imported.json()).toMatchObject({ created: 2, updated: 0, deleted: 0, errors: [] });
    const entries = await planEntries("MUSKELAUSDAUER");
    expect(entries.map((e) => [e.exerciseName, e.dayLabel])).toEqual([
      [names[0], "Push"],
      [names[1], "Pull"],
    ]);

    // Same file again: matching entries are updated, nothing is duplicated.
    const again = await upload("/plan-exercises/import?format=json&sourcePhase=AUFBAU&targetPhase=MUSKELAUSDAUER&mode=merge", file);
    expect(again.json()).toMatchObject({ created: 0, updated: 2 });
    expect(await planEntries("MUSKELAUSDAUER")).toHaveLength(2);

    const after = (await call("GET", "/training-plan")).json();
    expect(after.currentPhase).toBe(before.currentPhase);
    expect(after.phaseStartedOn).toBe(before.phaseStartedOn);
    expect(after.extensionWeeks).toBe(before.extensionWeeks);
  });

  it("replace empties the target phase first; an unknown target phase is refused", async () => {
    const file = JSON.stringify([{ phase: "AUFBAU", exerciseName: names[1], targetSets: 5, dayLabel: "Pull" }]);
    const replaced = await upload("/plan-exercises/import?format=json&targetPhase=MUSKELAUSDAUER&mode=replace", file);
    expect(replaced.json()).toMatchObject({ created: 1, deleted: 2 });
    expect(await planEntries("MUSKELAUSDAUER")).toHaveLength(1);

    const unknown = await upload("/plan-exercises/import?format=json&targetPhase=CUSTOM_3&mode=merge", file);
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json().message).toContain("CUSTOM_3");
  });

  it("an old-format file (five columns) still imports", async () => {
    const csv = `phase,exerciseName,targetSets,targetReps,order\r\nNEGATIV,${names[0]},4,5,0\r\n`;
    const part = multipartFile("file", "alt.csv", "text/csv", Buffer.from(csv));
    const res = await app.inject({ method: "POST", url: "/api/plan-exercises/import?format=csv", headers: { ...authed(user), ...part.headers }, payload: part.payload });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ created: 1, errors: [] });
  });

  it("applies a phase template: refuses while phases hold exercises, then lays out empty phases", async () => {
    const refused = await call("POST", "/training-plan/phase-template", { goal: "MUSCLE_GAIN" });
    expect(refused.statusCode).toBe(409);

    const ok = await call("POST", "/training-plan/phase-template", { goal: "MUSCLE_GAIN", clearExisting: true });
    expect(ok.statusCode, ok.body).toBe(200);
    const plan = ok.json();
    expect(plan.phases.map((p: { label: string }) => p.label)).toEqual(["Hypertrophie", "Deload", "Maximalkraft", "Definition", "Erhalt"]);
    expect(plan.phases.map((p: { weeks: number }) => p.weeks)).toEqual([8, 1, 6, 6, 4]);
    expect(plan.currentPhase).toBe("AUFBAU");
    expect(plan.trainingGoal).toBe("MUSCLE_GAIN");
    for (const phase of ["AUFBAU", "MUSKELAUSDAUER", "NEGATIV", "CUSTOM_1", "CUSTOM_2"]) {
      expect(await planEntries(phase)).toHaveLength(0);
    }
  });

  it("keeps separate open sessions for the workout and the Daily phase", async () => {
    const training = randomUUID();
    const dailyA = randomUUID();
    const dailyB = randomUUID();
    expect((await call("POST", "/workout-sessions", { clientId: training })).statusCode).toBe(201);
    expect((await call("POST", "/workout-sessions", { clientId: dailyA, kind: "DAILY" })).statusCode).toBe(201);

    expect((await call("GET", "/workout-sessions/open")).json()).toMatchObject({ clientId: training, kind: "TRAINING" });
    expect((await call("GET", "/workout-sessions/open?kind=DAILY")).json()).toMatchObject({ clientId: dailyA, kind: "DAILY" });

    // Pausing the Daily session does not touch the workout, and a new Daily session replaces only the old Daily one.
    expect((await call("PATCH", `/workout-sessions/${dailyA}`, { status: "PAUSED" })).json().status).toBe("PAUSED");
    expect((await call("POST", "/workout-sessions", { clientId: dailyB, kind: "DAILY" })).statusCode).toBe(201);
    expect((await call("GET", "/workout-sessions/open?kind=DAILY")).json().clientId).toBe(dailyB);
    expect((await call("GET", "/workout-sessions/open")).json()).toMatchObject({ clientId: training, status: "ACTIVE" });
  });

  it("stores the hour of the daily reminder", async () => {
    expect((await call("GET", "/push/settings")).json().dailyReminderHour).toBe(20);
    const res = await call("PATCH", "/push/settings", { dailyReminderHour: 18, remindDailyChallenge: false });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ dailyReminderHour: 18, remindDailyChallenge: false });
    expect((await call("PATCH", "/push/settings", { dailyReminderHour: 25 })).statusCode).toBe(400);
  });
});
