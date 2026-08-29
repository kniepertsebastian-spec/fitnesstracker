import type { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../../errors/httpErrors.js";
import { sendNotificationToUser } from "../push/push.service.js";

const ITEMS_PER_DAY = 3;
// Multiples of 5 in a modest range — a clean number to see on a "0/20" counter, not a
// personalized program.
const POSSIBLE_TARGETS = [10, 15, 20, 25];

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

function randomTarget(): number {
  return POSSIBLE_TARGETS[Math.floor(Math.random() * POSSIBLE_TARGETS.length)];
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

async function pickRandomExerciseIds(prisma: PrismaClient, count: number): Promise<string[]> {
  const candidates = await prisma.exercise.findMany({
    where: { equipment: "body only", category: { in: ["strength", "plyometrics"] } },
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

const withExercise = { include: { exercise: true } } as const;

// Randomness happens once per user per day: the first read of the day picks the set and target
// reps, every subsequent read that day returns the same rows.
export async function getOrCreateTodayChallenge(prisma: PrismaClient, userId: string) {
  const date = todayUtcDate();
  const existing = await prisma.dailyChallengeItem.findMany({
    where: { userId, date },
    ...withExercise,
  });
  if (existing.length > 0) return existing;

  const exerciseIds = await pickRandomExerciseIds(prisma, ITEMS_PER_DAY);
  if (exerciseIds.length === 0) return [];

  await prisma.dailyChallengeItem.createMany({
    data: exerciseIds.map((exerciseId) => ({
      userId,
      date,
      exerciseId,
      targetReps: randomTarget(),
    })),
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
