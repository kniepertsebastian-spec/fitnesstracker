import type { Prisma, PrismaClient } from "@prisma/client";
import type { CreateExerciseInput, UpdateExerciseInput } from "@fitnesstracker/shared";
import { ConflictError, NotFoundError } from "../../errors/httpErrors.js";
import { getSourceAdapter } from "./sources/index.js";

export interface ListExercisesFilters {
  search?: string;
  muscleGroup?: string;
  equipment?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 200;

export async function listExercises(prisma: PrismaClient, filters: ListExercisesFilters) {
  // Built as an `AND` list of clauses, not a spread object — `search` and `muscleGroup` each
  // need their own `OR` (English name vs. German name; primary vs. secondary muscle), and a
  // plain object spread would let the second `OR` key silently clobber the first.
  const clauses: Prisma.ExerciseWhereInput[] = [];
  if (filters.search) {
    clauses.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { nameDe: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }
  if (filters.muscleGroup) {
    clauses.push({
      OR: [
        { primaryMuscles: { has: filters.muscleGroup } },
        { secondaryMuscles: { has: filters.muscleGroup } },
      ],
    });
  }
  if (filters.equipment) {
    clauses.push({ equipment: { equals: filters.equipment, mode: "insensitive" } });
  }
  const where: Prisma.ExerciseWhereInput = clauses.length ? { AND: clauses } : {};

  const pageSize = Math.min(filters.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = filters.page ?? 1;

  const [items, total] = await Promise.all([
    prisma.exercise.findMany({
      where,
      // German name is what's actually displayed (see toExerciseDto) — sort by that first so
      // the list order matches what's on screen. Falls back to `name` for the rare manual entry
      // with no `nameDe`.
      orderBy: [{ nameDe: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.exercise.count({ where }),
  ]);

  return { items, total };
}

// Distinct values across the array columns aren't expressible as a Prisma `distinct` (that
// only dedupes whole rows), so pull the raw values and dedupe in JS — cheap at this catalog size.
export async function getExerciseFacets(prisma: PrismaClient) {
  const rows = await prisma.exercise.findMany({
    select: { primaryMuscles: true, secondaryMuscles: true, equipment: true },
  });

  const muscleGroups = new Set<string>();
  const equipment = new Set<string>();
  for (const row of rows) {
    for (const muscle of row.primaryMuscles) muscleGroups.add(muscle);
    for (const muscle of row.secondaryMuscles) muscleGroups.add(muscle);
    if (row.equipment) equipment.add(row.equipment);
  }

  return {
    muscleGroups: [...muscleGroups].sort(),
    equipment: [...equipment].sort(),
  };
}

export async function getExerciseById(prisma: PrismaClient, id: string) {
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise) {
    throw new NotFoundError("Exercise not found");
  }
  return exercise;
}

export function createExercise(prisma: PrismaClient, input: CreateExerciseInput) {
  return prisma.exercise.create({
    data: { ...input, source: "manual", sourceId: crypto.randomUUID() },
  });
}

export async function updateExercise(prisma: PrismaClient, id: string, input: UpdateExerciseInput) {
  await getExerciseById(prisma, id);
  return prisma.exercise.update({ where: { id }, data: input });
}

export async function deleteExercise(prisma: PrismaClient, id: string) {
  await getExerciseById(prisma, id);
  try {
    await prisma.exercise.delete({ where: { id } });
  } catch (error) {
    // FK RESTRICT from WorkoutLog/Goal — surface as a clean conflict instead of a raw 500.
    if ((error as Prisma.PrismaClientKnownRequestError).code === "P2003") {
      throw new ConflictError("Exercise is still referenced by workout logs or goals");
    }
    throw error;
  }
}

export interface ImportSummary {
  source: string;
  fetched: number;
  created: number;
  updated: number;
}

export async function importExercisesFromSource(
  prisma: PrismaClient,
  sourceName: string,
): Promise<ImportSummary> {
  const adapter = getSourceAdapter(sourceName);
  if (!adapter) {
    throw new NotFoundError(`Unknown exercise source: ${sourceName}`);
  }

  const imported = await adapter.fetchExercises();
  let created = 0;
  let updated = 0;

  for (const entry of imported) {
    const where = { source_sourceId: { source: adapter.name, sourceId: entry.sourceId } };
    const data = {
      name: entry.name,
      description: entry.description,
      videoUrl: entry.videoUrl,
      imageUrls: entry.imageUrls,
      equipment: entry.equipment,
      category: entry.category,
      primaryMuscles: entry.primaryMuscles,
      secondaryMuscles: entry.secondaryMuscles,
    };

    // Upsert alone doesn't report which branch it took, and comparing createdAt/updatedAt
    // isn't reliable (createdAt is a DB-side default, updatedAt is set client-side) — so
    // check existence explicitly instead of guessing from timestamps.
    const existed = (await prisma.exercise.findUnique({ where })) !== null;
    await prisma.exercise.upsert({
      where,
      update: data,
      create: { source: adapter.name, sourceId: entry.sourceId, ...data },
    });
    if (existed) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return { source: adapter.name, fetched: imported.length, created, updated };
}
