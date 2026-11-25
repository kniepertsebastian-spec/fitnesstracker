import type { PrismaClient } from "@prisma/client";
import { calculateNutrition, getProfile } from "../profile/profile.service.js";
import { getUserTimeZone, localDayKey } from "../../lib/userTime.js";
import { roundNutrients, splitMacros, sumNutrients, type MacroSplit } from "../nutrition/nutrients.js";
import { dateFromKey, entryNutrients } from "../meals/meal.service.js";

// The targets of the day as the Fitnesstracker calculates them (single source of truth: Profile,
// TrainingPlan). Nothing is recalculated or adjusted here; only the remaining calories after
// protein are split into fat and carbohydrates by the user's setting.

export const DEFAULT_FAT_PERCENT_OF_REMAINING = 40;

export async function getNutritionSettings(prisma: PrismaClient, userId: string) {
  const settings = await prisma.nutritionSettings.findUnique({ where: { userId } });
  return { fatPercentOfRemaining: settings?.fatPercentOfRemaining ?? DEFAULT_FAT_PERCENT_OF_REMAINING };
}

export async function updateNutritionSettings(prisma: PrismaClient, userId: string, fatPercentOfRemaining: number) {
  const settings = await prisma.nutritionSettings.upsert({
    where: { userId },
    create: { userId, fatPercentOfRemaining },
    update: { fatPercentOfRemaining },
  });
  return { fatPercentOfRemaining: settings.fatPercentOfRemaining };
}

export interface CurrentTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  targetProteinG: number;
  macros: MacroSplit;
  nutritionPhase: "CUT" | "MAINTAIN" | "BULK";
}

// Null without a profile: then there is nothing to aim for yet.
export async function currentTargets(prisma: PrismaClient, userId: string): Promise<CurrentTargets | null> {
  const [profile, settings] = await Promise.all([getProfile(prisma, userId), getNutritionSettings(prisma, userId)]);
  if (!profile) return null;
  const calc = calculateNutrition(profile);
  return {
    ...calc,
    macros: splitMacros(calc.targetCalories, calc.targetProteinG, settings.fatPercentOfRemaining),
    nutritionPhase: profile.goal,
  };
}

export async function getTodayTargets(prisma: PrismaClient, userId: string, now = new Date()) {
  const timeZone = await getUserTimeZone(prisma, userId);
  const date = localDayKey(now, timeZone);
  const [targets, plan, entries] = await Promise.all([
    currentTargets(prisma, userId),
    // Read only: the Fitnesstracker owns the plan and its rotation.
    prisma.trainingPlan.findUnique({ where: { userId }, select: { currentPhase: true, pausedAt: true } }),
    prisma.mealEntry.findMany({
      where: { userId, deletedAt: null, mealLog: { deletedAt: null, date: dateFromKey(date) } },
      select: { kcal: true, proteinG: true, carbsG: true, fatG: true, fiberG: true, sugarG: true, saturatedFatG: true, saltG: true, estimatedFields: true },
    }),
  ]);
  const consumed = roundNutrients(sumNutrients(entries.map(entryNutrients)));
  return {
    date,
    timeZone,
    source: "fitnesstracker" as const,
    profileComplete: targets !== null,
    bmr: targets?.bmr ?? null,
    tdee: targets?.tdee ?? null,
    targetCalories: targets?.targetCalories ?? null,
    targetProteinG: targets?.targetProteinG ?? null,
    macros: targets?.macros ?? null,
    nutritionPhase: targets?.nutritionPhase ?? null,
    trainingPhase: plan?.currentPhase ?? null,
    trainingPaused: plan ? plan.pausedAt !== null : null,
    consumed: { ...consumed.values, estimatedFields: consumed.estimated, entries: entries.length },
  };
}
