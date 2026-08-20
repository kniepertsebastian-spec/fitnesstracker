import type { FastifyInstance } from "fastify";
import { getCurrentTrainingPlan } from "./trainingPlan.service.js";
import { toTrainingPlanDto } from "./trainingPlan.types.js";

export default async function trainingPlanRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/training-plan", async (request, reply) => {
    const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(
      fastify.prisma,
      request.user.sub,
    );
    return reply.send(toTrainingPlanDto(plan, nextRotationOn, history));
  });
}
