import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GeminiRequest } from "../modules/nutritionCapture/gemini.js";
import type { ImportJobKind, ImportJobs, JobState } from "../modules/nutritionCapture/importJobs.js";
import { ensureWeeklyDrops } from "../modules/nutritionCapture/weeklyDrops.service.js";
import { WEEKLY_DROP_CATALOG } from "../modules/nutritionCapture/weeklyDrops.catalog.js";
import { CATALOG_BLS_FIXTURE } from "../modules/nutritionCapture/weeklyDrops.fixture.js";
import { authed, hasTestDb, multipartFile, signUp, startApp, type Session } from "./testApp.js";

// Roadmap 04 end to end with a stubbed AI and an in-memory job queue: Scan & Learn (draft ->
// save with barcode -> found by barcode), voice, recipe import by link (preview, confirm,
// JSON-LD and AI paths), by text, and the weekly drops from BLS foods.

const read = (value: number) => ({ value, status: "read" });

class FakeJobs implements ImportJobs {
  enqueued: { kind: ImportJobKind; importId: string; url: string }[] = [];
  results = new Map<string, JobState>();
  async enqueue(kind: ImportJobKind, importId: string, url: string) {
    this.enqueued.push({ kind, importId, url });
  }
  async state(kind: ImportJobKind, importId: string): Promise<JobState> {
    return this.results.get(`${kind}-${importId}`) ?? { state: "pending" };
  }
  complete(kind: ImportJobKind, importId: string, result: unknown) {
    this.results.set(`${kind}-${importId}`, { state: "completed", result });
  }
  async close() {}
}

