import type { PrismaClient, Recipe, RecipeIngredient } from "@prisma/client";
import type { UpsertRecipeInput } from "@fitnesstracker/shared";
import { z } from "zod";
import { calculateRecipeSchema } from "@fitnesstracker/shared";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../errors/httpErrors.js";
import { loadFoodsForCalc, type WriteStatus } from "../foods/food.service.js";
import {
  NUTRIENT_KEYS,
  calculateRecipe,
  nutrientStatus,
  onlyNutrientKeys,
  roundNutrients,
  roundTo,
  UnitConversionError,
  type NutrientValues,
  type Nutrients,
  type RecipeResult,
} from "../nutrition/nutrients.js";

type CalculateInput = z.infer<typeof calculateRecipeSchema>;
type RecipeWithIngredients = Recipe & { ingredients: RecipeIngredient[] };

const TOTAL_FIELDS = {
  kcal: "totalKcal",
  proteinG: "totalProteinG",
  carbsG: "totalCarbsG",
  fatG: "totalFatG",
  fiberG: "totalFiberG",
  sugarG: "totalSugarG",
  saturatedFatG: "totalSaturatedFatG",
  saltG: "totalSaltG",
} as const;

// Runs the recipe calculation with the foods as they are now. Throws a 400 for a food the user
// cannot see or an amount that cannot be converted.
export async function computeRecipe(prisma: PrismaClient, userId: string, input: CalculateInput): Promise<RecipeResult> {
  const foods = await loadFoodsForCalc(prisma, userId, input.ingredients.map((i) => i.foodId));
  const ingredients = input.ingredients.map((i, index) => {
    const food = foods.get(i.foodId);
    if (!food) throw new BadRequestError(`Zutat ${index + 1}: Lebensmittel nicht gefunden`);
    return { name: food.brand ? `${food.name} (${food.brand})` : food.name, quantity: i.quantity, unitLabel: i.unitLabel, food };
  });
  try {
    return calculateRecipe(ingredients, { finalWeightG: input.finalWeightG, servings: input.servings });
  } catch (error) {
    if (error instanceof UnitConversionError) throw new BadRequestError(error.message);
    throw error;
  }
}

const roundOrNull = (n: NutrientValues | null) => (n ? roundNutrients(n) : null);
const roundWeight = (g: number | null) => (g === null ? null : roundTo(g, 1));

// The preview the app shows while a recipe is edited; also what a stored recipe holds.
export function toCalculationDto(result: RecipeResult) {
  const totals = roundNutrients(result.totals);
  return {
    totals: totals.values,
    estimatedFields: totals.estimated,
    status: nutrientStatus(totals.values, totals.estimated),
    totalRawWeightG: roundTo(result.totalRawWeightG, 1),
    effectiveWeightG: roundTo(result.effectiveWeightG, 1),
    weightSource: result.weightSource,
    totalWeightEstimated: result.totalWeightEstimated,
    cookingChangePercent: result.cookingChangePercent === null ? null : roundTo(result.cookingChangePercent, 1),
    per100g: roundOrNull(result.per100g)?.values ?? null,
    perServing: roundOrNull(result.perServing)?.values ?? null,
    servingWeightG: roundWeight(result.servingWeightG),
    ingredients: result.ingredients.map((i) => {
      const n = roundNutrients(i.nutrients);
      return {
        name: i.name,
        quantity: i.quantity,
        unitLabel: i.unitLabel,
        rawWeightG: roundTo(i.rawWeightG, 1),
        weightEstimated: i.weightEstimated,
        nutrients: n.values,
        estimatedFields: n.estimated,
      };
    }),
  };
}

export function recipeTotals(recipe: Recipe): NutrientValues {
  const values = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) values[key] = recipe[TOTAL_FIELDS[key]];
  return { values, estimated: onlyNutrientKeys(recipe.estimatedFields) };
}

// estimatedFields also carries the weight fields when a weight is only an estimate: an ml-based
// ingredient without density counted as 1 g/ml ("rawWeightG" on the ingredient, "totalRawWeightG"
// on the recipe). Values per gram of such a recipe are then estimates too.
const ESTIMATED_TOTAL_WEIGHT = "totalRawWeightG";
const ESTIMATED_INGREDIENT_WEIGHT = "rawWeightG";

// True when the weight the totals are spread over is an estimate (no final weight given and the
// raw sum contains an estimated ingredient weight).
export function recipeWeightIsEstimate(recipe: Pick<Recipe, "finalWeightG" | "estimatedFields">): boolean {
  return !(recipe.finalWeightG && recipe.finalWeightG > 0) && recipe.estimatedFields.includes(ESTIMATED_TOTAL_WEIGHT);
}

// The weight the stored totals refer to: the weighed final weight, else the raw sum.
export function recipeEffectiveWeight(recipe: Pick<Recipe, "finalWeightG" | "totalRawWeightG">): number {
  return recipe.finalWeightG && recipe.finalWeightG > 0 ? recipe.finalWeightG : recipe.totalRawWeightG;
}

