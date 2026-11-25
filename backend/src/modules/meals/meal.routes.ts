import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { addMealEntriesSchema, createMealLogSchema, dateRangeQuerySchema, localDateSchema, setRatingSchema } from "@fitnesstracker/shared";
import { BadRequestError } from "../../errors/httpErrors.js";
import {
  addMealEntries,
  createMealLog,
  deleteMealEntry,
  deleteMealLog,
  deleteRating,
  listMealLogs,
  listRatings,
  setRating,
  toMealLogDto,
} from "./meal.service.js";

const idParams = z.object({ id: z.string().uuid() });
const MAX_RANGE_DAYS = 366;

function parseRange(query: unknown) {
  const { from, to } = dateRangeQuerySchema.parse(query);
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days < 0) throw new BadRequestError("from muss vor to liegen");
  if (days >= MAX_RANGE_DAYS) throw new BadRequestError("Höchstens ein Jahr auf einmal");
  return { from, to };
}

export default async function mealRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/nutrition/meals", async (request) => {
    const { from, to } = parseRange(request.query);
    const logs = await listMealLogs(fastify.prisma, request.user.sub, from, to);
    return { items: logs.map((l) => toMealLogDto(l, l.entries)) };
  });

  // Idempotent: the same id again returns the existing meal (200) and adds only new entries.
  fastify.post("/nutrition/meals", async (request, reply) => {
    const { created, log } = await createMealLog(fastify.prisma, request.user.sub, createMealLogSchema.parse(request.body));
    return reply.code(created ? 201 : 200).send(log);
  });

  fastify.post("/nutrition/meals/:id/entries", async (request) => {
    const { id } = idParams.parse(request.params);
    const { entries } = addMealEntriesSchema.parse(request.body);
    return addMealEntries(fastify.prisma, request.user.sub, id, entries);
  });

  fastify.delete("/nutrition/meals/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await deleteMealLog(fastify.prisma, request.user.sub, id);
    return reply.code(204).send();
  });

  fastify.delete("/nutrition/meal-entries/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await deleteMealEntry(fastify.prisma, request.user.sub, id);
    return reply.code(204).send();
  });

  fastify.get("/nutrition/ratings", async (request) => {
    const { from, to } = parseRange(request.query);
    return { items: await listRatings(fastify.prisma, request.user.sub, from, to) };
  });

  fastify.put("/nutrition/ratings/:date", async (request, reply) => {
    const { date } = z.object({ date: localDateSchema }).parse(request.params);
    const { created, rating } = await setRating(fastify.prisma, request.user.sub, date, setRatingSchema.parse(request.body));
    return reply.code(created ? 201 : 200).send(rating);
  });

  fastify.delete("/nutrition/ratings/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await deleteRating(fastify.prisma, request.user.sub, id);
    return reply.code(204).send();
  });
}
