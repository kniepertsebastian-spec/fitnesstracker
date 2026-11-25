import { Prisma, type Food, type FoodUnit, type PrismaClient } from "@prisma/client";
import type { UpsertFoodInput, UpsertFoodUnitInput } from "@fitnesstracker/shared";
import { ForbiddenError, NotFoundError } from "../../errors/httpErrors.js";
import {
  NUTRIENT_KEYS,
  nutrientStatus,
  onlyNutrientKeys,
  type FoodForAmount,
  type NutrientValues,
  type Nutrients,
} from "../nutrition/nutrients.js";
import { BLS_ATTRIBUTION } from "./blsImport.js";
import { OFF_ATTRIBUTION, type OffFetcher } from "./openFoodFacts.js";

// The food layers: 1. the user's own foods (USER), 2. BLS 4.0 (shared, imported), 3. Open Food
// Facts (shared, cached on first lookup). Shared rows have userId null; nobody edits them through
// the API, but anybody may add their own household measures (FoodUnit with userId) to them.

export type WriteStatus = "applied" | "stale";

type FoodWithUnits = Food & { units: FoodUnit[] };

export function foodNutrients(food: Pick<Food, NutrientKeyField | "estimatedFields">): NutrientValues {
  const values = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) values[key] = food[key];
  return { values, estimated: onlyNutrientKeys(food.estimatedFields) };
}
type NutrientKeyField = (typeof NUTRIENT_KEYS)[number];

// Measures of a food the user may use: the shared ones and their own.
const visibleUnits = (userId: string) => ({ where: { deletedAt: null, OR: [{ userId: null }, { userId }] }, orderBy: { label: "asc" as const } });

export function toFoodDto(food: FoodWithUnits, userId: string) {
  const per100 = foodNutrients(food);
  return {
    id: food.id,
    source: food.source,
    sourceRef: food.sourceRef,
    own: food.userId === userId,
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    basis: food.basis,
    densityGPerMl: food.densityGPerMl,
    per100: per100.values,
    estimatedFields: per100.estimated,
    status: nutrientStatus(per100.values, per100.estimated),
    micronutrients: food.micronutrients ?? null,
    // Required by the licences (BLS: CC BY 4.0, Open Food Facts: ODbL); the app shows it with the food.
    attribution: food.source === "BLS" ? BLS_ATTRIBUTION : food.source === "OFF" ? OFF_ATTRIBUTION : null,
    units: food.units
      .filter((u) => !u.deletedAt && (u.userId === null || u.userId === userId))
      .map((u) => ({ id: u.id, label: u.label, baseAmount: u.baseAmount, own: u.userId === userId, updatedAt: u.updatedAt.toISOString() })),
    clientUpdatedAt: food.clientUpdatedAt?.toISOString() ?? null,
    updatedAt: food.updatedAt.toISOString(),
    deletedAt: food.deletedAt?.toISOString() ?? null,
  };
}
export type FoodDto = ReturnType<typeof toFoodDto>;

export function toFoodUnitDto(unit: FoodUnit) {
  return {
    id: unit.id,
    foodId: unit.foodId,
    label: unit.label,
    baseAmount: unit.baseAmount,
    clientUpdatedAt: unit.clientUpdatedAt?.toISOString() ?? null,
    updatedAt: unit.updatedAt.toISOString(),
    deletedAt: unit.deletedAt?.toISOString() ?? null,
  };
}

const LAYER_BONUS = Prisma.sql`CASE f."source" WHEN 'USER' THEN 0.3 WHEN 'BLS' THEN 0.1 ELSE 0 END`;

