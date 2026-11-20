import type { Prisma, PrismaClient } from "@prisma/client";
import type { PlanImportMode, PlanImportPreview, PlanImportResult, TrainingPhase } from "@fitnesstracker/shared";
import { TRAINING_PHASES } from "@fitnesstracker/shared";
import { BadRequestError } from "../../errors/httpErrors.js";
import type { PlanExportRow, RawImportRow } from "./planExport.format.js";
import { getOrCreateTrainingPlan } from "./trainingPlan.service.js";
import { resolvePhaseConfigs } from "./trainingPlan.types.js";

// `phase` limits the export to one phase; without it the whole plan is exported.
export async function exportPlanExercises(
  prisma: PrismaClient,
  userId: string,
  phase?: TrainingPhase,
): Promise<PlanExportRow[]> {
  const entries = await prisma.planExercise.findMany({
    where: { userId, ...(phase ? { phase } : {}) },
    orderBy: [{ phase: "asc" }, { order: "asc" }],
    include: { exercise: true, alternativeExercise: true },
  });

  return entries.map((entry) => ({
    phase: entry.phase,
    exerciseName: entry.exercise.nameDe ?? entry.exercise.name,
    targetSets: entry.targetSets,
    targetReps: entry.targetReps,
    order: entry.order,
    dayLabel: entry.dayLabel,
    repRangeMin: entry.repRangeMin,
    repRangeMax: entry.repRangeMax,
    targetRir: entry.targetRir,
    restSeconds: entry.restSeconds,
    notes: entry.notes,
    startWeightKg: entry.startWeightKg === null ? null : Number(entry.startWeightKg),
    alternativeExerciseName: entry.alternativeExercise
      ? (entry.alternativeExercise.nameDe ?? entry.alternativeExercise.name)
      : null,
  }));
}

// A value that is `undefined` was not in the file (leave the stored value alone), `null` was in the
// file but empty (clear it).
type Maybe<T> = T | null | undefined;

export interface NormalizedRow {
  phase: TrainingPhase;
  exerciseName: string;
  targetSets: Maybe<number>;
  targetReps: Maybe<number>;
  order: number | null;
  dayLabel: Maybe<string>;
  repRangeMin: Maybe<number>;
  repRangeMax: Maybe<number>;
  targetRir: Maybe<number>;
  restSeconds: Maybe<number>;
  notes: Maybe<string>;
  startWeightKg: Maybe<number>;
  alternativeExerciseName: Maybe<string>;
}

function isBlank(value: unknown): boolean {
  return value === null || (typeof value === "string" && value.trim() === "");
}

function parseOptionalInt(value: unknown, label: string, rowNum: number, errors: string[]): Maybe<number> {
  if (value === undefined) return undefined;
  if (isBlank(value)) return null;
  const num = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    errors.push(`Zeile ${rowNum}: ungültiger Wert für ${label}`);
    return undefined;
  }
  return num;
}

function parseOptionalDecimal(value: unknown, label: string, rowNum: number, errors: string[]): Maybe<number> {
  if (value === undefined) return undefined;
  if (isBlank(value)) return null;
  const num = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(num) || num < 0) {
    errors.push(`Zeile ${rowNum}: ungültiger Wert für ${label}`);
    return undefined;
  }
  return num;
}

function parseOptionalText(value: unknown, max: number): Maybe<string> {
  if (value === undefined) return undefined;
  if (isBlank(value)) return null;
  return String(value).trim().slice(0, max);
}

export function normalizeRow(raw: RawImportRow, rowNum: number, errors: string[]): NormalizedRow | null {
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

  const order = parseOptionalInt(raw.order, "order", rowNum, errors);
  return {
    phase: phaseRaw as TrainingPhase,
    exerciseName,
    targetSets: parseOptionalInt(raw.targetSets, "targetSets", rowNum, errors),
    targetReps: parseOptionalInt(raw.targetReps, "targetReps", rowNum, errors),
    order: order ?? null,
    dayLabel: parseOptionalText(raw.dayLabel, 120),
    repRangeMin: parseOptionalInt(raw.repRangeMin, "repRangeMin", rowNum, errors),
    repRangeMax: parseOptionalInt(raw.repRangeMax, "repRangeMax", rowNum, errors),
    targetRir: parseOptionalInt(raw.targetRir, "targetRir", rowNum, errors),
    restSeconds: parseOptionalInt(raw.restSeconds, "restSeconds", rowNum, errors),
    notes: parseOptionalText(raw.notes, 300),
    startWeightKg: parseOptionalDecimal(raw.startWeightKg, "startWeightKg", rowNum, errors),
    alternativeExerciseName: parseOptionalText(raw.alternativeExerciseName, 200),
  };
}

// rowNum starts at 2: row 1 is the header (CSV) / first entry (JSON/XML) is conceptually "row 2"
// of the source file, keeping error messages consistent across formats.
export function normalizeRows(rawRows: RawImportRow[]): { rows: NormalizedRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows = rawRows
    .map((raw, index) => normalizeRow(raw, index + 2, errors))
    .filter((row): row is NormalizedRow => row !== null);
  return { rows, errors };
}

