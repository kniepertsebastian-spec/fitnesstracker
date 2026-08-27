import type { Exercise, PlanExercise, PrismaClient, TrainingPhase } from "@prisma/client";
import type { WeeklyPlanStatusDto } from "@fitnesstracker/shared";
import { toPlanExerciseDto } from "./planExercise.types.js";

// Monday 00:00 UTC of the current week — same UTC-calendar-day convention as the water/daily-
// challenge day boundaries elsewhere in this app (a few hours of slop around midnight is
// unnoticeable at week granularity, unlike the supplement reminder's exact-clock-time need).
function currentWeekMondayUtc(): Date {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = day.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  day.setUTCDate(day.getUTCDate() - daysSinceMonday);
  return day;
}

type EntryWithExercise = PlanExercise & { exercise: Exercise };

// Groups already-`order`-sorted entries by `dayLabel`, preserving first-seen order — which is
// the split's actual day sequence, since aiPlanGenerator.service.ts writes `order` as one
// counter incrementing day-by-day across the whole plan (see its comments for why).
function groupByDayLabel(entries: EntryWithExercise[]): { dayLabel: string | null; entries: EntryWithExercise[] }[] {
  const groups: { dayLabel: string | null; entries: EntryWithExercise[] }[] = [];
  const indexByLabel = new Map<string | null, number>();
  for (const entry of entries) {
    let idx = indexByLabel.get(entry.dayLabel);
    if (idx === undefined) {
      idx = groups.length;
      indexByLabel.set(entry.dayLabel, idx);
      groups.push({ dayLabel: entry.dayLabel, entries: [] });
    }
    groups[idx].entries.push(entry);
  }
  return groups;
}

// Drives the dashboard's progressive day unlock: shows day 1 first, advances to day 2 once day
// 1 has been trained this week, and so on — reset for free every Monday since "trained this
// week" is computed fresh from the current week's logs rather than stored anywhere.
export async function getWeeklyPlanStatus(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
): Promise<WeeklyPlanStatusDto> {
  const entries = await prisma.planExercise.findMany({
    where: { userId, phase },
    orderBy: { order: "asc" },
    include: { exercise: true },
  });

  if (entries.length === 0) {
    return { days: [], activeDayIndex: null };
  }

  const groups = groupByDayLabel(entries);

  // Always computed, even for a single-day plan — the plan diary (CurrentPlanCard.tsx) needs
  // "already logged this week" per exercise regardless of whether there's a multi-day split to
  // progress through, so a reload doesn't ask you to re-log something you already did.
  const weekStart = currentWeekMondayUtc();
  const trainedThisWeek = await prisma.workoutLog.findMany({
    where: { userId, deletedAt: null, performedAt: { gte: weekStart } },
    select: { exerciseId: true },
  });
  const trainedExerciseIds = new Set(trainedThisWeek.map((w) => w.exerciseId));

  const toDiaryExercise = (entry: EntryWithExercise) => ({
    ...toPlanExerciseDto(entry),
    loggedThisWeek: trainedExerciseIds.has(entry.exerciseId),
  });

  // A single group (Ganzkörper, or a flat manually-curated phase with no AI split at all) has
  // nothing to progress through — always "active", no weekly completion tracking to compute.
  if (groups.length <= 1) {
    return {
      days: groups.map((g) => ({
        dayLabel: g.dayLabel,
        exercises: g.entries.map(toDiaryExercise),
        completed: false,
      })),
      activeDayIndex: 0,
    };
  }

  // A day counts as trained once *every* one of its planned exercises has a log this week — the
  // per-exercise "Ende" checkbox in the plan diary is an explicit, precise "I did this one"
  // signal, so there's no reason to fall back to a looser "at least one" heuristic; someone still
  // logging free-form via the classic dialog just needs to cover every exercise the same way to
  // advance, which is the same bar either path has to clear.
  const days = groups.map((g) => ({
    dayLabel: g.dayLabel,
    exercises: g.entries.map(toDiaryExercise),
    completed: g.entries.every((e) => trainedExerciseIds.has(e.exerciseId)),
  }));

  const firstIncomplete = days.findIndex((d) => !d.completed);
  return { days, activeDayIndex: firstIncomplete === -1 ? null : firstIncomplete };
}
