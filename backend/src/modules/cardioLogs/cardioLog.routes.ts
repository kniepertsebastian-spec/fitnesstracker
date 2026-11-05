import type { FastifyInstance } from "fastify";
import { createCardioLogSchema } from "@fitnesstracker/shared";
import { createCardioLog, deleteCardioLog, listTodayCardioLogs, listWeekCardioLogs } from "./cardioLog.service.js";
import { toCardioLogDto } from "./cardioLog.types.js";
import { HttpError } from "../../errors/httpErrors.js";
import { z } from "zod";

export default async function cardioLogRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/cardio-logs", async (request, reply) => {
    const logs = await listTodayCardioLogs(fastify.prisma, request.user.sub);
    return reply.send({ items: logs.map(toCardioLogDto) });
  });

  // This week's sessions (Mon–now) for the Daily page's weekly totals.
  fastify.get("/cardio-logs/week", async (request, reply) => {
    const logs = await listWeekCardioLogs(fastify.prisma, request.user.sub);
    return reply.send({ items: logs.map(toCardioLogDto) });
  });

  fastify.post("/cardio-logs", async (request, reply) => {
    const input = createCardioLogSchema.parse(request.body);
    try {
      const log = await createCardioLog(fastify.prisma, request.user.sub, input);
      return reply.code(201).send(toCardioLogDto(log));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/cardio-logs/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    try {
      await deleteCardioLog(fastify.prisma, request.user.sub, id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
