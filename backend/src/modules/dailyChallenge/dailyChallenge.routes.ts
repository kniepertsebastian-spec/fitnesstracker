import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { addChallengeRepsSchema } from "@fitnesstracker/shared";
import { addReps, getOrCreateTodayChallenge } from "./dailyChallenge.service.js";
import { toDailyChallengeItemDto } from "./dailyChallenge.types.js";
import { HttpError } from "../../errors/httpErrors.js";

const idParamSchema = z.object({ id: z.string().uuid() });

export default async function dailyChallengeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/daily-challenge", async (request, reply) => {
    const items = await getOrCreateTodayChallenge(fastify.prisma, request.user.sub);
    return reply.send({ items: items.map(toDailyChallengeItemDto) });
  });

  fastify.post("/daily-challenge/:id/reps", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = addChallengeRepsSchema.parse(request.body);
    try {
      const item = await addReps(fastify.prisma, request.user.sub, id, input.delta);
      return reply.send(toDailyChallengeItemDto(item));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
