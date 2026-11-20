import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PlanExportFormat } from "@fitnesstracker/shared";
import {
  createPlanExerciseSchema,
  planExportFormatSchema,
  planImportModeSchema,
  trainingPhaseSchema,
  updatePlanExerciseSchema,
} from "@fitnesstracker/shared";
import {
  createPlanExercise,
  deletePlanExercise,
  listPlanExercises,
  updatePlanExercise,
} from "./planExercise.service.js";
import { toPlanExerciseDto } from "./planExercise.types.js";
import { parseCsv, parseJson, parseXml, rowsToCsv, rowsToJson, rowsToXml } from "./planExport.format.js";
import { exportPlanExercises, importPlanExercises, previewPlanImport } from "./planExport.service.js";
import { getWeeklyPlanStatus } from "./planWeekStatus.service.js";
import { HttpError } from "../../errors/httpErrors.js";
import { visibleToUser } from "../exercises/exercise.service.js";
import { alternativesFor, loadOptionPool } from "./exerciseOptions.js";

const idParamSchema = z.object({ id: z.string().uuid() });
const phaseQuerySchema = z.object({ phase: trainingPhaseSchema });
const exportQuerySchema = z.object({ format: planExportFormatSchema, phase: trainingPhaseSchema.optional() });
const importQuerySchema = z.object({
  format: planExportFormatSchema,
  sourcePhase: trainingPhaseSchema.optional(),
  targetPhase: trainingPhaseSchema.optional(),
  mode: planImportModeSchema.optional(),
});
const previewQuerySchema = z.object({ format: planExportFormatSchema });
const alternativesQuerySchema = z.object({
  exerciseId: z.string().uuid(),
  // Exercises already on the day, comma separated — not offered again.
  exclude: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter((id) => z.string().uuid().safeParse(id).success) : [])),
});

const CONTENT_TYPES: Record<PlanExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
};

export default async function planExerciseRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/plan-exercises", async (request, reply) => {
    const { phase } = phaseQuerySchema.parse(request.query);
    const entries = await listPlanExercises(fastify.prisma, request.user.sub, phase);
    return reply.send({ items: entries.map(toPlanExerciseDto) });
  });

  // Drives the dashboard's progressive day unlock — see planWeekStatus.service.ts.
  fastify.get("/plan-exercises/week-status", async (request, reply) => {
    const { phase } = phaseQuerySchema.parse(request.query);
    const status = await getWeeklyPlanStatus(fastify.prisma, request.user.sub, phase);
    return reply.send(status);
  });

  // Short list of direct replacements for one exercise (same muscles, allowed equipment, nothing
  // the user wants to avoid) — see alternativesFor in exerciseOptions.ts.
  fastify.get("/plan-exercises/alternatives", async (request, reply) => {
    const { exerciseId, exclude } = alternativesQuerySchema.parse(request.query);
    const userId = request.user.sub;
    const exercise = await fastify.prisma.exercise.findFirst({
      where: { id: exerciseId, ...visibleToUser(userId) },
      select: { id: true, primaryMuscles: true },
    });
    if (!exercise) return reply.code(404).send({ message: "Übung nicht gefunden" });
    const pool = await loadOptionPool(fastify.prisma, userId);
    return reply.send({ items: alternativesFor(pool, exercise, new Set(exclude)) });
  });

  // Exports the whole plan (all phases) or, with `phase`, just that one — the latter is what lets a
  // single phase be carried over into another phase or account.
  fastify.get("/plan-exercises/export", async (request, reply) => {
    const { format, phase } = exportQuerySchema.parse(request.query);
    const rows = await exportPlanExercises(fastify.prisma, request.user.sub, phase);
    const body = format === "csv" ? rowsToCsv(rows) : format === "xml" ? rowsToXml(rows) : rowsToJson(rows);
    reply.header("Content-Type", CONTENT_TYPES[format]);
    reply.header(
      "Content-Disposition",
      `attachment; filename="trainingsplan${phase ? `-${phase.toLowerCase()}` : ""}.${format}"`,
    );
    return reply.send(body);
  });

  async function readRows(request: import("fastify").FastifyRequest, format: PlanExportFormat) {
    const file = await request.file();
    if (!file) return { error: "Keine Datei hochgeladen" } as const;
    const text = (await file.toBuffer()).toString("utf-8");
    try {
      const rows = format === "csv" ? parseCsv(text) : format === "xml" ? parseXml(text) : parseJson(text);
      return { rows } as const;
    } catch {
      return { error: "Datei konnte nicht gelesen werden — Format prüfen" } as const;
    }
  }

  // Shows what a file contains (phases, entry counts, days) without writing anything.
  fastify.post("/plan-exercises/import/preview", async (request, reply) => {
    const { format } = previewQuerySchema.parse(request.query);
    const read = await readRows(request, format);
    if ("error" in read) return reply.code(400).send({ message: read.error });
    return reply.send(previewPlanImport(read.rows));
  });

  fastify.post("/plan-exercises/import", async (request, reply) => {
    const { format, sourcePhase, targetPhase, mode } = importQuerySchema.parse(request.query);
    const read = await readRows(request, format);
    if ("error" in read) return reply.code(400).send({ message: read.error });
    try {
      const result = await importPlanExercises(fastify.prisma, request.user.sub, read.rows, {
        sourcePhase,
        targetPhase,
        mode,
      });
      return reply.send(result);
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.post("/plan-exercises", async (request, reply) => {
    const input = createPlanExerciseSchema.parse(request.body);
    try {
      const entry = await createPlanExercise(fastify.prisma, request.user.sub, input);
      return reply.code(201).send(toPlanExerciseDto(entry));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.patch("/plan-exercises/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = updatePlanExerciseSchema.parse(request.body);
    try {
      const entry = await updatePlanExercise(fastify.prisma, request.user.sub, id, input);
      return reply.send(toPlanExerciseDto(entry));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/plan-exercises/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    try {
      await deletePlanExercise(fastify.prisma, request.user.sub, id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
