import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createExerciseSchema, importExercisesSchema, updateExerciseSchema } from "@fitnesstracker/shared";
import {
  createExercise,
  deleteExercise,
  getExerciseById,
  getExerciseFacets,
  importExercisesFromSource,
  listExercises,
  updateExercise,
} from "./exercise.service.js";
import { toExerciseDto } from "./exercise.types.js";
import { listSourceNames } from "./sources/index.js";
import { HttpError } from "../../errors/httpErrors.js";

const idParamSchema = z.object({ id: z.string().uuid() });
const listQuerySchema = z.object({
  search: z.string().max(200).optional(),
  muscleGroup: z.string().max(200).optional(),
  equipment: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});

export default async function exerciseRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/exercises", async (request, reply) => {
    const filters = listQuerySchema.parse(request.query);
    const { items, total } = await listExercises(fastify.prisma, filters);
    return reply.send({ items: items.map(toExerciseDto), total });
  });

  fastify.get("/exercises/sources", async (_request, reply) => {
    return reply.send({ sources: listSourceNames() });
  });

  fastify.get("/exercises/facets", async (_request, reply) => {
    const facets = await getExerciseFacets(fastify.prisma);
    return reply.send(facets);
  });

  fastify.get("/exercises/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    try {
      const exercise = await getExerciseById(fastify.prisma, id);
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
    const exercise = await createExercise(fastify.prisma, input);
    return reply.code(201).send(toExerciseDto(exercise));
  });

  fastify.patch("/exercises/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = updateExerciseSchema.parse(request.body);
    try {
      const exercise = await updateExercise(fastify.prisma, id, input);
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
      await deleteExercise(fastify.prisma, id);
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
      const summary = await importExercisesFromSource(fastify.prisma, input.source);
      return reply.send(summary);
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
