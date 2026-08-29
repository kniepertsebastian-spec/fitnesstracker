import type { DailyChallengeCategory, PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../errors/httpErrors.js";
import { sendNotificationToUser } from "../push/push.service.js";

const ITEMS_PER_DAY = 3;
export const MAX_ROTATIONS = 2;

// "body only" is the exact equipment tag the free-exercise-db import uses for no-equipment
// exercises (see ARCHITECTURE.md); "stretching" is excluded because hold/duration-based moves
// don't fit a rep counter. Even so, some "body only"-tagged entries still assume a bench or a
// pull-up bar — this keyword filter is a best-effort cleanup on top of the equipment tag, not a
// guarantee every result needs literally zero surface or fixture.
const EXCLUDE_KEYWORDS = ["bench", "hanging", "wall", "chair", "box", "step", "dip"];

function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// `sort(() => Math.random() - 0.5)` is not a uniform shuffle (V8's sort doesn't call the
// comparator the right number of times for every permutation to be equally likely) — Fisher-Yates
// is the standard correct algorithm.
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Fallback pool for users without a training plan yet, or when a category prefers a bodyweight
// movement and the current plan phase doesn't have one to offer.
async function pickBodyweightExerciseIds(
  prisma: PrismaClient,
  count: number,
  excludeIds: string[],
): Promise<string[]> {
  const candidates = await prisma.exercise.findMany({
    where: { equipment: "body only", category: { in: ["strength", "plyometrics"] }, id: { notIn: excludeIds } },
    select: { id: true, name: true },
  });
  const filtered = candidates.filter(
    (ex) => !EXCLUDE_KEYWORDS.some((kw) => ex.name.toLowerCase().includes(kw)),
  );
  const pool = filtered.length >= count ? filtered : candidates;

  return shuffle(pool)
    .slice(0, count)
    .map((ex) => ex.id);
}

interface PlanExerciseInfo {
  exerciseId: string;
  equipment: string | null;
  targetReps: number | null;
}

// Keyed by the current phase, not a specific rotation instance — see PlanExercise's own comment
// in schema.prisma. A user without a training plan yet gets an empty list, and every category
// below falls back to the generic bodyweight pool in that case.
async function loadCurrentPlanExercises(prisma: PrismaClient, userId: string): Promise<PlanExerciseInfo[]> {
  const plan = await prisma.trainingPlan.findUnique({ where: { userId } });
  if (!plan) return [];
  const entries = await prisma.planExercise.findMany({
    where: { userId, phase: plan.currentPhase },
    include: { exercise: true },
  });
  return entries.map((entry) => ({
    exerciseId: entry.exerciseId,
    equipment: entry.exercise.equipment,
    targetReps: entry.targetReps,
  }));
}

export interface RecentPerformance {
  avgReps: number;
  maxReps: number;
}

// Looks at the last 10 logged sets for this exercise: the most recent session's average rep
// count (what the user normally does) and the highest single-set rep count ever (the bar a
// PROGRESSION challenge should push past). Null when the exercise has never been logged.
async function recentPerformance(
  prisma: PrismaClient,
  userId: string,
  exerciseId: string,
): Promise<RecentPerformance | null> {
  const logs = await prisma.workoutLog.findMany({
    where: { userId, exerciseId, deletedAt: null },
    orderBy: { performedAt: "desc" },
    take: 10,
    select: { reps: true, performedAt: true },
  });
  if (logs.length === 0) return null;

  const mostRecentDay = utcDayKey(logs[0].performedAt);
  const sameSession = logs.filter((log) => utcDayKey(log.performedAt) === mostRecentDay);
  const avgReps = Math.round(sameSession.reduce((sum, log) => sum + log.reps, 0) / sameSession.length);
  const maxReps = Math.max(...logs.map((log) => log.reps));
  return { avgReps, maxReps };
}

export function computeTargetReps(
  category: DailyChallengeCategory,
  perf: RecentPerformance | null,
  planTargetReps: number | null,
): number {
  const baseline = planTargetReps ?? perf?.avgReps ?? 10;
  switch (category) {
    case "PROGRESSION":
      // Push a new best: one better than the highest single set ever logged for this exercise.
      return (perf?.maxReps ?? baseline) + 2;
    case "VOLUME":
      // More total work than a normal set — roughly double the usual output.
      return Math.max(10, (perf?.avgReps ?? baseline) * 2);
    case "TECHNIQUE":
      // Fewer, cleaner reps — quality over quantity, so stay at or under the usual set size.
      return Math.max(6, Math.min(baseline, 12));
    case "RECOVERY":
      // Light movement, not a workout — a small fixed target regardless of history.
      return 10;
    case "CONSISTENCY":
    default:
      // Just match what's normal for this exercise — the point is showing up, not a stretch goal.
      return Math.max(6, baseline);
  }
}

// Picks one exercise + a target rep count for `category`, preferring an exercise from the user's
// current plan phase (TECHNIQUE/RECOVERY prefer a bodyweight one among those if available) and
// falling back to the generic bodyweight pool otherwise. Returns null only if no exercise at all
// could be found (empty catalog).
async function buildChallengeCandidate(
  prisma: PrismaClient,
  userId: string,
  category: DailyChallengeCategory,
  planExercises: PlanExerciseInfo[],
  excludeIds: string[],
): Promise<{ exerciseId: string; targetReps: number } | null> {
  const wantsBodyweight = category === "TECHNIQUE" || category === "RECOVERY";
  let candidates = planExercises.filter((p) => !excludeIds.includes(p.exerciseId));
  if (wantsBodyweight) {
    const bodyweightCandidates = candidates.filter((p) => p.equipment === "body only");
    if (bodyweightCandidates.length > 0) candidates = bodyweightCandidates;
  }

  const picked = candidates.length > 0 ? shuffle(candidates)[0] : undefined;

  let exerciseId: string;
  let planTargetReps: number | null = null;
  if (picked) {
    exerciseId = picked.exerciseId;
    planTargetReps = picked.targetReps;
  } else {
    const [fallbackId] = await pickBodyweightExerciseIds(prisma, 1, excludeIds);
    if (!fallbackId) return null;
    exerciseId = fallbackId;
  }

  const perf = await recentPerformance(prisma, userId, exerciseId);
  return { exerciseId, targetReps: computeTargetReps(category, perf, planTargetReps) };
}

async function daysTrainedInLastWeek(prisma: PrismaClient, userId: string): Promise<number> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);
  const logs = await prisma.workoutLog.findMany({
    where: { userId, deletedAt: null, performedAt: { gte: since } },
    select: { performedAt: true },
  });
  return new Set(logs.map((log) => utcDayKey(log.performedAt))).size;
}

