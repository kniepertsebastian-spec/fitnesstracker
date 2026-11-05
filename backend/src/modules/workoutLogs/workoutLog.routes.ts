import type { FastifyInstance } from "fastify";
import { createWorkoutLogSchema, updateWorkoutLogSchema } from "@fitnesstracker/shared";
import {
  checkAndNotifyPersonalRecord,
  createWorkoutLog,
  deleteWorkoutLog,
  listWorkoutLogChanges,
  listWorkoutLogs,
  updateWorkoutLog,
} from "./workoutLog.service.js";
import { toWorkoutLogDto } from "./workoutLog.types.js";
import { muscleVolumeStart, weeklyMuscleSets } from "./muscleVolume.js";
import { HttpError } from "../../errors/httpErrors.js";
import { z } from "zod";

const listQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  exerciseId: z.string().uuid().optional(),
  // Only what changed after this moment (see workoutLogListDtoSchema).
  updatedSince: z.string().datetime().optional(),
});

export default async function workoutLogRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/workout-logs", async (request, reply) => {
    const { updatedSince, ...filters } = listQuerySchema.parse(request.query);
    // Taken before the query: a row written while it runs has an updatedAt after this moment and
    // so shows up in the next delta instead of falling between two requests.
    const serverTime = new Date().toISOString();
    if (updatedSince) {
      const changes = await listWorkoutLogChanges(fastify.prisma, request.user.sub, new Date(updatedSince));
      return reply.send({
        items: changes.items.map(toWorkoutLogDto),
        deletedClientIds: changes.deletedClientIds,
        serverTime,
      });
    }
    const logs = await listWorkoutLogs(fastify.prisma, request.user.sub, filters);
    return reply.send({ items: logs.map(toWorkoutLogDto), deletedClientIds: [], serverTime });
  });

  // Sets per primary muscle and week, for the progress page.
  fastify.get("/workout-logs/muscle-volume", async (request, reply) => {
    const { weeks } = z.object({ weeks: z.coerce.number().int().min(1).max(52).default(12) }).parse(request.query);
    const logs = await fastify.prisma.workoutLog.findMany({
      where: { userId: request.user.sub, deletedAt: null, performedAt: { gte: muscleVolumeStart(weeks) } },
      select: { performedAt: true, exercise: { select: { primaryMuscles: true } } },
    });
    return reply.send(
      weeklyMuscleSets(
        logs.map((l) => ({ performedAt: l.performedAt, primaryMuscles: l.exercise.primaryMuscles })),
        weeks,
      ),
    );
  });

  fastify.post("/workout-logs", async (request, reply) => {
    const input = createWorkoutLogSchema.parse(request.body);
    const wasExisting = await fastify.prisma.workoutLog.findUnique({
      where: { clientId: input.clientId },
    });
    const log = await createWorkoutLog(fastify.prisma, request.user.sub, input);
    // Fire-and-forget: a genuinely new set (not a retried/idempotent upsert of one already
    // synced) may be a personal record, but checking and sending a push shouldn't add latency
    // to the single hottest write endpoint in the app.
    if (!wasExisting) {
      void checkAndNotifyPersonalRecord(fastify.prisma, request.user.sub, {
        id: log.id,
        exerciseId: log.exerciseId,
        reps: log.reps,
        weightKg: Number(log.weightKg),
      }).catch((error) => fastify.log.error(error, "Personal record check failed"));
    }
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