// What a file contains, so the user can pick which phase to take over before anything is written.
export function previewPlanImport(rawRows: RawImportRow[]): PlanImportPreview {
  const { rows, errors } = normalizeRows(rawRows);
  const byPhase = new Map<TrainingPhase, { count: number; days: Set<string> }>();
  for (const row of rows) {
    const entry = byPhase.get(row.phase) ?? { count: 0, days: new Set<string>() };
    entry.count += 1;
    if (row.dayLabel) entry.days.add(row.dayLabel);
    byPhase.set(row.phase, entry);
  }
  return {
    phases: [...byPhase.entries()].map(([phase, { count, days }]) => ({ phase, count, days: [...days] })),
    errors,
  };
}

export interface ImportOptions {
  // Take only this phase of the file …
  sourcePhase?: TrainingPhase;
  // … and put it into this phase of the plan (default: each row into the phase it came from).
  targetPhase?: TrainingPhase;
  // merge: update matching entries, add the rest. replace: empty the target phase first.
  mode?: PlanImportMode;
}

// Matches imported rows to existing exercises by name (nameDe, falling back to name), since an
// exerciseId isn't portable across a re-import — the catalog is shared/curated, not something an
// import file should be allowed to create new rows in.
//
// Only plan entries are written. The rotation (current phase, start week, extension) and the
// training history stay as they are, so a phase can be taken over in the middle of a week.
export async function importPlanExercises(
  prisma: PrismaClient,
  userId: string,
  rawRows: RawImportRow[],
  options: ImportOptions = {},
): Promise<PlanImportResult> {
  const { rows: allRows, errors } = normalizeRows(rawRows);
  const mode = options.mode ?? "merge";
  const rows = options.sourcePhase ? allRows.filter((r) => r.phase === options.sourcePhase) : allRows;
  const targetOf = (row: NormalizedRow): TrainingPhase => options.targetPhase ?? row.phase;

  if (rows.length === 0) {
    return { created: 0, updated: 0, deleted: 0, errors };
  }

  const plan = await getOrCreateTrainingPlan(prisma, userId);
  const knownPhases = new Set(resolvePhaseConfigs(plan.phaseConfigs).map((c) => c.phase));
  const targets = [...new Set(rows.map(targetOf))];
  const unknown = targets.filter((phase) => !knownPhases.has(phase));
  if (unknown.length > 0) {
    throw new BadRequestError(`Die Phase ${unknown.join(", ")} gibt es in deinem Plan nicht.`);
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
  const sorted = [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return prisma.$transaction(async (tx) => {
    let deleted = 0;
    if (mode === "replace") {
      for (const phase of targets) {
        deleted += (await tx.planExercise.deleteMany({ where: { userId, phase } })).count;
      }
    }

    const nextOrderByPhase = new Map<TrainingPhase, number>();
    let created = 0;
    let updated = 0;

    for (const row of sorted) {
      const exerciseId = exerciseIdByName.get(row.exerciseName.toLowerCase());
      const phase = targetOf(row);
      if (!exerciseId) {
        errors.push(`Übung nicht gefunden: "${row.exerciseName}" (Phase ${row.phase})`);
        continue;
      }

      let alternativeExerciseId: string | null | undefined;
      if (row.alternativeExerciseName === undefined) {
        alternativeExerciseId = undefined;
      } else if (row.alternativeExerciseName === null) {
        alternativeExerciseId = null;
      } else {
        alternativeExerciseId = exerciseIdByName.get(row.alternativeExerciseName.toLowerCase()) ?? null;
        if (!alternativeExerciseId) {
          errors.push(`Alternative nicht gefunden: "${row.alternativeExerciseName}" (bei "${row.exerciseName}")`);
        }
      }

      // The day label is part of an entry's identity (the same exercise may sit on two days). A file
      // without the column leaves it empty, as before.
      const dayLabel = row.dayLabel ?? null;
      const fields: Prisma.PlanExerciseUncheckedUpdateInput = {
        targetSets: row.targetSets,
        targetReps: row.targetReps,
        repRangeMin: row.repRangeMin,
        repRangeMax: row.repRangeMax,
        targetRir: row.targetRir,
        restSeconds: row.restSeconds,
        notes: row.notes,
        startWeightKg: row.startWeightKg,
        alternativeExerciseId,
      };

      // `findFirst` rather than `findUnique`: Prisma's compound-unique-input type doesn't accept
      // `null` for a nullable field even though the underlying index does.
      const existing = await tx.planExercise.findFirst({ where: { userId, phase, exerciseId, dayLabel } });
      if (existing) {
        await tx.planExercise.update({ where: { id: existing.id }, data: fields });
        updated++;
        continue;
      }

      if (!nextOrderByPhase.has(phase)) {
        const last = await tx.planExercise.findFirst({ where: { userId, phase }, orderBy: { order: "desc" } });
        nextOrderByPhase.set(phase, last ? last.order + 1 : 0);
      }
      const order = nextOrderByPhase.get(phase) as number;
      nextOrderByPhase.set(phase, order + 1);

      await tx.planExercise.create({
        data: {
          userId,
          phase,
          exerciseId,
          dayLabel,
          order,
          targetSets: row.targetSets ?? null,
          targetReps: row.targetReps ?? null,
          repRangeMin: row.repRangeMin ?? null,
          repRangeMax: row.repRangeMax ?? null,
          targetRir: row.targetRir ?? null,
          restSeconds: row.restSeconds ?? null,
          notes: row.notes ?? null,
          startWeightKg: row.startWeightKg ?? null,
          alternativeExerciseId: alternativeExerciseId ?? null,
        },
      });
      created++;
    }

    return { created, updated, deleted, errors };
  });
}
