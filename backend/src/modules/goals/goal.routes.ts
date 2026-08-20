import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createGoalSchema, updateGoalSchema } from "@fitnesstracker/shared";
import { computeCurrentValue, createGoal, deleteGoal, listGoals, updateGoal } from "./goal.service.js";
import { toGoalDto } from "./goal.types.js";
import { HttpError } from "../../errors/httpErrors.js";

const idParamSchema = z.object({ id: z.string().uuid() });

export default async function goalRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/goals", async (request, reply) => {
    const goals = await listGoals(fastify.prisma, request.user.sub);
    const items = await Promise.all(
      goals.map(async (goal) => {
        const currentValue = await computeCurrentValue(fastify.prisma, request.user.sub, goal);
        return toGoalDto(goal, currentValue);
      }),
    );
    return reply.send({ items });
  });

  fastify.post("/goals", async (request, reply) => {
    const input = createGoalSchema.parse(request.body);
    try {
      const goal = await createGoal(fastify.prisma, request.user.sub, input);
      const currentValue = await computeCurrentValue(fastify.prisma, request.user.sub, goal);
      return reply.code(201).send(toGoalDto(goal, currentValue));
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
      return reply.send(toGoalDto(goal, currentValue));
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
