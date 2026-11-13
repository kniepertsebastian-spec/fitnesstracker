import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authed, hasTestDb, signUp, startApp, type Session } from "./testApp.js";

describe.skipIf(!hasTestDb)("backup.json import (integration)", () => {
  let app: FastifyInstance;
  let source: Session;
  let target: Session;
  let customExerciseId: string;
  // Unique per run: a custom exercise that outlives a run would otherwise be found by name.
  const exerciseName = `Kabelzug ${randomUUID()}`;
  const createdExerciseIds: string[] = [];
  let backup: Record<string, unknown>;

  const call = (s: Session, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) =>
    app.inject({ method, url: `/api${url}`, headers: authed(s), payload: payload as Record<string, unknown> | undefined });

  beforeAll(async () => {
    app = await startApp();
    source = await signUp(app, "backup-source");
    target = await signUp(app, "backup-target");

    await call(source, "PUT", "/profile", { weightKg: 82, heightCm: 182, age: 30, gender: "MALE", activityLevel: "MODERATE", goal: "MAINTAIN" });
    const exercise = await call(source, "POST", "/exercises", { name: exerciseName });
    expect(exercise.statusCode).toBe(201);
    customExerciseId = exercise.json().id;
    createdExerciseIds.push(customExerciseId);
    for (const [setNumber, reps, weightKg] of [[1, 10, 40], [2, 8, 42.5]] as const) {
      const log = await call(source, "POST", "/workout-logs", {
        clientId: randomUUID(),
        exerciseId: customExerciseId,
        setNumber,
        reps,
        weightKg,
        performedAt: "2026-10-01T10:00:00.000Z",
      });
      expect(log.statusCode, log.body).toBe(201);
    }
    expect((await call(source, "POST", "/goals", { type: "WEIGHT", exerciseId: customExerciseId, targetValue: 60 })).statusCode).toBe(201);
    expect((await call(source, "POST", "/plan-exercises", { phase: "AUFBAU", exerciseId: customExerciseId, targetSets: 3, targetReps: 10, dayLabel: "A" })).statusCode).toBe(201);
    expect((await call(source, "POST", "/body-composition", { weightKg: 82, waistCm: 88, neckCm: 39, measuredAt: "2026-11-02T08:00:00.000Z" })).statusCode).toBe(201);
    expect((await call(source, "POST", "/body-fat-calibrations", { measuredOn: "2026-11-01", referencePercent: 18 })).statusCode).toBe(201);
    expect((await call(source, "POST", "/cardio-logs", { machine: "BIKE", intensity: "mittel", durationMinutes: 20 })).statusCode).toBe(201);
    expect((await call(source, "POST", "/supplements", { name: "Kreatin", reminderTime: "08:00", timeZone: "Europe/Berlin" })).statusCode).toBe(201);

    backup = (await call(source, "GET", "/export/backup.json")).json();
  });

  afterAll(async () => {
    // Users first (their sets and plan rows reference the exercises), then the exercises.
    await app.prisma.user.deleteMany({ where: { id: { in: [source.id, target.id] } } });
    await app.prisma.exercise.deleteMany({ where: { id: { in: createdExerciseIds } } });
    await app.close();
  });

  it("restores an export from account A into an empty account B", async () => {
    const res = await call(target, "POST", "/import/backup.json", backup);
    expect(res.statusCode, res.body).toBe(200);
    const result = res.json();
    expect(result.imported).toMatchObject({
      profile: 1,
      trainingPlan: 1,
      planExercises: 1,
      workoutLogs: 2,
      goals: 1,
      bodyCompositionEntries: 1,
      bodyFatCalibrations: 1,
      cardioLogs: 1,
      supplements: 1,
    });
    expect(result.skipped).toEqual({});

    // The custom exercise belongs to A only, so B gets its own private copy under the same name.
    expect(result.createdExercises).toBe(1);

    const again = (await call(target, "GET", "/export/backup.json")).json();
    // Sets with the same timestamp come back in no fixed order, so compare them sorted by set number.
    const strip = (rows: Array<Record<string, unknown>>, drop: string[]) =>
      rows
        .map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !drop.includes(key))))
        .sort((a, b) => Number(a.setNumber) - Number(b.setNumber));
    expect(strip(again.workoutLogs, ["id", "clientId", "exerciseId", "createdAt", "updatedAt"])).toEqual(
      strip(backup.workoutLogs as Array<Record<string, unknown>>, ["id", "clientId", "exerciseId", "createdAt", "updatedAt"]),
    );
    expect(again.profile).toEqual(backup.profile);
    expect(again.bodyCompositionEntries).toHaveLength(1);
    expect(again.bodyCompositionEntries[0]).toMatchObject({ waistCm: 88, neckCm: 39 });
    expect(again.bodyFatCalibrations[0]).toMatchObject({ measuredOn: "2026-11-01", referencePercent: 18 });
    expect(again.supplements[0]).toMatchObject({ name: "Kreatin", reminderTime: "08:00" });
    expect(again.planExercises[0]).toMatchObject({ phase: "AUFBAU", targetSets: 3, dayLabel: "A" });

    // Nothing of A was touched and the rows are really B's.
    const sourceAfter = (await call(source, "GET", "/export/backup.json")).json();
    expect(sourceAfter.workoutLogs).toHaveLength(2);
    const targetExercise = await app.prisma.exercise.findFirstOrThrow({ where: { ownerId: target.id } });
    expect(targetExercise.id).not.toBe(customExerciseId);
    expect(targetExercise.name).toBe(exerciseName);
    createdExerciseIds.push(targetExercise.id);
  });

  it("refuses a second import and any account that already has data", async () => {
    const again = await call(target, "POST", "/import/backup.json", backup);
    expect(again.statusCode).toBe(409);
    expect(again.json().message).toContain("leeres Konto");
    const populated = await call(source, "POST", "/import/backup.json", backup);
    expect(populated.statusCode).toBe(409);
  });

  it("rejects files that are not a backup and skips unusable rows", async () => {
    const empty = await signUp(app, "backup-empty");
    try {
      expect((await call(empty, "POST", "/import/backup.json", { hello: "world" })).statusCode).toBe(400);
      expect((await call(empty, "POST", "/import/backup.json", [1, 2])).statusCode).toBe(400);

      const partial = await call(empty, "POST", "/import/backup.json", {
        exportedAt: "2026-11-12T10:00:00.000Z",
        // One set whose exercise has no name and does not exist, one with a broken weight, one fine body entry.
        workoutLogs: [
          { exerciseId: randomUUID(), setNumber: 1, reps: 5, weightKg: 50, performedAt: "2026-10-01T10:00:00.000Z" },
          { exerciseId: randomUUID(), exerciseName: "Kniebeuge Import", setNumber: 1, reps: 5, weightKg: -3, performedAt: "2026-10-01T10:00:00.000Z" },
        ],
        bodyCompositionEntries: [{ measuredAt: "2026-10-01T08:00:00.000Z", weightKg: 80 }],
      });
      expect(partial.statusCode, partial.body).toBe(200);
      expect(partial.json().imported).toMatchObject({ workoutLogs: 0, bodyCompositionEntries: 1 });
      expect(partial.json().skipped.workoutLogs).toBe(2);
    } finally {
      const own = await app.prisma.exercise.findMany({ where: { ownerId: empty.id }, select: { id: true } });
      await app.prisma.user.deleteMany({ where: { id: empty.id } });
      await app.prisma.exercise.deleteMany({ where: { id: { in: own.map((e) => e.id) } } });
    }
  });
});
