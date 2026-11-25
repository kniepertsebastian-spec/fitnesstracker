import type { DailyNutritionRating, MealEntry, MealLog, PrismaClient } from "@prisma/client";
import type { CreateMealLogInput, MealEntryInput, SetRatingInput } from "@fitnesstracker/shared";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../errors/httpErrors.js";
import { loadFoodsForCalc, type CalcFood } from "../foods/food.service.js";
import { recipeEffectiveWeight, recipeTotals, recipeWeightIsEstimate } from "../recipes/recipe.service.js";
import {
  NUTRIENT_KEYS,
  multiplyNutrients,
  nutrientStatus,
  onlyNutrientKeys,
  resolveAmount,
  roundNutrients,
  roundTo,
  scaleNutrients,
  UnitConversionError,
  type NutrientValues,
  type Nutrients,
} from "../nutrition/nutrients.js";

// Meal logs are append-only: a logged entry is a snapshot of what was eaten, with the nutrients as
// they were at that moment. A later edit of the food or recipe never changes it. Correcting an
// entry means deleting it (soft, synced as a tombstone) and logging a new one.

export const dateFromKey = (date: string) => new Date(`${date}T00:00:00.000Z`);
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);

type LogWithEntries = MealLog & { entries: MealEntry[] };

export function entryNutrients(entry: Pick<MealEntry, (typeof NUTRIENT_KEYS)[number] | "estimatedFields">): NutrientValues {
  const values = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) values[key] = entry[key];
  return { values, estimated: onlyNutrientKeys(entry.estimatedFields) };
}

export function toMealEntryDto(entry: MealEntry) {
  const n = entryNutrients(entry);
  return {
    id: entry.id,
    mealLogId: entry.mealLogId,
    foodId: entry.foodId,
    recipeId: entry.recipeId,
    name: entry.name,
    brand: entry.brand,
    quantity: entry.quantity,
    unitLabel: entry.unitLabel,
    grams: entry.grams,
    nutrients: n.values,
    estimatedFields: n.estimated,
    status: nutrientStatus(n.values, n.estimated),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    deletedAt: entry.deletedAt?.toISOString() ?? null,
  };
}

export function toMealLogDto(log: MealLog, entries?: MealEntry[]) {
  return {
    id: log.id,
    date: dateKey(log.date),
    mealType: log.mealType,
    eatenAt: log.eatenAt?.toISOString() ?? null,
    note: log.note,
    ...(entries ? { entries: entries.filter((e) => !e.deletedAt).map(toMealEntryDto) } : {}),
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
    deletedAt: log.deletedAt?.toISOString() ?? null,
  };
}

interface EntrySnapshot {
  name: string;
  brand: string | null;
  baseAmount: number;
  grams: number | null;
  nutrients: NutrientValues;
}

function snapshotFromFood(food: CalcFood, entry: MealEntryInput): EntrySnapshot {
  try {
    const { baseAmount, grams } = resolveAmount(food, entry.quantity, entry.unitLabel);
    return { name: food.name, brand: food.brand, baseAmount, grams, nutrients: scaleNutrients(food.per100, baseAmount) };
  } catch (error) {
    if (error instanceof UnitConversionError) throw new BadRequestError(error.message);
    throw error;
  }
}

const PORTION_LABELS = new Set(["portion", "portionen"]);

async function snapshotFromRecipe(prisma: PrismaClient, userId: string, recipeId: string, entry: MealEntryInput): Promise<EntrySnapshot> {
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, userId } });
  if (!recipe) throw new BadRequestError("Rezept nicht gefunden");
  const totals = recipeTotals(recipe);
  const weight = recipeEffectiveWeight(recipe);
  const label = entry.unitLabel.trim().toLowerCase();
  let grams: number;
  let nutrients: NutrientValues;
  if (PORTION_LABELS.has(label)) {
    if (!recipe.servings || recipe.servings <= 0) throw new BadRequestError("Das Rezept hat keine Portionenzahl, bitte in Gramm angeben");
    nutrients = multiplyNutrients(totals, entry.quantity / recipe.servings);
    grams = (weight * entry.quantity) / recipe.servings;
  } else if (label === "g") {
    if (!(weight > 0)) throw new BadRequestError("Das Rezept hat kein Gewicht, bitte in Portionen angeben");
    nutrients = multiplyNutrients(totals, entry.quantity / weight);
    grams = entry.quantity;
    // Grams of a recipe whose weight is itself estimated: every value is an estimate.
    if (recipeWeightIsEstimate(recipe)) nutrients = { ...nutrients, estimated: NUTRIENT_KEYS.filter((k) => nutrients.values[k] !== null) };
  } else {
    throw new BadRequestError(`Rezepte lassen sich nur in g oder Portionen eintragen, nicht in „${entry.unitLabel}“`);
  }
  return { name: recipe.name, brand: null, baseAmount: grams, grams, nutrients };
}

