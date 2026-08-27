import type { PrismaClient } from "@prisma/client";
import type { PlanImportResult, TrainingPhase } from "@fitnesstracker/shared";
import { TRAINING_PHASES } from "@fitnesstracker/shared";
import type { PlanExportRow, RawImportRow } from "./planExport.format.js";

export async function exportPlanExercises(prisma: PrismaClient, userId: string): Promise<PlanExportRow[]> {
  const entries = await prisma.planExercise.findMany({
    where: { userId },
    orderBy: [{ phase: "asc" }, { order: "asc" }],
    include: { exercise: true },
  });

  return entries.map((entry) => ({
    phase: entry.phase,
    exerciseName: entry.exercise.nameDe ?? entry.exercise.name,
    targetSets: entry.targetSets,
    targetReps: entry.targetReps,
    order: entry.order,
  }));
}

interface NormalizedRow {
  phase: TrainingPhase;
  exerciseName: string;
  targetSets: number | null;
  targetReps: number | null;
  order: number | null;
}

function parseOptionalInt(value: unknown, label: string, rowNum: number, errors: string[]): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    errors.push(`Zeile ${rowNum}: ungültiger Wert für ${label}`);
    return null;
  }
  return num;
}

function normalizeRow(raw: RawImportRow, rowNum: number, errors: string[]): NormalizedRow | null {
  const phaseRaw = typeof raw.phase === "string" ? raw.phase.trim().toUpperCase() : "";
  if (!(TRAINING_PHASES as readonly string[]).includes(phaseRaw)) {
    errors.push(`Zeile ${rowNum}: ungültige Phase "${String(raw.phase ?? "")}"`);
    return null;
  }

  const exerciseName = typeof raw.exerciseName === "string" ? raw.exerciseName.trim() : "";
  if (!exerciseName) {
    errors.push(`Zeile ${rowNum}: fehlender Übungsname`);
    return null;
  }

  return {
    phase: phaseRaw as TrainingPhase,
    exerciseName,
    targetSets: parseOptionalInt(raw.targetSets, "targetSets", rowNum, errors),
    targetReps: parseOptionalInt(raw.targetReps, "targetReps", rowNum, errors),
    order: parseOptionalInt(raw.order, "order", rowNum, errors),
  };
}

// Matches imported rows to existing exercises by name (nameDe, falling back to name), since an
// exerciseId isn't portable across a re-import — the catalog is shared/curated, not something an
// import file should be allowed to create new rows in.
export async function importPlanExercises(
  prisma: PrismaClient,
  userId: string,
  rawRows: RawImportRow[],
): Promise<PlanImportResult> {
  const errors: string[] = [];
  // rowNum starts at 2: row 1 is the header (CSV) / first entry (JSON/XML) is conceptually "row 2"
  // of the source file, keeping error messages consistent across formats.
  const normalized = rawRows
    .map((raw, index) => normalizeRow(raw, index + 2, errors))
    .filter((row): row is NormalizedRow => row !== null);

  if (normalized.length === 0) {
    return { created: 0, updated: 0, errors };
  }

  const exercises = await prisma.exercise.findMany({ select: { id: true, name: true, nameDe: true } });
  const exerciseIdByName = new Map<string, string>();
  for (const exercise of exercises) {
    exerciseIdByName.set(exercise.name.toLowerCase(), exercise.id);
    if (exercise.nameDe) {
      exerciseIdByName.set(exercise.nameDe.toLowerCase(), exercise.id);
    }
  }

  // Sort by the file's own order column so newly created entries keep their relative sequence
  // per phase; rows without an order value sort first but that's a reasonable default, not a
  // correctness requirement (order is display-only).
  normalized.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const nextOrderByPhase = new Map<TrainingPhase, number>();
  let created = 0;
  let updated = 0;

  for (const row of normalized) {
    const exerciseId = exerciseIdByName.get(row.exerciseName.toLowerCase());
    if (!exerciseId) {
      errors.push(`Übung nicht gefunden: "${row.exerciseName}" (Phase ${row.phase})`);
      continue;
    }

    // Import/export doesn't carry `dayLabel` (a CSV/JSON/XML row has no day column) — imported
    // entries are treated the same as manually added ones, ungrouped (`dayLabel: null`).
    // `findFirst` rather than `findUnique`: Prisma's compound-unique-input type doesn't accept
    // `null` for a nullable field even though the underlying index does.
    const existing = await prisma.planExercise.findFirst({
      where: { userId, phase: row.phase, exerciseId, dayLabel: null },
    });

    if (existing) {
      await prisma.planExercise.update({
        where: { id: existing.id },
        data: { targetSets: row.targetSets, targetReps: row.targetReps },
      });
      updated++;
      continue;
    }

    if (!nextOrderByPhase.has(row.phase)) {
      const last = await prisma.planExercise.findFirst({
        where: { userId, phase: row.phase },
        orderBy: { order: "desc" },
      });
      nextOrderByPhase.set(row.phase, last ? last.order + 1 : 0);
    }
    const order = nextOrderByPhase.get(row.phase) as number;
    nextOrderByPhase.set(row.phase, order + 1);

    await prisma.planExercise.create({
      data: {
        userId,
        phase: row.phase,
        exerciseId,
        targetSets: row.targetSets,
        targetReps: row.targetReps,
        order,
      },
    });
    created++;
  }

  return { created, updated, errors };
}
