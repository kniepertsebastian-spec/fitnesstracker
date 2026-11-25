import { Prisma, type PrismaClient } from "@prisma/client";
import type { NutritionSyncPush } from "@fitnesstracker/shared";
import { HttpError } from "../../errors/httpErrors.js";
import { deleteFood, deleteFoodUnit, toFoodDto, toFoodUnitDto, upsertFood, upsertFoodUnit } from "../foods/food.service.js";
import { deleteRecipe, toRecipeDto, upsertRecipe } from "../recipes/recipe.service.js";
import {
  addMealEntries,
  createMealLog,
  deleteMealEntry,
  deleteMealLog,
  deleteRating,
  setRating,
  toMealEntryDto,
  toMealLogDto,
  toRatingDto,
} from "../meals/meal.service.js";
import { getNutritionSettings } from "../nutritionTargets/nutritionTargets.service.js";

// Delta sync of the Kalorientracker's own data (offline-first PWA with Dexie). Pull: everything
// that changed since the client's last serverTime, deletions as id lists. Push: a batch of offline
// changes, applied one by one through the same services as the single endpoints. Master data
// (foods, units, recipes) is last-write-wins by clientUpdatedAt; meals and ratings only append.

export async function pullChanges(prisma: PrismaClient, userId: string, since: Date | null) {
  const changed = since ? { updatedAt: { gt: since } } : { deletedAt: null };
  const [foods, foodUnits, recipes, mealLogs, mealEntries, ratings, settings] = await Promise.all([
    prisma.food.findMany({ where: { userId, ...changed }, include: { units: { where: { userId } } } }),
    // Own measures, also those of shared (BLS/OFF) foods.
    prisma.foodUnit.findMany({ where: { userId, ...changed } }),
    prisma.recipe.findMany({ where: { userId, ...changed }, include: { ingredients: true } }),
    prisma.mealLog.findMany({ where: { userId, ...changed } }),
    prisma.mealEntry.findMany({ where: { userId, ...changed } }),
    prisma.dailyNutritionRating.findMany({ where: { userId, ...changed } }),
    getNutritionSettings(prisma, userId),
  ]);
  const live = <T extends { deletedAt: Date | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);
  const gone = <T extends { id: string; deletedAt: Date | null }>(rows: T[]) => rows.filter((r) => r.deletedAt).map((r) => r.id);
  return {
    foods: live(foods).map((f) => toFoodDto(f, userId)),
    foodUnits: live(foodUnits).map(toFoodUnitDto),
    recipes: live(recipes).map(toRecipeDto),
    mealLogs: live(mealLogs).map((l) => toMealLogDto(l)),
    mealEntries: live(mealEntries).map(toMealEntryDto),
    ratings: live(ratings).map(toRatingDto),
    deleted: {
      foods: gone(foods),
      foodUnits: gone(foodUnits),
      recipes: gone(recipes),
      mealLogs: gone(mealLogs),
      mealEntries: gone(mealEntries),
      ratings: gone(ratings),
    },
    settings,
  };
}

export type OpStatus = "applied" | "stale" | "rejected";
export interface OpResult {
  kind: string;
  id: string;
  status: OpStatus;
  message?: string;
}

async function run(results: OpResult[], kind: string, id: string, op: () => Promise<OpStatus | void>) {
  try {
    results.push({ kind, id, status: (await op()) ?? "applied" });
  } catch (error) {
    // A rejected op does not stop the batch. Our own errors carry a message meant for the user;
    // anything else stays in the server log and is reported generically.
    if (error instanceof HttpError) {
      results.push({ kind, id, status: "rejected", message: error.message });
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      results.push({ kind, id, status: "rejected", message: "Konflikt beim Speichern" });
    } else {
      throw error;
    }
  }
}

// Order matters: foods before the units, recipes and entries that use them; deletions last.
export async function applyPush(prisma: PrismaClient, userId: string, push: NutritionSyncPush): Promise<OpResult[]> {
  const results: OpResult[] = [];
  for (const { id, ...food } of push.foods) {
    await run(results, "food", id, async () => (await upsertFood(prisma, userId, id, food)).status);
  }
  for (const { id, ...unit } of push.foodUnits) {
    await run(results, "foodUnit", id, async () => (await upsertFoodUnit(prisma, userId, id, unit)).status);
  }
  for (const { id, ...recipe } of push.recipes) {
    await run(results, "recipe", id, async () => (await upsertRecipe(prisma, userId, id, recipe)).status);
  }
  for (const log of push.mealLogs) {
    await run(results, "mealLog", log.id, async () => {
      await createMealLog(prisma, userId, log);
    });
  }
  for (const { mealLogId, entry } of push.mealEntries) {
    await run(results, "mealEntry", entry.id, async () => {
      await addMealEntries(prisma, userId, mealLogId, [entry]);
    });
  }
  for (const { date, ...rating } of push.ratings) {
    await run(results, "rating", rating.id, async () => {
      await setRating(prisma, userId, date, rating);
    });
  }
  const d = push.deletions;
  for (const id of d.mealEntries) await run(results, "mealEntry", id, () => deleteMealEntry(prisma, userId, id));
  for (const id of d.mealLogs) await run(results, "mealLog", id, () => deleteMealLog(prisma, userId, id));
  for (const id of d.ratings) await run(results, "rating", id, () => deleteRating(prisma, userId, id));
  for (const id of d.recipes) await run(results, "recipe", id, () => deleteRecipe(prisma, userId, id));
  for (const id of d.foodUnits) await run(results, "foodUnit", id, () => deleteFoodUnit(prisma, userId, id));
  for (const id of d.foods) await run(results, "food", id, () => deleteFood(prisma, userId, id));
  return results;
}