// The snapshot for a new entry. A snapshot sent by the client (offline, from its own copy) is
// kept as sent; otherwise the server takes it from the food or recipe as it is now.
async function buildEntry(prisma: PrismaClient, userId: string, mealLogId: string, entry: MealEntryInput, foods: Map<string, CalcFood>) {
  let snap: EntrySnapshot;
  if (entry.snapshot) {
    const { grams, estimatedFields, ...values } = entry.snapshot;
    const fallbackName = entry.foodId ? foods.get(entry.foodId)?.name : undefined;
    const name = entry.name ?? fallbackName;
    if (!name) throw new BadRequestError("Eintrag ohne Namen");
    snap = {
      name,
      brand: entry.brand ?? null,
      baseAmount: grams ?? entry.quantity,
      grams,
      nutrients: { values: values as Nutrients, estimated: onlyNutrientKeys(estimatedFields).filter((k) => values[k] !== null) },
    };
  } else if (entry.foodId) {
    const food = foods.get(entry.foodId);
    if (!food) throw new BadRequestError("Lebensmittel nicht gefunden");
    snap = snapshotFromFood(food, entry);
  } else if (entry.recipeId) {
    snap = await snapshotFromRecipe(prisma, userId, entry.recipeId, entry);
  } else {
    throw new BadRequestError("Ein freier Eintrag braucht Name und Nährwerte");
  }
  const n = roundNutrients(snap.nutrients);
  // Only reference foods the user can see; a free entry has no reference at all.
  const foodId = entry.foodId && foods.has(entry.foodId) ? entry.foodId : null;
  const recipeId = entry.recipeId && !entry.foodId ? entry.recipeId : null;
  return {
    id: entry.id,
    userId,
    mealLogId,
    foodId,
    recipeId,
    name: entry.name ?? snap.name,
    brand: entry.brand ?? snap.brand,
    quantity: entry.quantity,
    unitLabel: entry.unitLabel,
    baseAmount: roundTo(snap.baseAmount, 3),
    grams: snap.grams === null ? null : roundTo(snap.grams, 1),
    ...n.values,
    estimatedFields: n.estimated,
  };
}

// Adds entries that are not there yet. Repeating a request (same entry ids) adds nothing.
async function appendEntries(prisma: PrismaClient, userId: string, mealLogId: string, entries: MealEntryInput[]) {
  if (entries.length === 0) return;
  const existing = await prisma.mealEntry.findMany({ where: { id: { in: entries.map((e) => e.id) } }, select: { id: true, userId: true, mealLogId: true } });
  if (existing.some((e) => e.userId !== userId || e.mealLogId !== mealLogId)) throw new ForbiddenError("Eintrag gehört zu einer anderen Mahlzeit");
  const known = new Set(existing.map((e) => e.id));
  const fresh = entries.filter((e) => !known.has(e.id));
  if (fresh.length === 0) return;
  const foodIds = fresh.flatMap((e) => (e.foodId ? [e.foodId] : []));
  // A food deleted since the client logged it offline still yields its snapshot.
  const foods = await loadFoodsForCalc(prisma, userId, foodIds, true);
  const rows = [];
  for (const entry of fresh) rows.push(await buildEntry(prisma, userId, mealLogId, entry, foods));
  await prisma.mealEntry.createMany({ data: rows, skipDuplicates: true });
}

export async function createMealLog(prisma: PrismaClient, userId: string, input: CreateMealLogInput): Promise<{ created: boolean; log: ReturnType<typeof toMealLogDto> }> {
  const existing = await prisma.mealLog.findUnique({ where: { id: input.id } });
  if (existing && existing.userId !== userId) throw new ForbiddenError("Diese Mahlzeit gehört zu einem anderen Konto");
  if (existing?.deletedAt) throw new BadRequestError("Diese Mahlzeit wurde gelöscht");
  if (!existing) {
    await prisma.mealLog.create({
      data: {
        id: input.id,
        userId,
        date: dateFromKey(input.date),
        mealType: input.mealType,
        eatenAt: input.eatenAt ? new Date(input.eatenAt) : null,
        note: input.note ?? null,
      },
    });
  }
  await appendEntries(prisma, userId, input.id, input.entries);
  const log = await prisma.mealLog.findUniqueOrThrow({ where: { id: input.id }, include: { entries: { orderBy: { createdAt: "asc" } } } });
  return { created: !existing, log: toMealLogDto(log, log.entries) };
}

