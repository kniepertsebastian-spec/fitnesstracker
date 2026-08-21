import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPlanExerciseSchema, trainingPhaseSchema, updatePlanExerciseSchema } from "@fitnesstracker/shared";
import {
  createPlanExercise,
  deletePlanExercise,
  listPlanExercises,
  updatePlanExercise,
} from "./planExercise.service.js";
import { toPlanExerciseDto } from "./planExercise.types.js";
import { HttpError } from "../../errors/httpErrors.js";

const idParamSchema = z.object({ id: z.string().uuid() });
const phaseQuerySchema = z.object({ phase: trainingPhaseSchema });

export default async function planExerciseRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/plan-exercises", async (request, reply) => {
    const { phase } = phaseQuerySchema.parse(request.query);
    const entries = await listPlanExercises(fastify.prisma, request.user.sub, phase);
    return reply.send({ items: entries.map(toPlanExerciseDto) });
  });

  fastify.post("/plan-exercises", async (request, reply) => {
    const input = createPlanExerciseSchema.parse(request.body);
    try {
      const entry = await createPlanExercise(fastify.prisma, request.user.sub, input);
      return reply.code(201).send(toPlanExerciseDto(entry));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.patch("/plan-exercises/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = updatePlanExerciseSchema.parse(request.body);
    try {
      const entry = await updatePlanExercise(fastify.prisma, request.user.sub, id, input);
      return reply.send(toPlanExerciseDto(entry));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/plan-exercises/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    try {
      await deletePlanExercise(fastify.prisma, request.user.sub, id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
