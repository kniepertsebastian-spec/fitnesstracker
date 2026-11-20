import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authed, hasTestDb, operatorSession, signUp, startApp, type Session } from "./testApp.js";

describe.skipIf(!hasTestDb)("exercise catalog for the offline copy (integration)", () => {
  let app: FastifyInstance;
  let alice: Session;
  let bob: Session;
  let operator: Session;
  const tag = randomUUID();
  const created: string[] = [];

  const call = (s: Session, method: "GET" | "POST" | "PATCH", url: string, payload?: unknown) =>
    app.inject({ method, url: `/api${url}`, headers: authed(s), payload: payload as Record<string, unknown> | undefined });

  beforeAll(async () => {
    app = await startApp();
    alice = await signUp(app, "catalog-a");
    bob = await signUp(app, "catalog-b");
    operator = await operatorSession(app);
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: { in: [alice.id, bob.id] } } });
    await app.prisma.exercise.deleteMany({ where: { id: { in: created } } });
    await app.close();
  });

  it("sends the whole catalog with both names, and 'unchanged' for the version it already has", async () => {
    const own = await call(alice, "POST", "/exercises", { name: `Eigene Übung ${tag}` });
    created.push(own.json().id);
    const catalogExercise = await app.prisma.exercise.create({
      data: { name: `Deadlift ${tag}`, nameDe: `Kreuzheben ${tag}`, description: "Stand with your feet hip width apart.", descriptionDe: "Stelle dich mit den Füßen hüftbreit hin.", equipment: "barbell", primaryMuscles: ["lower back"], source: "test", sourceId: tag },
    });
    created.push(catalogExercise.id);

    const first = (await call(alice, "GET", "/exercises/catalog")).json();
    expect(typeof first.version).toBe("string");
    const byId = new Map<string, { name: string; nameEn?: string; description: string | null; descriptionLang?: string | null }>(first.items.map((e: { id: string }) => [e.id, e]));
    // German name and the English original both come along, so "deadlift" can find "Kreuzheben" offline.
    expect(byId.get(catalogExercise.id)).toMatchObject({ name: `Kreuzheben ${tag}`, nameEn: `Deadlift ${tag}`, descriptionLang: "de", description: "Stelle dich mit den Füßen hüftbreit hin." });
    expect(byId.get(own.json().id)).toBeDefined();

    const again = (await call(alice, "GET", `/exercises/catalog?version=${encodeURIComponent(first.version)}`)).json();
    expect(again).toEqual({ version: first.version, unchanged: true });

    // Any change moves the version on.
    await call(alice, "PATCH", `/exercises/${own.json().id}`, { name: `Umbenannt ${tag}` });
    const changed = (await call(alice, "GET", `/exercises/catalog?version=${encodeURIComponent(first.version)}`)).json();
    expect(changed.unchanged).toBeUndefined();
    expect(changed.version).not.toBe(first.version);
    expect(changed.items.find((e: { id: string }) => e.id === own.json().id).name).toBe(`Umbenannt ${tag}`);
  });

  it("keeps custom exercises private to their owner", async () => {
    const mine = (await call(alice, "GET", "/exercises/catalog")).json().items.map((e: { id: string }) => e.id);
    const bobs = (await call(bob, "GET", "/exercises/catalog")).json().items.map((e: { id: string }) => e.id);
    const customId = created[0];
    expect(mine).toContain(customId);
    expect(bobs).not.toContain(customId);
  });

  it("shows the English description when there is no German one, and edits the German text where it exists", async () => {
    const english = await app.prisma.exercise.create({
      data: { name: `Plank ${tag}`, nameDe: `Unterarmstütz ${tag}`, description: "Hold the position.", source: "test", sourceId: `${tag}-plank` },
    });
    created.push(english.id);
    expect((await call(alice, "GET", `/exercises/${english.id}`)).json()).toMatchObject({ description: "Hold the position.", descriptionLang: "en" });

    const german = created[1];
    const edit = await call(operator, "PATCH", `/exercises/${german}`, { description: "Neu formuliert." });
    expect(edit.statusCode, edit.body).toBe(200);
    const row = await app.prisma.exercise.findUniqueOrThrow({ where: { id: german } });
    expect(row.descriptionDe).toBe("Neu formuliert.");
    expect(row.description).toBe("Stand with your feet hip width apart.");
  });

  it("lets only the operator start the translation run", async () => {
    const state = (await call(alice, "GET", "/exercises/translate-descriptions")).json();
    expect(state).toMatchObject({ isOperator: false, running: false });
    expect(typeof state.remaining).toBe("number");
    expect((await call(alice, "POST", "/exercises/translate-descriptions")).statusCode).toBe(403);
    expect((await call(operator, "GET", "/exercises/translate-descriptions")).json().isOperator).toBe(true);
  });

  it("refuses bad picture paths, with or without the small version", async () => {
    expect((await app.inject({ method: "GET", url: "/api/exercise-images/../../etc/passwd" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/exercise-images/not-an-image.txt?w=600" })).statusCode).toBe(404);
  });
});
