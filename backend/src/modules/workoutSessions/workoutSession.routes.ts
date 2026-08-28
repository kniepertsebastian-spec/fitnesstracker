import type { FastifyInstance } from "fastify";
import { createWorkoutSessionSchema, updateWorkoutSessionSchema } from "@fitnesstracker/shared";
import {
  createWorkoutSession,
  getOpenWorkoutSession,
  updateWorkoutSessionStatus,
} from "./workoutSession.service.js";
import { toWorkoutSessionDto } from "./workoutSession.types.js";
import { HttpError } from "../../errors/httpErrors.js";
import { z } from "zod";

export default async function workoutSessionRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/workout-sessions/open", async (request, reply) => {
    const session = await getOpenWorkoutSession(fastify.prisma, request.user.sub);
    return reply.send(session ? toWorkoutSessionDto(session) : null);
  });

  fastify.post("/workout-sessions", async (request, reply) => {
    const input = createWorkoutSessionSchema.parse(request.body);
    const wasExisting = await fastify.prisma.workoutSession.findUnique({
      where: { clientId: input.clientId },
    });
    const session = await createWorkoutSession(fastify.prisma, request.user.sub, input);
    return reply.code(wasExisting ? 200 : 201).send(toWorkoutSessionDto(session));
  });

  fastify.patch("/workout-sessions/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { status } = updateWorkoutSessionSchema.parse(request.body);
    try {
      const session = await updateWorkoutSessionStatus(fastify.prisma, request.user.sub, id, status);
      return reply.send(toWorkoutSessionDto(session));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
