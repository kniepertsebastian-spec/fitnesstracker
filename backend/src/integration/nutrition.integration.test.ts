import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authed, hasTestDb, signUp, startApp, type Session } from "./testApp.js";

// Kalorientracker API end to end against a real database: foods (layers, search, LWW), recipes
// with raw vs. final weight, append-only meals with immutable snapshots, ratings, targets from the
// Fitnesstracker profile, delta sync, export, and that one account never sees another's data.

describe.skipIf(!hasTestDb)("nutrition (integration)", () => {
  let app: FastifyInstance;
  let a: Session;
  let b: Session;
  const tag = `zq${randomUUID().slice(0, 6)}`;
  const sharedFoodIds: string[] = [];
  const at = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * 60_000).toISOString();

  const put = (s: Session, url: string, payload: unknown) => app.inject({ method: "PUT", url, payload: payload as object, headers: authed(s) });
  const post = (s: Session, url: string, payload: unknown) => app.inject({ method: "POST", url, payload: payload as object, headers: authed(s) });
  const get = (s: Session, url: string) => app.inject({ method: "GET", url, headers: authed(s) });
  const del = (s: Session, url: string) => app.inject({ method: "DELETE", url, headers: authed(s) });

  let pastaId: string;
  let oilId: string;
  let blsPastaId: string;

  beforeAll(async () => {
    app = await startApp();
    a = await signUp(app, "nutrition-a");
    b = await signUp(app, "nutrition-b");
    // A shared BLS food (layer 2), as the importer writes it.
    const bls = await app.prisma.food.create({
      data: { source: "BLS", sourceRef: `T${tag}`, name: `Nudeln ${tag} gekocht`, kcal: 150, proteinG: 5, carbsG: 30, fatG: 1, estimatedFields: [] },
    });
    blsPastaId = bls.id;
    sharedFoodIds.push(bls.id);
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await app.prisma.food.deleteMany({ where: { id: { in: sharedFoodIds } } });
    await app.close();
  });

  it("creates own foods and finds them before BLS in the search", async () => {
    pastaId = randomUUID();
    const res = await put(a, `/api/nutrition/foods/${pastaId}`, {
      name: `Nudeln ${tag} Protein`,
      brand: "Testmarke",
      barcode: "4000000099991",
      kcal: 350,
      proteinG: 25,
      carbsG: 50,
      fatG: 3,
      fiberG: 8,
      units: [{ id: randomUUID(), label: "Packung", baseAmount: 250 }],
      clientUpdatedAt: at(0),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("applied");
    expect(res.json().food.status.kcal).toBe("verified");
    expect(res.json().food.status.sugarG).toBe("unknown");

    oilId = randomUUID();
    const oil = await put(a, `/api/nutrition/foods/${oilId}`, {
      name: `Olivenöl ${tag}`,
      kcal: 899,
      proteinG: 0,
      carbsG: 0,
      fatG: 99.9,
      densityGPerMl: 0.91,
      clientUpdatedAt: at(0),
    });
    expect(oil.statusCode).toBe(200);

    const search = await get(a, `/api/nutrition/foods/search?q=${encodeURIComponent(`Nudeln ${tag}`)}`);
    expect(search.statusCode).toBe(200);
    const items = search.json().items as { id: string; source: string; own: boolean }[];
    // Own food (layer 1) before BLS (layer 2); weaker fuzzy matches (the oil shares the test tag) come after.
    expect(items.map((i) => i.id).slice(0, 2)).toEqual([pastaId, blsPastaId]);
    expect(items[0]!.own).toBe(true);

    // Typo-tolerant (trigram)
    const fuzzy = await get(a, `/api/nutrition/foods/search?q=${encodeURIComponent(`Olivenoel ${tag}`)}`);
    expect((fuzzy.json().items as { id: string }[]).map((i) => i.id)).toContain(oilId);
  });

  it("ranks the plain food above dishes, ignores split words and knows everyday synonyms", async () => {
    const make = (name: string) =>
      app.prisma.food.create({ data: { source: "BLS", sourceRef: `T${randomUUID().slice(0, 8)}`, name, kcal: 100, estimatedFields: [] } });
    const dish = await make(`Haferflocken${tag} gesüßt, mit Milch 3,5 % Fett und Fruchtmischung`);
    const plain = await make(`Hafer Flocken${tag}, gekocht`);
    const egg = await make(`Hühnerei${tag} roh`);
    sharedFoodIds.push(dish.id, plain.id, egg.id);

    const oats = await get(a, `/api/nutrition/foods/search?q=${encodeURIComponent(`Haferflocken${tag}`)}`);
    expect((oats.json().items as { id: string }[]).map((i) => i.id)).toEqual([plain.id, dish.id]);
    expect(oats.json().items[0].attribution).toContain("Bundeslebensmittelschlüssel");
    // "Ei" alone also searches "Hühnerei" (BLS name).
    const eggs = await get(a, "/api/nutrition/foods/search?q=Ei&limit=50");
    expect((eggs.json().items as { id: string }[]).map((i) => i.id)).toContain(egg.id);
  });

  it("keeps accounts apart", async () => {
    expect((await get(b, `/api/nutrition/foods/${pastaId}`)).statusCode).toBe(404);
    const search = await get(b, `/api/nutrition/foods/search?q=${encodeURIComponent(`Nudeln ${tag}`)}`);
    const seen = (search.json().items as { id: string }[]).map((i) => i.id);
    expect(seen).toContain(blsPastaId);
    expect(seen).not.toContain(pastaId);
    expect(seen).not.toContain(oilId);
    // Not editable through someone else's id, shared foods not editable at all.
    const steal = await put(b, `/api/nutrition/foods/${pastaId}`, { name: "x", clientUpdatedAt: at(10) });
    expect(steal.statusCode).toBe(403);
    expect((await put(a, `/api/nutrition/foods/${blsPastaId}`, { name: "x", clientUpdatedAt: at(10) })).statusCode).toBe(403);
    expect((await del(a, `/api/nutrition/foods/${blsPastaId}`)).statusCode).toBe(403);
  });

  it("finds a barcode in the own foods and in the OFF cache without asking OFF", async () => {
    const own = await get(a, "/api/nutrition/foods/barcode/4000000099991");
    expect(own.statusCode).toBe(200);
    expect(own.json().id).toBe(pastaId);

    const code = `9${Date.now()}`.slice(0, 13);
    const cached = await app.prisma.food.create({
      data: { source: "OFF", sourceRef: code, barcode: code, name: `Riegel ${tag}`, kcal: 400, units: { create: [{ label: "Packung", baseAmount: 40 }] } },
    });
    sharedFoodIds.push(cached.id);
    const res = await get(b, `/api/nutrition/foods/barcode/${code}`);
    expect(res.statusCode).toBe(200);
    expect(res.json().source).toBe("OFF");
    expect(res.json().units).toEqual([expect.objectContaining({ label: "Packung", baseAmount: 40, own: false })]);
  });

  let mealId: string;
  let firstEntryId: string;

  it("logs a meal with a snapshot that a later food edit does not change", async () => {
    mealId = randomUUID();
    firstEntryId = randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const log = await post(a, "/api/nutrition/meals", {
      id: mealId,
      date: today,
      mealType: "LUNCH",
      entries: [
        { id: firstEntryId, foodId: pastaId, quantity: 0.5, unitLabel: "Packung" },
        { id: randomUUID(), foodId: oilId, quantity: 10, unitLabel: "ml" },
      ],
    });
    expect(log.statusCode).toBe(201);
    const entries = log.json().entries as { id: string; grams: number; nutrients: { kcal: number; proteinG: number; fatG: number } }[];
    expect(entries[0]).toMatchObject({ grams: 125, nutrients: { kcal: 437.5, proteinG: 31.25 } });
    expect(entries[1]!.grams).toBe(9.1);
    expect(entries[1]!.nutrients.kcal).toBe(81.8);

    // Idempotent retry: same ids, nothing added.
    const retry = await post(a, "/api/nutrition/meals", { id: mealId, date: today, mealType: "LUNCH", entries: [{ id: firstEntryId, foodId: pastaId, quantity: 3, unitLabel: "Packung" }] });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().entries).toHaveLength(2);

    // Edit the food (newer change): the logged entry keeps its values.
    const edit = await put(a, `/api/nutrition/foods/${pastaId}`, { name: `Nudeln ${tag} Protein`, kcal: 400, proteinG: 30, carbsG: 45, fatG: 4, clientUpdatedAt: at(5) });
    expect(edit.json().status).toBe("applied");
    const stored = await app.prisma.mealEntry.findUniqueOrThrow({ where: { id: firstEntryId } });
    expect(stored.kcal).toBe(437.5);
    expect(stored.proteinG).toBe(31.25);

    // An older change from an offline device loses (last write wins).
    const stale = await put(a, `/api/nutrition/foods/${pastaId}`, { name: "alt", kcal: 1, clientUpdatedAt: at(1) });
    expect(stale.json().status).toBe("stale");
    expect(stale.json().food.per100.kcal).toBe(400);

    // Deleting the food keeps the history too.
    expect((await del(a, `/api/nutrition/foods/${pastaId}`)).statusCode).toBe(204);
    const day = await get(a, `/api/nutrition/meals?from=${today}&to=${today}`);
    const kept = (day.json().items[0].entries as { id: string; nutrients: { kcal: number } }[]).find((e) => e.id === firstEntryId);
    expect(kept!.nutrients.kcal).toBe(437.5);
  });

  it("other accounts cannot add to or delete a meal", async () => {
    const add = await post(b, `/api/nutrition/meals/${mealId}/entries`, { entries: [{ id: randomUUID(), name: "x", quantity: 1, unitLabel: "g", snapshot: { kcal: 1 } }] });
    expect(add.statusCode).toBe(404);
    expect((await del(b, `/api/nutrition/meals/${mealId}`)).statusCode).toBe(404);
  });

  let recipeId: string;

  it("calculates a recipe from raw ingredients over the final weight and stores a snapshot", async () => {
    const chicken = randomUUID();
    await put(a, `/api/nutrition/foods/${chicken}`, { name: `Hähnchen ${tag}`, kcal: 110, proteinG: 23.5, carbsG: 0, fatG: 1.5, clientUpdatedAt: at(0) });
    const pasta2 = randomUUID();
    await put(a, `/api/nutrition/foods/${pasta2}`, { name: `Proteinnudeln ${tag}`, kcal: 350, proteinG: 25, carbsG: 50, fatG: 3, clientUpdatedAt: at(0) });

    const body = {
      name: "Protein-Pasta",
      servings: 4,
      finalWeightG: 980,
      ingredients: [
        { foodId: pasta2, quantity: 250, unitLabel: "g" },
        { foodId: chicken, quantity: 400, unitLabel: "g" },
        { foodId: oilId, quantity: 10, unitLabel: "ml" },
      ],
    };
    const preview = await post(a, "/api/nutrition/recipes/calculate", body);
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ totalRawWeightG: 659.1, effectiveWeightG: 980, weightSource: "final", cookingChangePercent: 48.7 });
    expect(preview.json().ingredients[2].rawWeightG).toBe(9.1);

    recipeId = randomUUID();
    const saved = await put(a, `/api/nutrition/recipes/${recipeId}`, { ...body, clientUpdatedAt: at(0) });
    expect(saved.statusCode).toBe(200);
    const recipe = saved.json().recipe;
    // 875 + 440 + 81.809 kcal; 62.5 + 94 g protein
    expect(recipe.totals.kcal).toBe(1396.8);
    expect(recipe.totals.proteinG).toBe(156.5);
    expect(recipe.per100g.kcal).toBe(142.5);
    expect(recipe.servingWeightG).toBe(245);

    // Without a final weight the raw sum is the reference.
    const raw = await post(a, "/api/nutrition/recipes/calculate", { ...body, finalWeightG: null });
    expect(raw.json()).toMatchObject({ effectiveWeightG: 659.1, weightSource: "raw", cookingChangePercent: null });

    // Food edited later: the stored recipe does not move.
    await put(a, `/api/nutrition/foods/${chicken}`, { name: `Hähnchen ${tag}`, kcal: 200, proteinG: 20, clientUpdatedAt: at(5) });
    expect((await get(a, `/api/nutrition/recipes/${recipeId}`)).json().totals.kcal).toBe(1396.8);

    // A portion of the recipe in a meal: 1 Portion = 245 g = a quarter of the totals.
    const meal = await post(a, "/api/nutrition/meals", {
      id: randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      mealType: "DINNER",
      entries: [{ id: randomUUID(), recipeId, quantity: 1, unitLabel: "Portion" }],
    });
    expect(meal.json().entries[0]).toMatchObject({ name: "Protein-Pasta", grams: 245, nutrients: { kcal: 349.2, proteinG: 39.13 } });

    // Someone else's recipe is not usable.
    const foreign = await post(b, "/api/nutrition/meals", {
      id: randomUUID(),
      date: "2026-11-20",
      mealType: "DINNER",
      entries: [{ id: randomUUID(), recipeId, quantity: 100, unitLabel: "g" }],
    });
    expect(foreign.statusCode).toBe(400);
  });

  it("marks values per gram as estimated when the recipe weight is only an estimate", async () => {
    // Milk per 100 ml without density: its weight in the recipe is taken as 1 g/ml (estimate).
    const milk = randomUUID();
    await put(a, `/api/nutrition/foods/${milk}`, { name: `Milch ${tag}`, basis: "PER_100ML", kcal: 64, proteinG: 3.4, clientUpdatedAt: at(0) });
    const oats = randomUUID();
    await put(a, `/api/nutrition/foods/${oats}`, { name: `Flocken ${tag}`, kcal: 370, proteinG: 13, clientUpdatedAt: at(0) });
    const id = randomUUID();
    const saved = await put(a, `/api/nutrition/recipes/${id}`, {
      name: "Porridge",
      servings: 2,
      ingredients: [
        { foodId: oats, quantity: 80, unitLabel: "g" },
        { foodId: milk, quantity: 300, unitLabel: "ml" },
      ],
      clientUpdatedAt: at(0),
    });
    const recipe = saved.json().recipe;
    expect(recipe).toMatchObject({ totalRawWeightG: 380, weightSource: "raw", totalWeightEstimated: true, estimatedFields: [] });
    expect(recipe.ingredients.map((i: { weightEstimated: boolean }) => i.weightEstimated)).toEqual([false, true]);

    const meal = await post(a, "/api/nutrition/meals", {
      id: randomUUID(),
      date: "2026-11-19",
      mealType: "BREAKFAST",
      entries: [
        { id: randomUUID(), recipeId: id, quantity: 190, unitLabel: "g" },
        { id: randomUUID(), recipeId: id, quantity: 1, unitLabel: "Portion" },
      ],
    });
    const [byGram, byPortion] = meal.json().entries as { nutrients: { kcal: number }; estimatedFields: string[] }[];
    // 296 + 192 kcal in total; half of it either way, but only the portion is exact.
    expect(byGram!.nutrients.kcal).toBe(244);
    expect(byGram!.estimatedFields).toEqual(["kcal", "proteinG"]);
    expect(byPortion!.nutrients.kcal).toBe(244);
    expect(byPortion!.estimatedFields).toEqual([]);

    // With a weighed final weight the estimate no longer matters.
    const weighed = await put(a, `/api/nutrition/recipes/${id}`, { name: "Porridge", servings: 2, finalWeightG: 400, ingredients: [{ foodId: oats, quantity: 80, unitLabel: "g" }, { foodId: milk, quantity: 300, unitLabel: "ml" }], clientUpdatedAt: at(1) });
    expect(weighed.json().recipe.weightSource).toBe("final");
    const later = await post(a, "/api/nutrition/meals", { id: randomUUID(), date: "2026-11-19", mealType: "SNACK", entries: [{ id: randomUUID(), recipeId: id, quantity: 100, unitLabel: "g" }] });
    expect(later.json().entries[0]).toMatchObject({ nutrients: { kcal: 122 }, estimatedFields: [] });
  });

  it("keeps ratings append-only: a new one retires the old one", async () => {
    const first = randomUUID();
    expect((await put(a, "/api/nutrition/ratings/2026-11-20", { id: first, score: 4 })).statusCode).toBe(201);
    const second = randomUUID();
    expect((await put(a, "/api/nutrition/ratings/2026-11-20", { id: second, score: 9, note: "Doch gut" })).statusCode).toBe(201);
    expect((await put(a, "/api/nutrition/ratings/2026-11-20", { id: second, score: 9 })).statusCode).toBe(200);
    const list = await get(a, "/api/nutrition/ratings?from=2026-11-20&to=2026-11-20");
    expect(list.json().items).toEqual([expect.objectContaining({ id: second, score: 9 })]);
    const old = await app.prisma.dailyNutritionRating.findUniqueOrThrow({ where: { id: first } });
    expect(old.deletedAt).not.toBeNull();
    expect((await put(a, "/api/nutrition/ratings/2026-11-20", { id: randomUUID(), score: 11 })).statusCode).toBe(400);
  });

  it("reads the targets from the Fitnesstracker profile and splits the rest", async () => {
    const none = await get(b, "/api/nutrition/targets/today");
    expect(none.json()).toMatchObject({ profileComplete: false, targetCalories: null });

    await put(a, "/api/profile", { weightKg: 80, heightCm: 180, age: 30, gender: "MALE", activityLevel: "MODERATE", goal: "MAINTAIN" });
    const res = await get(a, "/api/nutrition/targets/today");
    expect(res.json()).toMatchObject({
      profileComplete: true,
      source: "fitnesstracker",
      bmr: 1780,
      tdee: 2759,
      targetCalories: 2759,
      targetProteinG: 144,
      nutritionPhase: "MAINTAIN",
      macros: { proteinG: 144, fatG: 97, carbsG: 327, fatPercentOfRemaining: 40 },
    });
    expect(res.json().consumed.entries).toBeGreaterThan(0);

    expect((await put(a, "/api/nutrition/settings", { fatPercentOfRemaining: 25 })).json()).toEqual({ fatPercentOfRemaining: 25 });
    expect((await get(a, "/api/nutrition/targets/today")).json().macros).toMatchObject({ fatG: 61, carbsG: 409 });
  });

  it("syncs: pushes an offline batch idempotently and pulls deltas with tombstones", async () => {
    const since = new Date().toISOString();
    const foodId = randomUUID();
    const logId = randomUUID();
    const entryId = randomUUID();
    const batch = {
      foods: [{ id: foodId, name: `Offline-Quark ${tag}`, kcal: 67, proteinG: 12, clientUpdatedAt: at(0) }],
      mealLogs: [
        {
          id: logId,
          date: "2026-11-21",
          mealType: "SNACK",
          // Snapshot taken offline on the device: stored as sent.
          entries: [{ id: entryId, foodId, quantity: 250, unitLabel: "g", snapshot: { kcal: 167.5, proteinG: 30, grams: 250 } }],
        },
      ],
      ratings: [{ id: randomUUID(), date: "2026-11-21", score: 7 }],
      deletions: { mealLogs: [mealId], foods: [blsPastaId] },
    };
    const push = await post(a, "/api/nutrition/sync", batch);
    expect(push.statusCode).toBe(200);
    const results = push.json().results as { kind: string; id: string; status: string }[];
    expect(results.find((r) => r.id === foodId)!.status).toBe("applied");
    expect(results.find((r) => r.id === logId)!.status).toBe("applied");
    expect(results.find((r) => r.id === mealId)!.status).toBe("applied");
    // BLS foods cannot be deleted: rejected, the rest of the batch went through.
    expect(results.find((r) => r.id === blsPastaId)!.status).toBe("rejected");

    const again = await post(a, "/api/nutrition/sync", { ...batch, deletions: {} });
    expect(again.statusCode).toBe(200);
    expect(await app.prisma.mealEntry.count({ where: { mealLogId: logId } })).toBe(1);

    const pull = await get(a, `/api/nutrition/sync?updatedSince=${encodeURIComponent(since)}`);
    const body = pull.json();
    expect(body.foods.map((f: { id: string }) => f.id)).toContain(foodId);
    expect(body.mealEntries.find((e: { id: string }) => e.id === entryId).nutrients.kcal).toBe(167.5);
    expect(body.deleted.mealLogs).toContain(mealId);
    expect(body.deleted.mealEntries).toContain(firstEntryId);
    expect(typeof body.serverTime).toBe("string");

    const other = await get(b, `/api/nutrition/sync?updatedSince=${encodeURIComponent(since)}`);
    expect(other.json().mealLogs).toEqual([]);
    expect(other.json().foods).toEqual([]);
  });

  it("exports the range from the snapshots in every format", async () => {
    const json = await get(a, "/api/nutrition/export?from=2026-11-20&to=2026-11-21&format=json");
    expect(json.statusCode).toBe(200);
    const report = json.json();
    expect(report.days).toHaveLength(2);
    expect(report.days[1]).toMatchObject({ date: "2026-11-21", logged: true, totals: { kcal: 167.5 }, rating: { score: 7 } });
    expect(report.days[0].rating.score).toBe(9);

    const csv = await get(a, "/api/nutrition/export?from=2026-11-20&to=2026-11-21&format=csv");
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.body).toContain("2026-11-21;167.5;30;");
    const md = await get(a, "/api/nutrition/export?days=7&format=md");
    expect(md.body).toContain("# Ernährungsbericht");
    const pdf = await get(a, "/api/nutrition/export?days=14&format=pdf");
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await get(a, "/api/nutrition/export?days=5")).statusCode).toBe(400);
    expect((await get(b, "/api/nutrition/export?from=2026-11-20&to=2026-11-21")).json().averages.loggedDays).toBe(0);
  });
});
