import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { foodSearchQuerySchema, upsertFoodSchema, upsertFoodUnitSchema } from "@fitnesstracker/shared";
import { NotFoundError } from "../../errors/httpErrors.js";
import { deleteFood, deleteFoodUnit, findFoodByBarcode, getFood, searchFoods, upsertFood, upsertFoodUnit } from "./food.service.js";
import { fetchOpenFoodFacts, type OffFetcher } from "./openFoodFacts.js";

const idParams = z.object({ id: z.string().uuid() });
// Live lookups go out to Open Food Facts: limited per user, the cache answers repeats anyway.
const BARCODE_RATE_LIMIT = { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };

export default async function foodRoutes(fastify: FastifyInstance, opts: { fetchOff?: OffFetcher }) {
  const fetchOff = opts.fetchOff ?? fetchOpenFoodFacts;
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/nutrition/foods/search", async (request) => {
    const { q, limit } = foodSearchQuerySchema.parse(request.query);
    return { items: await searchFoods(fastify.prisma, request.user.sub, q, limit) };
  });

  fastify.get("/nutrition/foods/barcode/:code", BARCODE_RATE_LIMIT, async (request) => {
    const { code } = z.object({ code: z.string().regex(/^\d{6,14}$/) }).parse(request.params);
    const food = await findFoodByBarcode(fastify.prisma, request.user.sub, code, fetchOff);
    if (!food) throw new NotFoundError("Kein Produkt zu diesem Barcode gefunden");
    return food;
  });

  fastify.get("/nutrition/foods/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return getFood(fastify.prisma, request.user.sub, id);
  });

  fastify.put("/nutrition/foods/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return upsertFood(fastify.prisma, request.user.sub, id, upsertFoodSchema.parse(request.body));
  });

  fastify.delete("/nutrition/foods/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await deleteFood(fastify.prisma, request.user.sub, id);
    return reply.code(204).send();
  });

  fastify.put("/nutrition/food-units/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return upsertFoodUnit(fastify.prisma, request.user.sub, id, upsertFoodUnitSchema.parse(request.body));
  });

  fastify.delete("/nutrition/food-units/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await deleteFoodUnit(fastify.prisma, request.user.sub, id);
    return reply.code(204).send();
  });
}