export function toRecipeDto(recipe: RecipeWithIngredients) {
  const totals = recipeTotals(recipe);
  const effectiveWeightG = recipeEffectiveWeight(recipe);
  const per100g = effectiveWeightG > 0 ? roundNutrients({ values: scale(totals.values, 100 / effectiveWeightG), estimated: [] }).values : null;
  const perServing = recipe.servings && recipe.servings > 0 ? roundNutrients({ values: scale(totals.values, 1 / recipe.servings), estimated: [] }).values : null;
  return {
    id: recipe.id,
    name: recipe.name,
    note: recipe.note,
    servings: recipe.servings,
    finalWeightG: recipe.finalWeightG,
    totalRawWeightG: recipe.totalRawWeightG,
    effectiveWeightG,
    weightSource: recipe.finalWeightG && recipe.finalWeightG > 0 ? "final" : "raw",
    totalWeightEstimated: recipe.estimatedFields.includes(ESTIMATED_TOTAL_WEIGHT),
    totals: totals.values,
    estimatedFields: totals.estimated,
    status: nutrientStatus(totals.values, totals.estimated),
    per100g,
    perServing,
    servingWeightG: recipe.servings && recipe.servings > 0 && effectiveWeightG > 0 ? roundTo(effectiveWeightG / recipe.servings, 1) : null,
    ingredients: [...recipe.ingredients]
      .sort((a, b) => a.position - b.position)
      .map((i) => {
        const values = {} as Nutrients;
        for (const key of NUTRIENT_KEYS) values[key] = i[key];
        return {
          id: i.id,
          foodId: i.foodId,
          name: i.name,
          quantity: i.quantity,
          unitLabel: i.unitLabel,
          baseAmount: i.baseAmount,
          rawWeightG: i.rawWeightG,
          weightEstimated: i.estimatedFields.includes(ESTIMATED_INGREDIENT_WEIGHT),
          nutrients: values,
          estimatedFields: onlyNutrientKeys(i.estimatedFields),
        };
      }),
    clientUpdatedAt: recipe.clientUpdatedAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
    deletedAt: recipe.deletedAt?.toISOString() ?? null,
  };
}
export type RecipeDto = ReturnType<typeof toRecipeDto>;

function scale(values: Nutrients, factor: number): Nutrients {
  const out = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) {
    const v = values[key];
    out[key] = v === null ? null : v * factor;
  }
  return out;
}

export async function listRecipes(prisma: PrismaClient, userId: string): Promise<RecipeDto[]> {
  const recipes = await prisma.recipe.findMany({ where: { userId, deletedAt: null }, include: { ingredients: true }, orderBy: { name: "asc" } });
  return recipes.map(toRecipeDto);
}

export async function getRecipe(prisma: PrismaClient, userId: string, id: string): Promise<RecipeDto> {
  const recipe = await prisma.recipe.findFirst({ where: { id, userId, deletedAt: null }, include: { ingredients: true } });
  if (!recipe) throw new NotFoundError("Rezept nicht gefunden");
  return toRecipeDto(recipe);
}

// Saves a recipe with a snapshot of its ingredients and totals, calculated from the foods as they
// are at this moment. Later edits of a food change nothing here until the recipe is saved again.
// Last write wins by clientUpdatedAt.
export async function upsertRecipe(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpsertRecipeInput,
): Promise<{ status: WriteStatus; recipe: RecipeDto }> {
  const existing = await prisma.recipe.findUnique({ where: { id }, include: { ingredients: true } });
  if (existing && existing.userId !== userId) throw new ForbiddenError("Dieses Rezept lässt sich nicht bearbeiten");
  const clientUpdatedAt = new Date(input.clientUpdatedAt);
  if (existing && (existing.deletedAt || existing.clientUpdatedAt > clientUpdatedAt)) {
    return { status: "stale", recipe: toRecipeDto(existing) };
  }

  const result = await computeRecipe(prisma, userId, input);
  const totals = roundNutrients(result.totals);
  const totalFields = Object.fromEntries(NUTRIENT_KEYS.map((k) => [TOTAL_FIELDS[k], totals.values[k]]));
  const data = {
    name: input.name,
    note: input.note ?? null,
    servings: input.servings ?? null,
    finalWeightG: input.finalWeightG && input.finalWeightG > 0 ? input.finalWeightG : null,
    totalRawWeightG: roundTo(result.totalRawWeightG, 1),
    ...totalFields,
    estimatedFields: result.totalWeightEstimated ? [...totals.estimated, ESTIMATED_TOTAL_WEIGHT] : totals.estimated,
    clientUpdatedAt,
  };
  const ingredients = result.ingredients.map((i, position) => {
    const n = roundNutrients(i.nutrients);
    return {
      position,
      foodId: input.ingredients[position]!.foodId,
      name: i.name,
      quantity: i.quantity,
      unitLabel: i.unitLabel,
      baseAmount: i.baseAmount,
      rawWeightG: roundTo(i.rawWeightG, 1),
      ...n.values,
      estimatedFields: i.weightEstimated ? [...n.estimated, ESTIMATED_INGREDIENT_WEIGHT] : n.estimated,
    };
  });

  const recipe = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
      await tx.recipe.update({ where: { id }, data });
    } else {
      await tx.recipe.create({ data: { ...data, id, userId } });
    }
    await tx.recipeIngredient.createMany({ data: ingredients.map((i) => ({ ...i, recipeId: id })) });
    return tx.recipe.findUniqueOrThrow({ where: { id }, include: { ingredients: true } });
  });
  return { status: "applied", recipe: toRecipeDto(recipe) };
}

export async function deleteRecipe(prisma: PrismaClient, userId: string, id: string): Promise<void> {
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe || recipe.userId !== userId) throw new NotFoundError("Rezept nicht gefunden");
  if (!recipe.deletedAt) await prisma.recipe.update({ where: { id }, data: { deletedAt: new Date() } });
}
