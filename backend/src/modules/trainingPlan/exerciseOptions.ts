import type { PrismaClient } from "@prisma/client";
import { coldStartInputSchema, DEFAULT_EQUIPMENT, type ExerciseOptionDto } from "@fitnesstracker/shared";
import { equipmentTagOf, scoreExercise, type CatalogRow } from "../aiPlanGenerator/planAssembly.js";

const OPTION_CATEGORIES = ["strength", "powerlifting"];
const SWAP_OPTIONS = 6;
const ADD_OPTIONS = 8;

export interface OptionPool {
  rows: CatalogRow[];
  loggedCounts: Map<string, number>;
}

// Candidate exercises for in-workout swaps: active strength exercises with equipment the user
// allowed in the AI questionnaire (or the default set when it was never filled in).
export async function loadOptionPool(prisma: PrismaClient, userId: string): Promise<OptionPool> {
  const [user, rows, logged] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { aiPlanPreferences: true } }),
    prisma.exercise.findMany({
      where: { isActive: true, category: { in: OPTION_CATEGORIES } },
      select: { id: true, name: true, nameDe: true, equipment: true, primaryMuscles: true, category: true },
    }),
    prisma.workoutLog.groupBy({ by: ["exerciseId"], where: { userId, deletedAt: null }, _count: { _all: true } }),
  ]);
  const prefs = coldStartInputSchema.safeParse(user?.aiPlanPreferences);
  const allowed = new Set(prefs.success ? prefs.data.equipment : DEFAULT_EQUIPMENT);
  return {
    rows: rows.filter((r) => allowed.has(equipmentTagOf(r.equipment))),
    loggedCounts: new Map(logged.map((l) => [l.exerciseId, l._count._all])),
  };
}

function toOption(row: CatalogRow): ExerciseOptionDto {
  return {
    exerciseId: row.id,
    exerciseName: row.nameDe ?? row.name,
    equipment: row.equipment,
    primaryMuscle: row.primaryMuscles[0] ?? null,
  };
}

function ranked(pool: OptionPool, rows: CatalogRow[]): CatalogRow[] {
  return [...rows].sort(
    (a, b) =>
      scoreExercise(b, pool.loggedCounts.get(b.id) ?? 0) - scoreExercise(a, pool.loggedCounts.get(a.id) ?? 0) ||
      a.name.localeCompare(b.name),
  );
}

export function swapOptionsFor(
  pool: OptionPool,
  muscle: string | undefined,
  dayExerciseIds: Set<string>,
  alternativeId: string | null,
): ExerciseOptionDto[] {
  if (!muscle) return [];
  const candidates = ranked(
    pool,
    pool.rows.filter((r) => r.primaryMuscles[0] === muscle && !dayExerciseIds.has(r.id)),
  );
  const alt = alternativeId ? candidates.find((c) => c.id === alternativeId) : undefined;
  const ordered = alt ? [alt, ...candidates.filter((c) => c.id !== alt.id)] : candidates;
  return ordered.slice(0, SWAP_OPTIONS).map(toOption);
}

// Round-robin over the day's muscles so additions aren't all for the first one.
export function addOptionsFor(pool: OptionPool, muscles: string[], dayExerciseIds: Set<string>): ExerciseOptionDto[] {
  const byMuscle = muscles.map((m) =>
    ranked(pool, pool.rows.filter((r) => r.primaryMuscles[0] === m && !dayExerciseIds.has(r.id))),
  );
  const picked: CatalogRow[] = [];
  const seen = new Set<string>();
  for (let rank = 0; picked.length < ADD_OPTIONS && byMuscle.some((list) => rank < list.length); rank++) {
    for (const list of byMuscle) {
      const row = list[rank];
      if (row && !seen.has(row.id) && picked.length < ADD_OPTIONS) {
        picked.push(row);
        seen.add(row.id);
      }
    }
  }
  return picked.map(toOption);
}
