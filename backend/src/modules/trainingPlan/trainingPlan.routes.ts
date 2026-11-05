import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  addTrainingPhase,
  changeTrainingPhase,
  deleteTrainingPhase,
  extendCurrentPhase,
  getCurrentTrainingPlan,
  pauseTrainingPlan,
  renameTrainingPhase,
  restartCurrentPhase,
  resumeTrainingPlan,
  setTrainingGoal,
  updateTrainingPlanRemarks,
} from "./trainingPlan.service.js";
import {
  addTrainingPhaseSchema,
  changeTrainingPhaseSchema,
  renameTrainingPhaseSchema,
  trainingPhaseSchema,
  updateTrainingGoalSchema,
  updateTrainingPlanRemarksSchema,
} from "@fitnesstracker/shared";
import { toTrainingPlanDto } from "./trainingPlan.types.js";
import { HttpError } from "../../errors/httpErrors.js";

const phaseParamSchema = z.object({ phase: trainingPhaseSchema });

export default async function trainingPlanRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/training-plan", async (request, reply) => {
    const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(
      fastify.prisma,
      request.user.sub,
    );
    return reply.send(toTrainingPlanDto(plan, nextRotationOn, history));
  });

  fastify.patch("/training-plan/phase", async (request, reply) => {
    const { phase } = changeTrainingPhaseSchema.parse(request.body);
    try {
      await changeTrainingPhase(fastify.prisma, request.user.sub, phase);
      const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(
        fastify.prisma,
        request.user.sub,
      );
      return reply.send(toTrainingPlanDto(plan, nextRotationOn, history));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.post("/training-plan/phases", async (request, reply) => {
    const input = addTrainingPhaseSchema.parse(request.body);
    try {
      await addTrainingPhase(fastify.prisma, request.user.sub, input);
      const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(
        fastify.prisma,
        request.user.sub,
      );
      return reply.code(201).send(toTrainingPlanDto(plan, nextRotationOn, history));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.patch("/training-plan/phases/:phase", async (request, reply) => {
    const { phase } = phaseParamSchema.parse(request.params);
    const input = renameTrainingPhaseSchema.parse(request.body);
    try {
      await renameTrainingPhase(fastify.prisma, request.user.sub, phase, input);
      const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(
        fastify.prisma,
        request.user.sub,
      );
      return reply.send(toTrainingPlanDto(plan, nextRotationOn, history));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/training-plan/phases/:phase", async (request, reply) => {
    const { phase } = phaseParamSchema.parse(request.params);
    try {
      await deleteTrainingPhase(fastify.prisma, request.user.sub, phase);
      const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(
        fastify.prisma,
        request.user.sub,
      );
      return reply.send(toTrainingPlanDto(plan, nextRotationOn, history));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
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

  fastify.post("/training-plan/extend-phase", async (request, reply) => {
    await extendCurrentPhase(fastify.prisma, request.user.sub);
    const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(fastify.prisma, request.user.sub);
    return reply.send(toTrainingPlanDto(plan, nextRotationOn, history));
  });

  fastify.patch("/training-plan/remarks", async (request, reply) => {
    const { remarks } = updateTrainingPlanRemarksSchema.parse(request.body);
    await updateTrainingPlanRemarks(fastify.prisma, request.user.sub, remarks);
    const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(fastify.prisma, request.user.sub);
    return reply.send(toTrainingPlanDto(plan, nextRotationOn, history));
  });

  fastify.patch("/training-plan/goal", async (request, reply) => {
    const { goal } = updateTrainingGoalSchema.parse(request.body);
    await setTrainingGoal(fastify.prisma, request.user.sub, goal);
    const { plan, nextRotationOn, history } = await getCurrentTrainingPlan(fastify.prisma, request.user.sub);
    return reply.send(toTrainingPlanDto(plan, nextRotationOn, history));
  });
}
