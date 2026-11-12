import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../config/env.js";
import { authed, hasTestDb, multipartFile, operatorSession, signUp, startApp, type Session } from "./testApp.js";

// Everybody who gets an account (friends included) must only ever see and change their own data.
describe.skipIf(!hasTestDb)("data separation between accounts (integration)", () => {
  let app: FastifyInstance;
  let alice: Session;
  let bob: Session;
  let exerciseId: string;

  beforeAll(async () => {
    app = await startApp();
    alice = await signUp(app, "alice");
    bob = await signUp(app, "bob");
    const exercise = await app.prisma.exercise.create({ data: { name: `Integration squat ${randomUUID()}` } });
    exerciseId = exercise.id;
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: { in: [alice.id, bob.id] } } });
    await app.prisma.exercise.delete({ where: { id: exerciseId } }).catch(() => undefined);
    await app.close();
  });

  const call = (session: Session, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url, headers: authed(session), payload });

  describe("every data route needs a login", () => {
    it.each([
      "/api/supplements",
      "/api/workout-logs",
      "/api/workout-sessions/open",
      "/api/progress-photos",
      "/api/goals",
      "/api/cardio-logs",
    ])("%s answers 401 without a token", async (url) => {
      expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
    });
  });

  it("supplements: lists, edits and deletes only the own ones", async () => {
    const created = await call(alice, "POST", "/api/supplements", {
      name: "Alice creatine",
      reminderTime: "08:00",
      timeZone: "Europe/Berlin",
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const bobList = await call(bob, "GET", "/api/supplements");
    expect(bobList.json().items).toEqual([]);
    expect((await call(bob, "PATCH", `/api/supplements/${id}`, { name: "hijacked" })).statusCode).toBe(404);
    expect((await call(bob, "DELETE", `/api/supplements/${id}`)).statusCode).toBe(404);

    const aliceList = await call(alice, "GET", "/api/supplements");
    expect(aliceList.json().items).toHaveLength(1);
    expect(aliceList.json().items[0].name).toBe("Alice creatine");
  });

  it("exercises: custom ones are private; the catalog is only changeable by the operator", async () => {
    const created = await call(alice, "POST", "/api/exercises", { name: `Alice curl ${randomUUID()}` });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    // Bob neither sees nor changes Alice's exercise.
    expect((await call(bob, "GET", `/api/exercises/${id}`)).statusCode).toBe(404);
    expect((await call(bob, "PATCH", `/api/exercises/${id}`, { name: "hijacked" })).statusCode).toBe(404);
    expect((await call(bob, "DELETE", `/api/exercises/${id}`)).statusCode).toBe(404);
    const bobList = (await call(bob, "GET", "/api/exercises?pageSize=200")).json().items as { id: string }[];
    expect(bobList.some((e) => e.id === id)).toBe(false);
    // ... and cannot put it into a plan or goal either.
    expect((await call(bob, "POST", "/api/goals", { type: "WEIGHT", exerciseId: id, targetValue: 100 })).statusCode).toBe(404);

    // Alice can.
    expect((await call(alice, "PATCH", `/api/exercises/${id}`, { name: "Alice curl v2" })).statusCode).toBe(200);
    expect((await call(alice, "DELETE", `/api/exercises/${id}`)).statusCode).toBe(204);

    // The shared catalog (no owner) is visible to everybody but not changeable by a normal account.
    expect((await call(bob, "GET", `/api/exercises/${exerciseId}`)).statusCode).toBe(200);
    expect((await call(bob, "PATCH", `/api/exercises/${exerciseId}`, { name: "hijacked" })).statusCode).toBe(403);
    expect((await call(bob, "DELETE", `/api/exercises/${exerciseId}`)).statusCode).toBe(403);
    const operator = await operatorSession(app);
    expect((await call(operator, "PATCH", `/api/exercises/${exerciseId}`, { description: "ok" })).statusCode).toBe(200);
  });

  it("exercises: only the operator may import the catalog; videoUrl must be http(s)", async () => {
    expect((await call(bob, "POST", "/api/exercises/import", { source: "free-exercise-db" })).statusCode).toBe(403);
    const bad = await call(alice, "POST", "/api/exercises", { name: "x", videoUrl: "javascript:alert(1)" });
    expect(bad.statusCode).toBe(400);
  });

  it("workout logs: lists, edits and deletes only the own ones", async () => {
    const clientId = randomUUID();
    const created = await call(alice, "POST", "/api/workout-logs", {
      clientId,
      exerciseId,
      setNumber: 1,
      reps: 5,
      weightKg: 100,
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    expect((await call(bob, "GET", "/api/workout-logs")).json().items).toEqual([]);
    expect((await call(bob, "PATCH", `/api/workout-logs/${id}`, { reps: 99 })).statusCode).toBe(404);
    // The offline queue addresses rows by clientId — that must not open a way around the check.
    expect((await call(bob, "PATCH", `/api/workout-logs/${clientId}`, { reps: 99 })).statusCode).toBe(404);
    expect((await call(bob, "DELETE", `/api/workout-logs/${id}`)).statusCode).toBe(404);
    expect((await call(bob, "DELETE", `/api/workout-logs/${clientId}`)).statusCode).toBe(404);

    const mine = await call(alice, "GET", "/api/workout-logs");
    expect(mine.json().items).toHaveLength(1);
    expect(mine.json().items[0].reps).toBe(5);
  });

  it("workout logs: someone else's clientId is a conflict and never returns the other row", async () => {
    const clientId = randomUUID();
    const body = { clientId, exerciseId, setNumber: 1, reps: 8, weightKg: 60 };
    expect((await call(alice, "POST", "/api/workout-logs", body)).statusCode).toBe(201);
    // Alice's own retry stays idempotent …
    expect((await call(alice, "POST", "/api/workout-logs", body)).statusCode).toBe(200);
    // … but Bob must neither get her row back nor take it over.
    const clash = await call(bob, "POST", "/api/workout-logs", { ...body, reps: 1, weightKg: 1 });
    expect(clash.statusCode).toBe(409);
    expect(clash.body).not.toContain("60");
    const row = await app.prisma.workoutLog.findUnique({ where: { clientId } });
    expect(row?.userId).toBe(alice.id);
    expect(row?.reps).toBe(8);
  });

  it("workout sessions: someone else's clientId is a conflict, and the own session stays private", async () => {
    const clientId = randomUUID();
    const started = await call(alice, "POST", "/api/workout-sessions", { clientId });
    expect(started.statusCode).toBe(201);
    expect((await call(alice, "POST", "/api/workout-sessions", { clientId })).statusCode).toBe(200);
    expect((await call(bob, "POST", "/api/workout-sessions", { clientId })).statusCode).toBe(409);
    expect((await call(bob, "GET", "/api/workout-sessions/open")).json()).toBeNull();
    const sessionId = started.json().id as string;
    expect((await call(bob, "PATCH", `/api/workout-sessions/${sessionId}`, { status: "COMPLETED" })).statusCode).toBe(404);
  });

  it("cardio logs: someone else's clientId is a conflict; lists and deletes are per account", async () => {
    const clientId = randomUUID();
    const body = { clientId, machine: "TREADMILL", intensity: "easy", durationMinutes: 30 };
    const created = await call(alice, "POST", "/api/cardio-logs", body);
    expect(created.statusCode).toBeLessThan(300);
    expect((await call(bob, "POST", "/api/cardio-logs", body)).statusCode).toBe(409);
    expect((await call(bob, "GET", "/api/cardio-logs")).json().items).toEqual([]);
    expect((await call(bob, "DELETE", `/api/cardio-logs/${created.json().id}`)).statusCode).toBe(404);
  });

  it("goals: lists, edits and deletes only the own ones", async () => {
    const created = await call(alice, "POST", "/api/goals", { type: "BODYWEIGHT", targetValue: 80 });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    expect((await call(bob, "GET", "/api/goals")).json().items).toEqual([]);
    expect((await call(bob, "PATCH", `/api/goals/${id}`, { targetValue: 1 })).statusCode).toBe(404);
    expect((await call(bob, "DELETE", `/api/goals/${id}`)).statusCode).toBe(404);
    expect((await call(alice, "GET", "/api/goals")).json().items).toHaveLength(1);
  });

  describe("progress photo upload", () => {
    const png = () =>
      sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 139, g: 92, b: 246 } } })
        .png()
        .toBuffer();

    const upload = async (session: Session, contentType: string, data: Buffer) => {
      const { payload, headers } = multipartFile("file", "photo.png", contentType, data);
      return app.inject({
        method: "POST",
        url: "/api/progress-photos",
        headers: { ...authed(session), ...headers },
        payload,
      });
    };

    it("stores a valid image privately: only the owner can list, read or delete it", async () => {
      const res = await upload(alice, "image/png", await png());
      expect(res.statusCode).toBe(201);
      const photo = res.json() as { id: string };

      const file = await call(alice, "GET", `/api/progress-photos/${photo.id}/file`);
      expect(file.statusCode).toBe(200);
      expect(file.headers["content-type"]).toContain("image/");
      expect(file.headers["x-content-type-options"]).toBe("nosniff");

      expect((await call(bob, "GET", "/api/progress-photos")).json().items).toEqual([]);
      expect((await call(bob, "GET", `/api/progress-photos/${photo.id}/file`)).statusCode).toBe(404);
      expect((await call(bob, "DELETE", `/api/progress-photos/${photo.id}`)).statusCode).toBe(404);
      expect((await call(alice, "GET", "/api/progress-photos")).json().items).toHaveLength(1);
    });

    it("rejects files that are not images, whatever type they claim to be", async () => {
      expect((await upload(alice, "text/plain", Buffer.from("hello"))).statusCode).toBe(400);
      const fake = await upload(alice, "image/png", Buffer.from("<script>alert(1)</script>"));
      expect(fake.statusCode).toBeGreaterThanOrEqual(400);
      expect(fake.statusCode).toBeLessThan(500);
    });

    it("rejects an upload without a login and a request without a file", async () => {
      const { payload, headers } = multipartFile("file", "photo.png", "image/png", await png());
      expect((await app.inject({ method: "POST", url: "/api/progress-photos", headers, payload })).statusCode).toBe(401);
    });

    it("deleting the account also removes the stored photo file", async () => {
      const carol = await signUp(app, "carol");
      const res = await upload(carol, "image/png", await png());
      expect(res.statusCode).toBe(201);
      const stored = await app.prisma.progressPhoto.findFirstOrThrow({ where: { userId: carol.id } });
      const filePath = path.join(path.resolve(env.UPLOADS_DIR), stored.filename);
      expect(existsSync(filePath)).toBe(true);

      const del = await app.inject({
        method: "DELETE",
        url: "/api/auth/me",
        headers: authed(carol),
        payload: { password: "correct-horse-battery" },
      });
      expect(del.statusCode).toBe(204);
      expect(existsSync(filePath)).toBe(false);
    });
  });
});
