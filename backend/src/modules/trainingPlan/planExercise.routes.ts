import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PlanExportFormat } from "@fitnesstracker/shared";
import {
  createPlanExerciseSchema,
  planExportFormatSchema,
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
import { exportPlanExercises, importPlanExercises } from "./planExport.service.js";
import { HttpError } from "../../errors/httpErrors.js";

const idParamSchema = z.object({ id: z.string().uuid() });
const phaseQuerySchema = z.object({ phase: trainingPhaseSchema });
const exportQuerySchema = z.object({ format: planExportFormatSchema });

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

  // Exports the whole plan (all three phases), not just the currently selected one — "export my
  // plan" means the full rotation, not whatever tab happens to be open in the UI.
  fastify.get("/plan-exercises/export", async (request, reply) => {
    const { format } = exportQuerySchema.parse(request.query);
    const rows = await exportPlanExercises(fastify.prisma, request.user.sub);
    const body = format === "csv" ? rowsToCsv(rows) : format === "xml" ? rowsToXml(rows) : rowsToJson(rows);
    reply.header("Content-Type", CONTENT_TYPES[format]);
    reply.header("Content-Disposition", `attachment; filename="trainingsplan.${format}"`);
    return reply.send(body);
  });

  fastify.post("/plan-exercises/import", async (request, reply) => {
    const { format } = exportQuerySchema.parse(request.query);
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ message: "Keine Datei hochgeladen" });
    }
    const text = (await file.toBuffer()).toString("utf-8");

    let rawRows;
    try {
      rawRows = format === "csv" ? parseCsv(text) : format === "xml" ? parseXml(text) : parseJson(text);
    } catch {
      return reply.code(400).send({ message: "Datei konnte nicht gelesen werden — Format prüfen" });
    }

    const result = await importPlanExercises(fastify.prisma, request.user.sub, rawRows);
    return reply.send(result);
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
