import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  cardioPlanItemSchema,
  type CardioPlanDayDto,
  type CardioPlanDto,
  type CardioPlanItem,
  type TrainingPhase,
} from "@fitnesstracker/shared";
import { getCurrentTrainingPlan } from "../trainingPlan/trainingPlan.service.js";
import { loadPlanDays } from "../stretching/stretching.service.js";
import { cardioReason, isLegDay, suggestDayCardio, suggestFreeCardio } from "./cardioSuggestion.js";

// dayLabel key for the row holding the sessions on days without strength training. Plan day
// labels come from the AI generator / user and never use this reserved form.
export const FREE_DAY_KEY = "__free__";

const storedItemsSchema = z.array(cardioPlanItemSchema);

// Stored JSON is re-validated on every read: a row written by an older/buggy version must not be
// able to put an invalid item in front of the UI. Invalid rows are treated as "no override".
function parseItems(value: Prisma.JsonValue): CardioPlanItem[] | null {
  const parsed = storedItemsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function getCardioPlan(
  prisma: PrismaClient,
  userId: string,
  phase?: TrainingPhase,
): Promise<CardioPlanDto> {
  const { plan } = await getCurrentTrainingPlan(prisma, userId);
  const resolvedPhase = phase ?? plan.currentPhase;
  const goal = plan.trainingGoal;

  const [planDays, saved] = await Promise.all([
    loadPlanDays(prisma, userId, resolvedPhase),
    prisma.cardioPlanDay.findMany({ where: { userId, phase: resolvedPhase } }),
  ]);
  const savedByKey = new Map(saved.map((row) => [row.dayLabel, parseItems(row.items)]));

  const days: CardioPlanDayDto[] = planDays.map((day) => {
    const custom = savedByKey.get(day.dayLabel ?? "");
    return {
      dayLabel: day.dayLabel,
      isLegDay: isLegDay(day.muscles),
      source: custom ? "custom" : "auto",
      items: custom ?? suggestDayCardio(goal, resolvedPhase, day.muscles),
    };
  });

  const customFree = savedByKey.get(FREE_DAY_KEY);
  return {
    phase: resolvedPhase,
    goal,
    reason: cardioReason(goal),
    days,
    free: customFree ? { source: "custom", items: customFree } : { source: "auto", items: suggestFreeCardio(goal) },
  };
}

async function upsertDay(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
  dayLabel: string,
  items: CardioPlanItem[],
) {
  await prisma.cardioPlanDay.upsert({
    where: { userId_phase_dayLabel: { userId, phase, dayLabel } },
    create: { userId, phase, dayLabel, items },
    update: { items },
  });
}

export async function saveCardioPlanDay(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
  dayLabel: string | null,
  items: CardioPlanItem[],
) {
  // Warm-up first, then the session after training — the order the training view walks through.
  const ordered = [...items.filter((i) => i.slot === "WARMUP"), ...items.filter((i) => i.slot === "AFTER")];
  await upsertDay(prisma, userId, phase, dayLabel ?? "", ordered);
}

export async function saveCardioPlanFree(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
  items: CardioPlanItem[],
) {
  await upsertDay(prisma, userId, phase, FREE_DAY_KEY, items);
}

// Back to the rule-based suggestion: drop the user's own version for one day or the free days.
export async function resetCardioPlan(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
  dayKey: string,
) {
  await prisma.cardioPlanDay.deleteMany({ where: { userId, phase, dayLabel: dayKey } });
}