describe.skipIf(!hasTestDb)("nutrition capture (integration)", () => {
  let app: FastifyInstance;
  let a: Session;
  let b: Session;
  const jobs = new FakeJobs();
  const aiCalls: GeminiRequest[] = [];
  const tag = `zc${randomUUID().slice(0, 6)}`;
  let aiAnswer: unknown = null;
  const createdFoodIds: string[] = [];

  const post = (s: Session, url: string, payload: unknown) => app.inject({ method: "POST", url, payload: payload as object, headers: authed(s) });
  const get = (s: Session, url: string) => app.inject({ method: "GET", url, headers: authed(s) });
  const upload = (s: Session, url: string, field: string, filename: string, type: string) => {
    const { payload, headers } = multipartFile(field, filename, type, Buffer.from("x"));
    return app.inject({ method: "POST", url, payload, headers: { ...authed(s), ...headers } });
  };

  beforeAll(async () => {
    app = await startApp({
      capture: {
        importJobs: jobs,
        gemini: async () => async (request) => {
          aiCalls.push(request);
          return aiAnswer;
        },
      },
    });
    a = await signUp(app, "capture-a");
    b = await signUp(app, "capture-b");
    // A BLS food the voice and recipe matching can find.
    const skyr = await app.prisma.food.create({ data: { source: "BLS", sourceRef: `S${tag}`, name: `Skyr ${tag}`, kcal: 64, proteinG: 10.35, carbsG: 3.19, fatG: 0.84, estimatedFields: [] } });
    createdFoodIds.push(skyr.id);
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await app.prisma.food.deleteMany({ where: { id: { in: createdFoodIds } } });
    await app.close();
  });

  it("Scan & Learn: draft with status and plausibility, saved with barcode, found by barcode", async () => {
    const barcode = `40${String(Date.now()).slice(-11)}`;
    aiAnswer = {
      name: `Proteinpudding ${tag}`,
      brand: "Testmarke",
      basis: "PER_100G",
      nutrients: { kcal: read(75), proteinG: read(10), carbsG: read(5.5), fatG: read(1.4), sugarG: read(5), saltG: { value: 0.2, status: "estimated" } },
      packageSize: { value: 200, unit: "g", status: "read" },
      notes: [],
    };
    // Two files and two fields in one form.
    const boundary = `----capture${randomUUID().replace(/-/g, "")}`;
    const part = (head: string, body: Buffer | string) => Buffer.concat([Buffer.from(`--${boundary}\r\n${head}\r\n\r\n`), Buffer.isBuffer(body) ? body : Buffer.from(body), Buffer.from("\r\n")]);
    const payload = Buffer.concat([
      part('Content-Disposition: form-data; name="barcode"', barcode),
      part('Content-Disposition: form-data; name="productName"', "Pudding"),
      part('Content-Disposition: form-data; name="label"; filename="label.jpg"\r\nContent-Type: image/jpeg', Buffer.from([0xff, 0xd8, 0xff])),
      part('Content-Disposition: form-data; name="front"; filename="front.jpg"\r\nContent-Type: image/jpeg', Buffer.from([0xff, 0xd8, 0xff])),
      Buffer.from(`--${boundary}--\r\n`),
    ]);
    const res = await app.inject({ method: "POST", url: "/api/nutrition/scan/label", payload, headers: { ...authed(a), "content-type": `multipart/form-data; boundary=${boundary}` } });
    expect(res.statusCode, res.body).toBe(200);
    const draft = res.json();
    expect(aiCalls.at(-1)!.media).toHaveLength(2);
    expect(draft).toMatchObject({ name: `Proteinpudding ${tag}`, barcode, basis: "PER_100G", estimatedFields: ["saltG"] });
    expect(draft.status.fiberG).toBe("unknown");
    expect(draft.per100.fiberG).toBeNull();
    expect(draft.plausibility.ok).toBe(true);
    expect(draft.suggestedUnits).toEqual([{ label: "Packung", baseAmount: 200, status: "verified" }]);

    // "Speichern": the app saves the draft as the user's own food (layer 1) with the barcode.
    const id = randomUUID();
    const saved = await app.inject({
      method: "PUT",
      url: `/api/nutrition/foods/${id}`,
      headers: authed(a),
      payload: { name: draft.name, brand: draft.brand, barcode, basis: draft.basis, nutrients: draft.per100, estimatedFields: draft.estimatedFields, units: [{ id: randomUUID(), label: "Packung", baseAmount: 200 }], clientUpdatedAt: new Date().toISOString() },
    });
    expect(saved.statusCode, saved.body).toBe(200);
    const found = await get(a, `/api/nutrition/foods/barcode/${barcode}`);
    expect(found.statusCode).toBe(200);
    expect(found.json()).toMatchObject({ id, source: "USER", own: true });
    // The barcode is the user's own: someone else does not find it in layer 1.
    expect((await get(b, `/api/nutrition/foods/barcode/${barcode}`)).json().id).not.toBe(id);
  });

  it("Scan & Learn rejects a missing photo and other file types", async () => {
    const none = await upload(a, "/api/nutrition/scan/label", "front", "f.jpg", "image/jpeg");
    expect(none.statusCode).toBe(400);
    const pdf = await upload(a, "/api/nutrition/scan/label", "label", "l.pdf", "application/pdf");
    expect(pdf.statusCode).toBe(400);
  });

  it("flags a label whose kcal do not fit the macros", async () => {
    aiAnswer = { basis: "PER_100G", nutrients: { kcal: read(750), proteinG: read(10), carbsG: read(5.5), fatG: read(1.4) } };
    const res = await upload(a, "/api/nutrition/scan/label", "label", "l.png", "image/png");
    expect(res.statusCode).toBe(200);
    expect(res.json().plausibility).toMatchObject({ ok: false, suspiciousFields: expect.arrayContaining(["kcal"]) });
  });

  it("voice: audio or text becomes matched items to confirm", async () => {
    aiAnswer = { transcript: `200 Gramm Skyr ${tag}`, items: [{ name: `Skyr ${tag}`, quantity: 200, unit: "Gramm", quantityStatus: "read" }] };
    const audio = await upload(a, "/api/nutrition/voice", "audio", "a.webm", "audio/webm;codecs=opus");
    expect(audio.statusCode, audio.body).toBe(200);
    expect(aiCalls.at(-1)!.media![0]!.mimeType).toBe("audio/webm");
    const item = audio.json().items[0];
    expect(item).toMatchObject({ quantity: 200, unit: "g", quantityStatus: "verified" });
    expect(item.candidates[0]).toMatchObject({ id: createdFoodIds[0], source: "BLS" });

    const text = await post(a, "/api/nutrition/voice", { text: `200 g Skyr ${tag}` });
    expect(text.statusCode).toBe(200);
    expect(aiCalls.at(-1)!.prompt).toContain(`200 g Skyr ${tag}`);
  });

  it("recipe link: free preview, confirm, JSON-LD draft without AI", async () => {
    const created = await post(a, "/api/nutrition/recipe-imports/url", { url: "https://www.example.org/rezept/skyr-bowl" });
    expect(created.statusCode, created.body).toBe(201);
    const { id, status, platform } = created.json();
    expect({ status, platform }).toEqual({ status: "PREVIEW_PENDING", platform: "web" });
    expect(jobs.enqueued.at(-1)).toMatchObject({ kind: "preview", importId: id });

    expect((await get(a, `/api/nutrition/recipe-imports/${id}`)).json().status).toBe("PREVIEW_PENDING");
    // Not confirmable before the preview is there.
    expect((await post(a, `/api/nutrition/recipe-imports/${id}/confirm`, {})).statusCode).toBe(409);

    jobs.complete("preview", id, { platform: "web", title: "Skyr-Bowl", author: null, durationSec: null });
    expect((await get(a, `/api/nutrition/recipe-imports/${id}`)).json()).toMatchObject({ status: "PREVIEW_READY", title: "Skyr-Bowl" });
    // Someone else's import is not visible.
    expect((await get(b, `/api/nutrition/recipe-imports/${id}`)).statusCode).toBe(404);

    const confirmed = await post(a, `/api/nutrition/recipe-imports/${id}/confirm`, {});
    expect(confirmed.json().status).toBe("EXTRACT_PENDING");
    expect(jobs.enqueued.at(-1)).toMatchObject({ kind: "extract", importId: id });

    const callsBefore = aiCalls.length;
    jobs.complete("extract", id, {
      platform: "web",
      title: "Skyr-Bowl",
      jsonLd: { name: "Skyr-Bowl", yield: "1", ingredients: [`300 g Skyr ${tag}`, "Zimt nach Belieben"], instructions: ["Alles mischen."] },
      text: "",
    });
    const ready = (await get(a, `/api/nutrition/recipe-imports/${id}`)).json();
    expect(ready.status).toBe("READY");
    expect(aiCalls.length).toBe(callsBefore);
    expect(ready.draft.method).toBe("json-ld");
    expect(ready.draft.ingredients[0]).toMatchObject({ quantity: 300, unit: "g", status: "verified" });
    expect(ready.draft.ingredients[0].candidates[0].id).toBe(createdFoodIds[0]);
    expect(ready.draft.ingredients[1]).toMatchObject({ quantity: null, status: "unknown" });
    expect(ready.draft.openQuestions).toContain("Menge für „Zimt nach Belieben“?");
    expect(ready.draft).not.toHaveProperty("nutrients");
  });

  it("recipe link without JSON-LD: the page text goes to the AI", async () => {
    const { id } = (await post(a, "/api/nutrition/recipe-imports/url", { url: "https://www.tiktok.com/@koch/video/1" })).json();
    jobs.complete("preview", id, { platform: "tiktok", title: "Quark-Bowl", author: "koch", durationSec: 30 });
    await get(a, `/api/nutrition/recipe-imports/${id}`);
    await post(a, `/api/nutrition/recipe-imports/${id}/confirm`, {});
    jobs.complete("extract", id, { platform: "tiktok", title: "Quark-Bowl", jsonLd: null, text: "Ich nehme 250 g Magerquark und eine Banane, dazu etwas Honig." });
    aiAnswer = {
      title: "Quark-Bowl",
      servings: { value: null, status: "unknown" },
      ingredients: [
        { name: "Magerquark", quantity: 250, unit: "g", status: "read" },
        { name: "Honig", quantity: null, unit: null, status: "unknown" },
      ],
      steps: [],
      openQuestions: [],
    };
    const ready = (await get(a, `/api/nutrition/recipe-imports/${id}`)).json();
    expect(ready.status, ready.error).toBe("READY");
    expect(ready.platform).toBe("tiktok");
    expect(aiCalls.at(-1)!.prompt).toContain("250 g Magerquark");
    expect(ready.draft.method).toBe("ai");
    expect(ready.draft.openQuestions).toEqual(expect.arrayContaining(["Menge für „Honig“?", "Wie viele Portionen ergibt das Rezept?"]));
  });

  it("a failed link job ends in FAILED with the fallbacks", async () => {
    const { id } = (await post(a, "/api/nutrition/recipe-imports/url", { url: "https://www.instagram.com/reel/x/" })).json();
    jobs.results.set(`preview-${id}`, { state: "failed", error: "HTTP 403" });
    expect((await get(a, `/api/nutrition/recipe-imports/${id}`)).json()).toMatchObject({ status: "FAILED", error: "Link nicht lesbar: HTTP 403" });
  });

  it("rejects links that are not http(s)", async () => {
    expect((await post(a, "/api/nutrition/recipe-imports/url", { url: "file:///etc/passwd" })).statusCode).toBe(400);
  });

  it("recipe from pasted text is ready at once", async () => {
    aiAnswer = { title: "Notiz", servings: read(2), ingredients: [{ name: `Skyr ${tag}`, quantity: 500, unit: "g", status: "read" }], steps: ["Rühren."], openQuestions: [] };
    const res = await post(a, "/api/nutrition/recipe-imports/text", { text: `500 g Skyr ${tag} für zwei Portionen, glatt rühren.` });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json()).toMatchObject({ source: "TEXT", status: "READY", draft: { servings: { value: 2, status: "verified" } } });
    const list = (await get(a, "/api/nutrition/recipe-imports")).json().items;
    expect(list.length).toBeGreaterThanOrEqual(4);
    const del = await app.inject({ method: "DELETE", url: `/api/nutrition/recipe-imports/${res.json().id}`, headers: authed(a) });
    expect(del.statusCode).toBe(204);
  });

  it("weekly drops: created from the BLS foods, filtered by the remaining budget", async () => {
    // The catalog foods with their real BLS values (upsert: the test database may have them).
    for (const [code, [kcal, proteinG, carbsG, fatG]] of Object.entries(CATALOG_BLS_FIXTURE)) {
      await app.prisma.food.upsert({
        where: { source_sourceRef: { source: "BLS", sourceRef: code } },
        create: { source: "BLS", sourceRef: code, name: `BLS ${code}`, kcal, proteinG, carbsG, fatG, estimatedFields: [] },
        update: {},
      });
    }
    // A week far ahead, so this run does not depend on what the scheduler already created.
    const now = new Date("2031-03-12T12:00:00Z");
    await app.prisma.nutritionWeeklyDrop.deleteMany({ where: { weekStart: { gte: new Date("2031-01-01") } } });
    const first = await ensureWeeklyDrops(app.prisma, now);
    expect(first).toEqual({ weekStart: "2031-03-09", created: 4 });
    expect((await ensureWeeklyDrops(app.prisma, now)).created).toBe(0);

    const rows = await app.prisma.nutritionWeeklyDrop.findMany({ where: { weekStart: new Date("2031-03-09") } });
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.proteinG!).toBeGreaterThanOrEqual(30);
      expect(row.kcal!).toBeLessThanOrEqual(600);
      expect(WEEKLY_DROP_CATALOG.some((r) => r.key === row.catalogKey)).toBe(true);
    }
    // Next week: none of these again.
    await ensureWeeklyDrops(app.prisma, new Date("2031-03-19T12:00:00Z"));
    const next = await app.prisma.nutritionWeeklyDrop.findMany({ where: { weekStart: new Date("2031-03-16") } });
    expect(next).toHaveLength(4);
    expect(next.filter((n) => rows.some((r) => r.catalogKey === n.catalogKey))).toEqual([]);
    await app.prisma.nutritionWeeklyDrop.deleteMany({ where: { weekStart: { gte: new Date("2031-01-01") } } });

    const res = await get(a, "/api/nutrition/weekly-drops");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.drops.length).toBeGreaterThanOrEqual(3);
    expect(body.drops[0].ingredients[0]).toHaveProperty("foodId");
    const filtered = (await get(a, "/api/nutrition/weekly-drops?maxKcal=1")).json();
    expect(filtered.drops).toEqual([]);
    expect(filtered.hiddenCount).toBe(body.drops.length);
  });
});
