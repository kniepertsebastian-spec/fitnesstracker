import type { PrismaClient } from "@prisma/client";
import { calculateNutrition, getProfile } from "../profile/profile.service.js";
import { getUserTimeZone, localDayKey } from "../../lib/userTime.js";
import { roundNutrients, splitMacros, sumNutrients, type MacroSplit } from "../nutrition/nutrients.js";
import { dateFromKey, entryNutrients } from "../meals/meal.service.js";
import { bodyTrend } from "./bodyTrend.js";

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

// Weight and body water from the Fitnesstracker's measurements, for the shared progress view.
export async function getBodyTrend(prisma: PrismaClient, userId: string, days: number, now = new Date()) {
  const timeZone = await getUserTimeZone(prisma, userId);
  const today = localDayKey(now, timeZone);
  // Two weeks at least, for the week-over-week mean; one day of margin for the zone offset.
  const since = new Date(now.getTime() - (Math.max(days, 14) + 1) * 86_400_000);
  const rows = await prisma.bodyCompositionEntry.findMany({
    where: { userId, measuredAt: { gte: since } },
    select: { measuredAt: true, weightKg: true, bodyWaterPercent: true, bodyFatPercent: true },
    orderBy: { measuredAt: "asc" },
  });
  const measurements = rows.map((r) => ({
    measuredAt: r.measuredAt,
    weightKg: Number(r.weightKg),
    bodyWaterPercent: r.bodyWaterPercent === null ? null : Number(r.bodyWaterPercent),
    bodyFatPercent: r.bodyFatPercent === null ? null : Number(r.bodyFatPercent),
  }));
  return { ...bodyTrend(measurements, timeZone, today, days), source: "fitnesstracker" as const };
}
