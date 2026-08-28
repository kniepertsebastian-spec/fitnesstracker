import type { FastifyInstance } from "fastify";
import {
  getCurrentTrainingPlan,
  pauseTrainingPlan,
  resumeTrainingPlan,
  restartCurrentPhase,
} from "./trainingPlan.service.js";
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

  fastify.post("/training-plan/pause", async (request, reply) => {
    await pauseTrainingPlan(fastify.prisma, request.user.sub);
    const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(
      fastify.prisma,
      request.user.sub,
    );
    return reply.send(toTrainingPlanDto(plan, nextRotationOn, history));
  });

  fastify.post("/training-plan/resume", async (request, reply) => {
    await resumeTrainingPlan(fastify.prisma, request.user.sub);
    const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(
      fastify.prisma,
      request.user.sub,
    );
    return reply.send(toTrainingPlanDto(plan, nextRotationOn, history));
  });

  fastify.post("/training-plan/restart-phase", async (request, reply) => {
    await restartCurrentPhase(fastify.prisma, request.user.sub);
    const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(
      fastify.prisma,
      request.user.sub,
    );
    return reply.send(toTrainingPlanDto(plan, nextRotationOn, history));
  });
}
