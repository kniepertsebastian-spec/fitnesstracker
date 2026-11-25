import type { NutritionWeeklyDrop, Prisma, PrismaClient } from "@prisma/client";
import { loadFoodsForCalc, type CalcFood } from "../foods/food.service.js";
import { calculateRecipe, roundNutrients, type NutrientValues } from "../nutrition/nutrients.js";
import { WEEKLY_DROP_CATALOG, type CatalogRecipe } from "./weeklyDrops.catalog.js";

// Weekly drops (Roadmap 04, P2): every Sunday morning 3-5 high-protein dishes from the catalog.
// A dish offered in the last REPEAT_LOCK_WEEKS weeks is not offered again (soft: if too few are
// left, older ones come back). The nutrients per serving come from the BLS foods in the database
// (raw weights, one serving), so a drop is only offered when every ingredient was found and it
// lands at >= MIN_PROTEIN_G protein and <= MAX_KCAL kcal.

export const DROPS_PER_WEEK = 4;
export const MIN_DROPS = 3;
export const REPEAT_LOCK_WEEKS = 7;
export const MIN_PROTEIN_G = 30;
export const MAX_KCAL = 600;
export const DROP_TIME_ZONE = "Europe/Berlin";
export const DROP_HOUR = 6;

const DAY_MS = 24 * 3600 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The Sunday (YYYY-MM-DD) whose 06:00 drop is the current one in Berlin at `now`. */
export function dropWeekStart(now: Date, timeZone = DROP_TIME_ZONE): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = WEEKDAYS.indexOf(parts.weekday!);
  const hour = Number(parts.hour);
  const back = weekday === 0 && hour < DROP_HOUR ? 7 : weekday;
  const localDate = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  return new Date(localDate - back * DAY_MS).toISOString().slice(0, 10);
}

const addDays = (isoDate: string, days: number) => new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

// FNV-1a: a stable order per week, the same on every instance and after a restart.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Picks the week's dishes: not recently offered first, in a per-week order, only eligible ones. */
export function pickDrops(catalog: readonly CatalogRecipe[], weekStart: string, recentKeys: ReadonlySet<string>, eligible: (key: string) => boolean, count = DROPS_PER_WEEK): CatalogRecipe[] {
  const order = (r: CatalogRecipe) => hash(`${weekStart}:${r.key}`);
  const sorted = [...catalog].sort((a, b) => order(a) - order(b) || a.key.localeCompare(b.key));
  const fresh = sorted.filter((r) => !recentKeys.has(r.key) && eligible(r.key));
  const picked = fresh.slice(0, count);
  if (picked.length < MIN_DROPS) {
    for (const r of sorted) {
      if (picked.length >= MIN_DROPS) break;
      if (recentKeys.has(r.key) && eligible(r.key)) picked.push(r);
    }
  }
  return picked;
}

export interface ComputedDrop {
  recipe: CatalogRecipe;
  ingredients: { foodId: string; bls: string; name: string; grams: number }[];
  perServing: NutrientValues;
  missing: string[];
  qualifies: boolean;
}

/** Nutrients for one serving from the foods found by BLS code. */
export function computeCatalogRecipe(recipe: CatalogRecipe, foodsByCode: ReadonlyMap<string, CalcFood>): ComputedDrop {
  const missing = recipe.ingredients.filter((i) => !foodsByCode.has(i.bls)).map((i) => i.name);
  const found = recipe.ingredients.filter((i) => foodsByCode.has(i.bls));
  const result = calculateRecipe(
    found.map((i) => ({ name: i.name, quantity: i.grams, unitLabel: "g", food: foodsByCode.get(i.bls)! })),
    { servings: 1 },
  );
  const perServing = roundNutrients(result.perServing ?? result.totals);
  const { kcal, proteinG } = perServing.values;
  return {
    recipe,
    ingredients: found.map((i) => ({ foodId: foodsByCode.get(i.bls)!.id, bls: i.bls, name: i.name, grams: i.grams })),
    perServing,
    missing,
    qualifies: missing.length === 0 && kcal !== null && proteinG !== null && proteinG >= MIN_PROTEIN_G && kcal <= MAX_KCAL,
  };
}

