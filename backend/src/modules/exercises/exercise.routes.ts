import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createExerciseSchema, importExercisesSchema, updateExerciseSchema } from "@fitnesstracker/shared";
import {
  createExercise,
  deleteExercise,
  getExerciseById,
  getExerciseCatalog,
  getExerciseFacets,
  importExercisesFromSource,
  listExercises,
  updateExercise,
} from "./exercise.service.js";
import { toExerciseDto } from "./exercise.types.js";
import { listSourceNames } from "./sources/index.js";
import { HttpError } from "../../errors/httpErrors.js";
import { HEAVY_RATE_LIMIT } from "../../lib/rateLimits.js";
import { getTranslationState, startDescriptionTranslation } from "./exerciseTranslation.service.js";

const idParamSchema = z.object({ id: z.string().uuid() });
const listQuerySchema = z.object({
  search: z.string().max(200).optional(),
  muscleGroup: z.string().max(200).optional(),
  equipment: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
  includeInactive: z.coerce.boolean().optional(),
});

export default async function exerciseRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/exercises", async (request, reply) => {
    const filters = listQuerySchema.parse(request.query);
    const { items, total } = await listExercises(fastify.prisma, request.user.sub, filters);
    return reply.send({ items: items.map(toExerciseDto), total });
  });

  // Every exercise the user can see, in one response, for the offline copy on the device. Send the
  // `version` from the last answer back to skip the list when nothing changed.
  fastify.get("/exercises/catalog", async (request, reply) => {
    const { version } = z.object({ version: z.string().max(100).optional() }).parse(request.query);
    const catalog = await getExerciseCatalog(fastify.prisma, request.user.sub, version);
    if ("unchanged" in catalog) return reply.send({ version: catalog.version, unchanged: true });
    return reply.send({ version: catalog.version, items: catalog.items.map(toExerciseDto) });
  });

  // Operator only: translate the English descriptions into German with the operator's own AI key.
  fastify.get("/exercises/translate-descriptions", async (request, reply) => {
    return reply.send(await getTranslationState(fastify.prisma, request.user.sub));
  });

  fastify.post("/exercises/translate-descriptions", HEAVY_RATE_LIMIT, async (request, reply) => {
    try {
      return reply.send(await startDescriptionTranslation(fastify.prisma, request.user.sub));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.get("/exercises/sources", async (_request, reply) => {
    return reply.send({ sources: listSourceNames() });
  });

  fastify.get("/exercises/facets", async (request, reply) => {
    const facets = await getExerciseFacets(fastify.prisma, request.user.sub);
    return reply.send(facets);
  });

  fastify.get("/exercises/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    try {
      const exercise = await getExerciseById(fastify.prisma, request.user.sub, id);
      return reply.send(toExerciseDto(exercise));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.post("/exercises", async (request, reply) => {
    const input = createExerciseSchema.parse(request.body);
    const exercise = await createExercise(fastify.prisma, request.user.sub, input);
    return reply.code(201).send(toExerciseDto(exercise));
  });

  fastify.patch("/exercises/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = updateExerciseSchema.parse(request.body);
    try {
      const exercise = await updateExercise(fastify.prisma, request.user.sub, id, input);
      return reply.send(toExerciseDto(exercise));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/exercises/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    try {
      await deleteExercise(fastify.prisma, request.user.sub, id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  // Pulls the full catalog from the given source and upserts it (idempotent by
  // source+sourceId) — safe to call repeatedly to pick up upstream dataset updates.
  fastify.post("/exercises/import", async (request, reply) => {
    const input = importExercisesSchema.parse(request.body);
    try {
      const summary = await importExercisesFromSource(fastify.prisma, request.user.sub, input.source);
      return reply.send(summary);
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
