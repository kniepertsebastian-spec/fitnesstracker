import type { PrismaClient } from "@prisma/client";
import { ConflictError } from "../../errors/httpErrors.js";

// A commonly cited general guideline (35ml per kg bodyweight/day) — used only when the user
// hasn't set an explicit override, and only as a starting suggestion, not a medical claim.
const ML_PER_KG_SUGGESTION = 35;
const DEFAULT_TARGET_ML = 2500;

function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export interface TargetInfo {
  targetMl: number;
  isCustomTarget: boolean;
}

export async function getTargetMl(prisma: PrismaClient, userId: string): Promise<TargetInfo> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (profile?.waterTargetMlOverride) {
    return { targetMl: profile.waterTargetMlOverride, isCustomTarget: true };
  }
  if (profile) {
    return { targetMl: Math.round(Number(profile.weightKg) * ML_PER_KG_SUGGESTION), isCustomTarget: false };
  }
  return { targetMl: DEFAULT_TARGET_ML, isCustomTarget: false };
}

// A custom target is stored on Profile, so it requires one to already exist — creating a bare
// Profile row just to hold this one field would mean fabricating the required nutrition fields
// (weight/height/age/gender) with meaningless placeholder values.
export async function setTargetOverride(prisma: PrismaClient, userId: string, targetMl: number | null) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    throw new ConflictError("A nutrition profile is required before setting a custom water target");
  }
  await prisma.profile.update({ where: { userId }, data: { waterTargetMlOverride: targetMl } });
}

// Clamped at 0 rather than allowing a negative running total — an over-eager "undo" tap
// shouldn't be able to push the day into a nonsensical negative amount.
export async function addWater(prisma: PrismaClient, userId: string, amountMl: number) {
  const date = todayUtcDate();
  const existing = await prisma.waterLog.findUnique({ where: { userId_date: { userId, date } } });
  const newAmount = Math.max(0, (existing?.amountMl ?? 0) + amountMl);

  return prisma.waterLog.upsert({
    where: { userId_date: { userId, date } },
    update: { amountMl: newAmount },
    create: { userId, date, amountMl: newAmount },
  });
}

export interface WaterDay {
  date: Date;
  amountMl: number;
}

// Always returns exactly `days` entries, newest first, zero-filling any day with no logged
// water — a "last 7 days" view with silent gaps on quiet days would be a worse read than an
// honest zero.
export async function getHistory(prisma: PrismaClient, userId: string, days: number): Promise<WaterDay[]> {
  const since = todayUtcDate();
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const logs = await prisma.waterLog.findMany({
    where: { userId, date: { gte: since } },
  });
  const byDate = new Map(logs.map((log) => [log.date.toISOString().slice(0, 10), log.amountMl]));

  const result: WaterDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(since);
    date.setUTCDate(date.getUTCDate() + i);
    result.push({ date, amountMl: byDate.get(date.toISOString().slice(0, 10)) ?? 0 });
  }
  return result.reverse();
}

export async function getStatus(prisma: PrismaClient, userId: string, days: number) {
  const [history, target] = await Promise.all([
    getHistory(prisma, userId, days),
    getTargetMl(prisma, userId),
  ]);
  return { history, target };
}
