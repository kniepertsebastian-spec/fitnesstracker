import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createBodyCompositionEntrySchema,
  importBodyCompositionSchema,
  saveScaleReportSchema,
  updateBodyCompositionEntrySchema,
} from "@fitnesstracker/shared";
import { createEntry, deleteEntry, importEntries, listEntries, saveScaleReport, updateEntry } from "./bodyComposition.service.js";
import { parseFitdaysReport } from "./scaleReport.parser.js";
import { recognizeImageText } from "../../lib/imageOcr.js";
import { resolveTimeZone } from "../activity/activity.service.js";
import { toBodyCompositionEntryDto } from "./bodyComposition.types.js";
import { HttpError } from "../../errors/httpErrors.js";

const idParamSchema = z.object({ id: z.string().uuid() });
const reportQuerySchema = z.object({ tz: z.string().min(1).max(64).optional() });

export default async function bodyCompositionRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/body-composition", async (request, reply) => {
    const entries = await listEntries(fastify.prisma, request.user.sub);
    return reply.send({ items: entries.map(toBodyCompositionEntryDto) });
  });

  fastify.post("/body-composition", async (request, reply) => {
    const input = createBodyCompositionEntrySchema.parse(request.body);
    const entry = await createEntry(fastify.prisma, request.user.sub, input);
    return reply.code(201).send(toBodyCompositionEntryDto(entry));
  });

  fastify.post("/body-composition/import", async (request, reply) => {
    const input = importBodyCompositionSchema.parse(request.body);
    return reply.send(await importEntries(fastify.prisma, request.user.sub, input));
  });

  // Reads a scale-report screenshot (no AI): returns the values, the checks they passed and the
  // ones that need a look. Nothing is stored until the draft is confirmed with POST .../report.
  fastify.post("/body-composition/report/parse", async (request, reply) => {
    const query = reportQuerySchema.parse(request.query);
    const upload = await request.file();
    if (!upload) return reply.code(400).send({ message: "Bitte einen Screenshot des Berichts auswählen." });
    const image = await upload.toBuffer();
    try {
      const text = await recognizeImageText(image, upload.mimetype);
      return reply.send(parseFitdaysReport(text, resolveTimeZone(query.tz)));
    } catch (error) {
      if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
      throw error;
    }
  });

  fastify.post("/body-composition/report", async (request, reply) => {
    const input = saveScaleReportSchema.parse(request.body);
    const entry = await saveScaleReport(fastify.prisma, request.user.sub, input);
    return reply.code(201).send(toBodyCompositionEntryDto(entry));
  });

  fastify.patch("/body-composition/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = updateBodyCompositionEntrySchema.parse(request.body);
    try {
      const entry = await updateEntry(fastify.prisma, request.user.sub, id, input);
      return reply.send(toBodyCompositionEntryDto(entry));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/body-composition/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    try {
      await deleteEntry(fastify.prisma, request.user.sub, id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