// RECOVERY only enters the pool on a high-load week (5+ of the last 7 days trained) — pushing
// extra VOLUME on top of that would work against recovery, so it takes VOLUME's slot instead of
// just being added as a 5th option every day.
function pickCategoriesForToday(highLoad: boolean): DailyChallengeCategory[] {
  const pool: DailyChallengeCategory[] = highLoad
    ? ["PROGRESSION", "RECOVERY", "CONSISTENCY", "TECHNIQUE"]
    : ["PROGRESSION", "VOLUME", "CONSISTENCY", "TECHNIQUE"];
  return shuffle(pool).slice(0, ITEMS_PER_DAY);
}

const withExercise = { include: { exercise: true } } as const;

// Selection happens once per user per day: the first read of the day picks the categories,
// exercises and targets; every subsequent read that day returns the same rows.
export async function getOrCreateTodayChallenge(prisma: PrismaClient, userId: string) {
  const date = todayUtcDate();
  const existing = await prisma.dailyChallengeItem.findMany({
    where: { userId, date },
    ...withExercise,
  });
  if (existing.length > 0) return existing;

  const [planExercises, daysTrained] = await Promise.all([
    loadCurrentPlanExercises(prisma, userId),
    daysTrainedInLastWeek(prisma, userId),
  ]);
  const categories = pickCategoriesForToday(daysTrained >= 5);

  const picks: { category: DailyChallengeCategory; exerciseId: string; targetReps: number }[] = [];
  for (const category of categories) {
    const candidate = await buildChallengeCandidate(
      prisma,
      userId,
      category,
      planExercises,
      picks.map((p) => p.exerciseId),
    );
    if (candidate) picks.push({ category, ...candidate });
  }
  if (picks.length === 0) return [];

  await prisma.dailyChallengeItem.createMany({
    data: picks.map(({ category, exerciseId, targetReps }) => ({ userId, date, exerciseId, category, targetReps })),
    skipDuplicates: true,
  });

  return prisma.dailyChallengeItem.findMany({ where: { userId, date }, ...withExercise });
}