function escapeLike(q: string) {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Everyday words the BLS names differently ("Teigwaren", "Hühnerei"). Applied only when the whole
// query is the word, as an extra search term next to the query itself.
const SEARCH_SYNONYMS: Record<string, string> = {
  ei: "Hühnerei",
  eier: "Hühnerei",
  nudeln: "Teigwaren",
  pasta: "Teigwaren",
  spaghetti: "Teigwaren",
  hühnerbrust: "Hähnchen Brustfilet",
};

export function searchTerms(q: string): string[] {
  const term = q.trim().replace(/\s+/g, " ");
  const synonym = SEARCH_SYNONYMS[term.toLowerCase()];
  return synonym ? [term, synonym] : [term];
}

// How well one term fits a food:
// - word similarity of the term in name or brand (typo-tolerant, "Haferfl" -> "Haferflocken"),
// - plus the similarity to the head of the name, the part before the first comma, ignoring spaces.
//   BLS names are "<food> <state>, <preparation>" and partly split words ("Hafer Flocken"), so
//   "Haferflocken" ranks "Hafer Flocken" above "Haferflocken gesüßt, mit Milch ...",
// - plus a bonus when the name starts with the term (again ignoring spaces).
function termScore(term: string) {
  const compact = term.replace(/\s+/g, "");
  return Prisma.sql`(GREATEST(word_similarity(${term}, f."name"), COALESCE(word_similarity(${term}, f."brand"), 0) * 0.8)
    + similarity(${compact}, split_part(replace(f."name", ' ', ''), ',', 1))
    + CASE WHEN replace(f."name", ' ', '') ILIKE ${`${escapeLike(compact)}%`} THEN 0.3 ELSE 0 END)`;
}

function termMatches(term: string) {
  const pattern = `%${escapeLike(term)}%`;
  const compactPattern = `%${escapeLike(term.replace(/\s+/g, ""))}%`;
  return Prisma.sql`(f."name" ILIKE ${pattern} OR ${term} <% f."name" OR replace(f."name", ' ', '') ILIKE ${compactPattern}
    OR f."brand" ILIKE ${pattern} OR ${term} <% f."brand")`;
}

// Fuzzy search over name and brand (pg_trgm, GIN index). Ranking: the best term score (see above)
// plus a layer bonus so the user's own food beats BLS, BLS beats OFF at a similar match; at equal
// scores the shorter, more basic name first.
export async function searchFoods(prisma: PrismaClient, userId: string, q: string, limit: number): Promise<FoodDto[]> {
  const terms = searchTerms(q);
  const score = terms.length === 1 ? termScore(terms[0]!) : Prisma.sql`GREATEST(${Prisma.join(terms.map(termScore))})`;
  const matches = Prisma.join(terms.map(termMatches), " OR ");
  const ranked = await prisma.$transaction(async (tx) => {
    // Lower than the default 0.6, so typos still match ("Brokoli" -> "Broccoli roh" is 0.42); the
    // ranking keeps the weaker hits at the end. Local to the transaction.
    await tx.$queryRaw`SELECT set_config('pg_trgm.word_similarity_threshold', '0.4', true)`;
    return tx.$queryRaw<{ id: string; score: number }[]>`
      SELECT f."id", ${score} + ${LAYER_BONUS} AS score
      FROM "Food" f
      WHERE f."deletedAt" IS NULL
        AND (f."userId" = ${userId} OR f."userId" IS NULL)
        AND (${matches})
      ORDER BY score DESC, length(f."name") ASC
      LIMIT ${limit}`;
  });
  if (ranked.length === 0) return [];
  const foods = await prisma.food.findMany({ where: { id: { in: ranked.map((r) => r.id) } }, include: { units: visibleUnits(userId) } });
  const byId = new Map(foods.map((f) => [f.id, f]));
  return ranked.flatMap((r) => {
    const food = byId.get(r.id);
    return food ? [toFoodDto(food, userId)] : [];
  });
}

async function findVisibleFood(prisma: PrismaClient, userId: string, id: string) {
  const food = await prisma.food.findUnique({ where: { id }, include: { units: visibleUnits(userId) } });
  if (!food || food.deletedAt || (food.userId !== null && food.userId !== userId)) return null;
  return food;
}

export async function getFood(prisma: PrismaClient, userId: string, id: string): Promise<FoodDto> {
  const food = await findVisibleFood(prisma, userId, id);
  if (!food) throw new NotFoundError("Lebensmittel nicht gefunden");
  return toFoodDto(food, userId);
}

// Barcode: the user's own product first, then the OFF cache, then OFF live (and cached for good).
export async function findFoodByBarcode(prisma: PrismaClient, userId: string, barcode: string, fetchOff: OffFetcher): Promise<FoodDto | null> {
  const own = await prisma.food.findFirst({
    where: { userId, barcode, deletedAt: null },
    include: { units: visibleUnits(userId) },
    orderBy: { updatedAt: "desc" },
  });
  if (own) return toFoodDto(own, userId);

  const cached = await prisma.food.findUnique({ where: { source_sourceRef: { source: "OFF", sourceRef: barcode } }, include: { units: visibleUnits(userId) } });
  if (cached) return cached.deletedAt ? null : toFoodDto(cached, userId);

  const product = await fetchOff(barcode);
  if (!product) return null;
  const data = {
    name: product.name,
    brand: product.brand,
    barcode,
    basis: product.basis,
    ...product.nutrients.values,
    estimatedFields: product.nutrients.estimated,
    fetchedAt: new Date(),
  };
  // Upsert: two users scanning the same new product at once must not trip the unique key.
  const food = await prisma.food.upsert({
    where: { source_sourceRef: { source: "OFF", sourceRef: barcode } },
    create: { ...data, source: "OFF", sourceRef: barcode, units: { create: product.units } },
    update: {},
    include: { units: visibleUnits(userId) },
  });
  return toFoodDto(food, userId);
}

function foodData(input: UpsertFoodInput) {
  return {
    name: input.name,
    brand: input.brand ?? null,
    barcode: input.barcode ?? null,
    basis: input.basis,
    densityGPerMl: input.densityGPerMl ?? null,
    kcal: input.kcal,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
    fiberG: input.fiberG,
    sugarG: input.sugarG,
    saturatedFatG: input.saturatedFatG,
    saltG: input.saltG,
    // Only keys that have a value can be estimated; a null value is "unknown" anyway.
    estimatedFields: onlyNutrientKeys(input.estimatedFields).filter((k) => input[k] !== null),
    clientUpdatedAt: new Date(input.clientUpdatedAt),
  };
}

// Creates or replaces the user's own food. Last write wins by clientUpdatedAt: an older change
// from a device that was offline for a while does not overwrite a newer one. Editing never touches
// meals already logged with this food: they carry their own snapshot.
export async function upsertFood(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpsertFoodInput,
): Promise<{ status: WriteStatus; food: FoodDto }> {
  const existing = await prisma.food.findUnique({ where: { id }, include: { units: visibleUnits(userId) } });
  if (existing && existing.userId !== userId) throw new ForbiddenError("Dieses Lebensmittel lässt sich nicht bearbeiten");
  if (existing && (existing.deletedAt || (existing.clientUpdatedAt && existing.clientUpdatedAt > new Date(input.clientUpdatedAt)))) {
    return { status: "stale", food: toFoodDto(existing, userId) };
  }

  const data = foodData(input);
  await prisma.$transaction(async (tx) => {
    if (existing) await tx.food.update({ where: { id }, data });
    else await tx.food.create({ data: { ...data, id, userId, source: "USER" } });

    if (input.units) {
      // The list replaces the user's measures of this food.
      const keep = input.units.map((u) => u.id);
      const foreign = await tx.foodUnit.findFirst({ where: { id: { in: keep }, NOT: { userId, foodId: id } } });
      if (foreign) throw new ForbiddenError("Diese Einheit gehört zu einem anderen Lebensmittel");
      await tx.foodUnit.updateMany({ where: { foodId: id, userId, deletedAt: null, id: { notIn: keep } }, data: { deletedAt: new Date() } });
      for (const unit of input.units) {
        await tx.foodUnit.upsert({
          where: { id: unit.id },
          create: { id: unit.id, foodId: id, userId, label: unit.label, baseAmount: unit.baseAmount, clientUpdatedAt: data.clientUpdatedAt },
          update: { label: unit.label, baseAmount: unit.baseAmount, clientUpdatedAt: data.clientUpdatedAt, deletedAt: null },
        });
      }
    }
  });

  const food = await prisma.food.findUniqueOrThrow({ where: { id }, include: { units: visibleUnits(userId) } });
  return { status: "applied", food: toFoodDto(food, userId) };
}

export async function deleteFood(prisma: PrismaClient, userId: string, id: string): Promise<void> {
  const food = await prisma.food.findUnique({ where: { id } });
  if (!food || (food.userId !== null && food.userId !== userId)) throw new NotFoundError("Lebensmittel nicht gefunden");
  if (food.userId === null) throw new ForbiddenError("Lebensmittel aus BLS oder Open Food Facts lassen sich nicht löschen");
  if (food.deletedAt) return;
  const now = new Date();
  await prisma.$transaction([
    prisma.food.update({ where: { id }, data: { deletedAt: now } }),
    prisma.foodUnit.updateMany({ where: { foodId: id, userId, deletedAt: null }, data: { deletedAt: now } }),
  ]);
}

// A household measure of the user for any food they can see ("1 Stück = 150 g").
export async function upsertFoodUnit(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpsertFoodUnitInput,
): Promise<{ status: WriteStatus; unit: ReturnType<typeof toFoodUnitDto> }> {
  const food = await findVisibleFood(prisma, userId, input.foodId);
  if (!food) throw new NotFoundError("Lebensmittel nicht gefunden");
  const existing = await prisma.foodUnit.findUnique({ where: { id } });
  if (existing && (existing.userId !== userId || existing.foodId !== input.foodId)) throw new ForbiddenError("Diese Einheit lässt sich nicht bearbeiten");
  const clientUpdatedAt = new Date(input.clientUpdatedAt);
  if (existing && (existing.deletedAt || (existing.clientUpdatedAt && existing.clientUpdatedAt > clientUpdatedAt))) {
    return { status: "stale", unit: toFoodUnitDto(existing) };
  }
  const unit = await prisma.foodUnit.upsert({
    where: { id },
    create: { id, foodId: input.foodId, userId, label: input.label, baseAmount: input.baseAmount, clientUpdatedAt },
    update: { label: input.label, baseAmount: input.baseAmount, clientUpdatedAt },
  });
  return { status: "applied", unit: toFoodUnitDto(unit) };
}

export async function deleteFoodUnit(prisma: PrismaClient, userId: string, id: string): Promise<void> {
  const unit = await prisma.foodUnit.findUnique({ where: { id } });
  if (!unit || unit.userId !== userId) throw new NotFoundError("Einheit nicht gefunden");
  if (!unit.deletedAt) await prisma.foodUnit.update({ where: { id }, data: { deletedAt: new Date() } });
}

export type CalcFood = FoodForAmount & { id: string; name: string; brand: string | null; per100: NutrientValues };

// Foods for a calculation (recipe, meal entry), with the measures the user may use. Foods the user
// cannot see are missing from the map. A deleted own food still calculates when `includeDeleted`.
export async function loadFoodsForCalc(prisma: PrismaClient, userId: string, ids: string[], includeDeleted = false): Promise<Map<string, CalcFood>> {
  if (ids.length === 0) return new Map();
  const foods = await prisma.food.findMany({
    where: { id: { in: [...new Set(ids)] }, OR: [{ userId: null }, { userId }], ...(includeDeleted ? {} : { deletedAt: null }) },
    include: { units: visibleUnits(userId) },
  });
  return new Map(
    foods.map((f) => [
      f.id,
      {
        id: f.id,
        name: f.name,
        brand: f.brand,
        basis: f.basis,
        densityGPerMl: f.densityGPerMl,
        // The user's own measure wins over a shared one with the same label.
        units: [...f.units]
          .sort((a, b) => Number(a.userId !== userId) - Number(b.userId !== userId))
          .map((u) => ({ label: u.label, baseAmount: u.baseAmount })),
        per100: foodNutrients(f),
      },
    ]),
  );
}