export async function addMealEntries(prisma: PrismaClient, userId: string, mealLogId: string, entries: MealEntryInput[]) {
  const log = await prisma.mealLog.findUnique({ where: { id: mealLogId } });
  if (!log || log.userId !== userId || log.deletedAt) throw new NotFoundError("Mahlzeit nicht gefunden");
  await appendEntries(prisma, userId, mealLogId, entries);
  const fresh = await prisma.mealLog.findUniqueOrThrow({ where: { id: mealLogId }, include: { entries: { orderBy: { createdAt: "asc" } } } });
  return toMealLogDto(fresh, fresh.entries);
}

export async function listMealLogs(prisma: PrismaClient, userId: string, from: string, to: string): Promise<LogWithEntries[]> {
  return prisma.mealLog.findMany({
    where: { userId, deletedAt: null, date: { gte: dateFromKey(from), lte: dateFromKey(to) } },
    include: { entries: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
    orderBy: [{ date: "asc" }, { eatenAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function deleteMealLog(prisma: PrismaClient, userId: string, id: string): Promise<void> {
  const log = await prisma.mealLog.findUnique({ where: { id } });
  if (!log || log.userId !== userId) throw new NotFoundError("Mahlzeit nicht gefunden");
  if (log.deletedAt) return;
  const now = new Date();
  await prisma.$transaction([
    prisma.mealLog.update({ where: { id }, data: { deletedAt: now } }),
    prisma.mealEntry.updateMany({ where: { mealLogId: id, deletedAt: null }, data: { deletedAt: now } }),
  ]);
}

export async function deleteMealEntry(prisma: PrismaClient, userId: string, id: string): Promise<void> {
  const entry = await prisma.mealEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== userId) throw new NotFoundError("Eintrag nicht gefunden");
  if (!entry.deletedAt) await prisma.mealEntry.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ─── Daily rating (1–10) ───────────────────────────────────────────────────────────────────────

export function toRatingDto(rating: DailyNutritionRating) {
  return {
    id: rating.id,
    date: dateKey(rating.date),
    score: rating.score,
    note: rating.note,
    createdAt: rating.createdAt.toISOString(),
    updatedAt: rating.updatedAt.toISOString(),
    deletedAt: rating.deletedAt?.toISOString() ?? null,
  };
}

// Append-only: a new rating for a day retires the previous one (soft delete) instead of
// overwriting it. The same id again is a no-op.
export async function setRating(prisma: PrismaClient, userId: string, date: string, input: SetRatingInput): Promise<{ created: boolean; rating: ReturnType<typeof toRatingDto> }> {
  const existing = await prisma.dailyNutritionRating.findUnique({ where: { id: input.id } });
  if (existing) {
    if (existing.userId !== userId) throw new ForbiddenError("Diese Bewertung gehört zu einem anderen Konto");
    return { created: false, rating: toRatingDto(existing) };
  }
  const day = dateFromKey(date);
  const rating = await prisma.$transaction(async (tx) => {
    await tx.dailyNutritionRating.updateMany({ where: { userId, date: day, deletedAt: null }, data: { deletedAt: new Date() } });
    return tx.dailyNutritionRating.create({ data: { id: input.id, userId, date: day, score: input.score, note: input.note ?? null } });
  });
  return { created: true, rating: toRatingDto(rating) };
}

export async function listRatings(prisma: PrismaClient, userId: string, from: string, to: string) {
  const ratings = await prisma.dailyNutritionRating.findMany({
    where: { userId, deletedAt: null, date: { gte: dateFromKey(from), lte: dateFromKey(to) } },
    orderBy: { date: "asc" },
  });
  return ratings.map(toRatingDto);
}

export async function deleteRating(prisma: PrismaClient, userId: string, id: string): Promise<void> {
  const rating = await prisma.dailyNutritionRating.findUnique({ where: { id } });
  if (!rating || rating.userId !== userId) throw new NotFoundError("Bewertung nicht gefunden");
  if (!rating.deletedAt) await prisma.dailyNutritionRating.update({ where: { id }, data: { deletedAt: new Date() } });
}