async function catalogFoods(prisma: PrismaClient): Promise<Map<string, CalcFood>> {
  const codes = [...new Set(WEEKLY_DROP_CATALOG.flatMap((r) => r.ingredients.map((i) => i.bls)))];
  const rows = await prisma.food.findMany({ where: { source: "BLS", sourceRef: { in: codes }, deletedAt: null }, select: { id: true, sourceRef: true } });
  // BLS foods are shared (no owner); the empty user id only selects shared measures.
  const foods = await loadFoodsForCalc(prisma, "", rows.map((r) => r.id));
  const byCode = new Map<string, CalcFood>();
  for (const row of rows) {
    const food = foods.get(row.id);
    if (food && row.sourceRef) byCode.set(row.sourceRef, food);
  }
  return byCode;
}

/** Creates the drops of the current week if they don't exist yet. Returns the week and how many were created. */
export async function ensureWeeklyDrops(prisma: PrismaClient, now = new Date()): Promise<{ weekStart: string; created: number }> {
  const weekStart = dropWeekStart(now);
  const weekDate = new Date(`${weekStart}T00:00:00Z`);
  if ((await prisma.nutritionWeeklyDrop.count({ where: { weekStart: weekDate } })) > 0) return { weekStart, created: 0 };

  const recent = await prisma.nutritionWeeklyDrop.findMany({
    where: { weekStart: { gte: new Date(`${addDays(weekStart, -7 * REPEAT_LOCK_WEEKS)}T00:00:00Z`), lt: weekDate } },
    select: { catalogKey: true },
  });
  const foods = await catalogFoods(prisma);
  const computed = new Map(WEEKLY_DROP_CATALOG.map((r) => [r.key, computeCatalogRecipe(r, foods)]));
  const picked = pickDrops(WEEKLY_DROP_CATALOG, weekStart, new Set(recent.map((r) => r.catalogKey)), (key) => computed.get(key)!.qualifies);
  if (picked.length === 0) return { weekStart, created: 0 };

  const { count } = await prisma.nutritionWeeklyDrop.createMany({
    data: picked.map((recipe, position) => {
      const drop = computed.get(recipe.key)!;
      return {
        weekStart: weekDate,
        position,
        catalogKey: recipe.key,
        name: recipe.name,
        servings: 1,
        ingredients: drop.ingredients as unknown as Prisma.InputJsonValue,
        steps: recipe.steps,
        tags: recipe.tags,
        kcal: drop.perServing.values.kcal,
        proteinG: drop.perServing.values.proteinG,
        perServing: drop.perServing.values as unknown as Prisma.InputJsonValue,
        estimatedFields: drop.perServing.estimated,
      };
    }),
    // Two instances at once: the unique (weekStart, position) keeps one set.
    skipDuplicates: true,
  });
  return { weekStart, created: count };
}

export function toDropDto(row: NutritionWeeklyDrop) {
  return {
    id: row.id,
    weekStart: row.weekStart.toISOString().slice(0, 10),
    position: row.position,
    catalogKey: row.catalogKey,
    name: row.name,
    servings: row.servings,
    ingredients: row.ingredients as unknown as ComputedDrop["ingredients"],
    steps: row.steps,
    tags: row.tags,
    kcal: row.kcal,
    proteinG: row.proteinG,
    perServing: row.perServing as unknown as NutrientValues["values"],
    estimatedFields: row.estimatedFields,
  };
}
export type WeeklyDropDto = ReturnType<typeof toDropDto>;

/** The current week's drops; with maxKcal only those that still fit (the rest is counted). */
export async function listWeeklyDrops(prisma: PrismaClient, options: { maxKcal?: number; now?: Date } = {}) {
  const { weekStart } = await ensureWeeklyDrops(prisma, options.now);
  const rows = await prisma.nutritionWeeklyDrop.findMany({ where: { weekStart: new Date(`${weekStart}T00:00:00Z`) }, orderBy: { position: "asc" } });
  const all = rows.map(toDropDto);
  const max = options.maxKcal;
  const drops = max === undefined ? all : all.filter((d) => d.kcal !== null && d.kcal <= max);
  return { weekStart, nextDropAt: addDays(weekStart, 7), drops, hiddenCount: all.length - drops.length };
}
