import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createGoalSchema, updateGoalSchema } from "@fitnesstracker/shared";
import {
  autoAchieveIfDue,
  computeCurrentValue,
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
} from "./goal.service.js";
import { getGoalSuggestions } from "./goalSuggestion.service.js";
import { toGoalDto, toGoalSuggestionDto } from "./goal.types.js";
import { HttpError } from "../../errors/httpErrors.js";

const idParamSchema = z.object({ id: z.string().uuid() });

export default async function goalRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/goals", async (request, reply) => {
    const goals = await listGoals(fastify.prisma, request.user.sub);
    const items = await Promise.all(
      goals.map(async (goal) => {
        const currentValue = await computeCurrentValue(fastify.prisma, request.user.sub, goal);
        const resolved = await autoAchieveIfDue(fastify.prisma, goal, currentValue);
        return toGoalDto(resolved, currentValue);
      }),
    );
    return reply.send({ items });
  });

  fastify.get("/goals/suggestions", async (request, reply) => {
    const suggestions = await getGoalSuggestions(fastify.prisma, request.user.sub);
    return reply.send({ items: suggestions.map(toGoalSuggestionDto) });
  });

  fastify.post("/goals", async (request, reply) => {
    const input = createGoalSchema.parse(request.body);
    try {
      const goal = await createGoal(fastify.prisma, request.user.sub, input);
      const currentValue = await computeCurrentValue(fastify.prisma, request.user.sub, goal);
      const resolved = await autoAchieveIfDue(fastify.prisma, goal, currentValue);
      return reply.code(201).send(toGoalDto(resolved, currentValue));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.patch("/goals/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = updateGoalSchema.parse(request.body);
    try {
      const goal = await updateGoal(fastify.prisma, request.user.sub, id, input);
      const currentValue = await computeCurrentValue(fastify.prisma, request.user.sub, goal);
      const resolved = await autoAchieveIfDue(fastify.prisma, goal, currentValue);
      return reply.send(toGoalDto(resolved, currentValue));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/goals/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    try {
      await deleteGoal(fastify.prisma, request.user.sub, id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
