import type { FastifyInstance } from "fastify";
import { createWorkoutLogSchema, updateWorkoutLogSchema } from "@fitnesstracker/shared";
import {
  createWorkoutLog,
  deleteWorkoutLog,
  listExercises,
  listWorkoutLogs,
  updateWorkoutLog,
} from "./workoutLog.service.js";
import { toWorkoutLogDto } from "./workoutLog.types.js";
import { HttpError } from "../../errors/httpErrors.js";
import { z } from "zod";

const listQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  exerciseId: z.string().uuid().optional(),
});

export default async function workoutLogRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/exercises", async (_request, reply) => {
    const exercises = await listExercises(fastify.prisma);
    return reply.send({
      items: exercises.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        videoUrl: e.videoUrl,
      })),
    });
  });

  fastify.get("/workout-logs", async (request, reply) => {
    const filters = listQuerySchema.parse(request.query);
    const logs = await listWorkoutLogs(fastify.prisma, request.user.sub, filters);
    return reply.send({ items: logs.map(toWorkoutLogDto) });
  });

  fastify.post("/workout-logs", async (request, reply) => {
    const input = createWorkoutLogSchema.parse(request.body);
    const wasExisting = await fastify.prisma.workoutLog.findUnique({
      where: { clientId: input.clientId },
    });
    const log = await createWorkoutLog(fastify.prisma, request.user.sub, input);
    return reply.code(wasExisting ? 200 : 201).send(toWorkoutLogDto(log));
  });

  fastify.patch("/workout-logs/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const input = updateWorkoutLogSchema.parse(request.body);
    try {
      const log = await updateWorkoutLog(fastify.prisma, request.user.sub, id, input);
      return reply.send(toWorkoutLogDto(log));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/workout-logs/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    try {
      await deleteWorkoutLog(fastify.prisma, request.user.sub, id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