// Clamped at 0 rather than allowing a negative count — no upper clamp, since doing more than
// the target is a fine outcome, not an error.
export async function addReps(prisma: PrismaClient, userId: string, itemId: string, delta: number) {
  const item = await prisma.dailyChallengeItem.findFirst({ where: { id: itemId, userId } });
  if (!item) {
    throw new NotFoundError("Daily challenge item not found");
  }

  return prisma.dailyChallengeItem.update({
    where: { id: itemId },
    data: { completedReps: Math.max(0, item.completedReps + delta) },
    ...withExercise,
  });
}

// Swaps an item's exercise for another one in the same category (same selection logic as initial
// generation), resetting its progress. Capped at MAX_ROTATIONS per item per day — "1-2 Rotationen
// verfügbar" — so this isn't an unlimited reroll-until-you-like-it button.
export async function rerollChallengeItem(prisma: PrismaClient, userId: string, itemId: string) {
  const item = await prisma.dailyChallengeItem.findFirst({ where: { id: itemId, userId } });
  if (!item) {
    throw new NotFoundError("Daily challenge item not found");
  }
  if (item.rotationsUsed >= MAX_ROTATIONS) {
    throw new ConflictError("Keine Rotation mehr verfügbar für diese Challenge");
  }

  const [siblings, planExercises] = await Promise.all([
    prisma.dailyChallengeItem.findMany({ where: { userId, date: item.date }, select: { exerciseId: true } }),
    loadCurrentPlanExercises(prisma, userId),
  ]);
  const candidate = await buildChallengeCandidate(
    prisma,
    userId,
    item.category,
    planExercises,
    siblings.map((s) => s.exerciseId),
  );
  if (!candidate) {
    throw new ConflictError("Keine Alternative für diese Kategorie verfügbar");
  }

  return prisma.dailyChallengeItem.update({
    where: { id: itemId },
    data: {
      exerciseId: candidate.exerciseId,
      targetReps: candidate.targetReps,
      completedReps: 0,
      rotationsUsed: { increment: 1 },
    },
    ...withExercise,
  });
}

const REMINDER_HOUR_UTC = 20;

// Once-daily nudge, only for a user whose challenge already exists for today (i.e. they opened
// the app at least once — getOrCreateTodayChallenge generates it lazily, so a scheduler
// generating challenges for everyone just to remind them would be a much bigger, more
// speculative feature than this reminder needs to be) and isn't fully completed yet.
export async function sendDueDailyChallengeReminders(prisma: PrismaClient): Promise<{ sent: number }> {
  if (new Date().getUTCHours() < REMINDER_HOUR_UTC) return { sent: 0 };
  const date = todayUtcDate();

  const candidates = await prisma.user.findMany({
    where: {
      remindDailyChallenge: true,
      OR: [{ lastDailyChallengeReminderSentOn: null }, { lastDailyChallengeReminderSentOn: { lt: date } }],
    },
    select: { id: true },
  });

  let sent = 0;
  for (const user of candidates) {
    const items = await prisma.dailyChallengeItem.findMany({ where: { userId: user.id, date } });
    if (items.length === 0) continue;
    const allDone = items.every((item) => item.completedReps >= item.targetReps);
    if (allDone) continue;

    await sendNotificationToUser(prisma, user.id, {
      title: "Tages-Challenge",
      body: "Noch nicht abgeschlossen — ein paar Wiederholungen fehlen noch.",
      url: "/",
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastDailyChallengeReminderSentOn: date } });
    sent += 1;
  }
  return { sent };
}
