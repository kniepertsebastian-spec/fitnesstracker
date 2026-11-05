import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  generateStretchPlanRequestSchema,
  stretchFocusMuscleSchema,
  trainingPhaseSchema,
} from "@fitnesstracker/shared";
import { HttpError } from "../../errors/httpErrors.js";
import {
  generateStretchPlan,
  getDailyStretch,
  getStretchPlan,
  resetStretchPlan,
} from "./stretching.service.js";

const planQuerySchema = z.object({ phase: trainingPhaseSchema.optional() });
const dailyQuerySchema = z.object({ focus: stretchFocusMuscleSchema.optional() });

export default async function stretchingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/stretching/plan", async (request, reply) => {
    const { phase } = planQuerySchema.parse(request.query);
    return reply.send(await getStretchPlan(fastify.prisma, request.user.sub, phase));
  });

  fastify.post("/stretching/plan/generate", async (request, reply) => {
    const { phase } = generateStretchPlanRequestSchema.parse(request.body);
    try {
      return reply.send(await generateStretchPlan(fastify.prisma, request.user.sub, phase));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/stretching/plan", async (request, reply) => {
    const { phase } = z.object({ phase: trainingPhaseSchema }).parse(request.query);
    await resetStretchPlan(fastify.prisma, request.user.sub, phase);
    return reply.code(204).send();
  });

  fastify.get("/stretching/daily", async (request, reply) => {
    const { focus } = dailyQuerySchema.parse(request.query);
    return reply.send(await getDailyStretch(fastify.prisma, request.user.sub, focus ?? null));
  });
}
