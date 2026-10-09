import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  resetCardioPlanSchema,
  saveCardioPlanDaySchema,
  saveCardioPlanFreeSchema,
  trainingPhaseSchema,
} from "@fitnesstracker/shared";
import {
  FREE_DAY_KEY,
  getCardioPlan,
  resetCardioPlan,
  saveCardioPlanDay,
  saveCardioPlanFree,
} from "./cardioPlan.service.js";

const planQuerySchema = z.object({ phase: trainingPhaseSchema.optional() });

// Every write answers with the whole (re-derived) plan of that phase, so the client can replace
// its cache in one step instead of refetching.
export default async function cardioPlanRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/cardio/plan", async (request, reply) => {
    const { phase } = planQuerySchema.parse(request.query);
    return reply.send(await getCardioPlan(fastify.prisma, request.user.sub, phase));
  });

  fastify.put("/cardio/plan/day", async (request, reply) => {
    const { phase, dayLabel, items } = saveCardioPlanDaySchema.parse(request.body);
    await saveCardioPlanDay(fastify.prisma, request.user.sub, phase, dayLabel, items);
    return reply.send(await getCardioPlan(fastify.prisma, request.user.sub, phase));
  });

  fastify.put("/cardio/plan/free", async (request, reply) => {
    const { phase, items } = saveCardioPlanFreeSchema.parse(request.body);
    await saveCardioPlanFree(fastify.prisma, request.user.sub, phase, items);
    return reply.send(await getCardioPlan(fastify.prisma, request.user.sub, phase));
  });

  fastify.post("/cardio/plan/reset", async (request, reply) => {
    const { phase, dayLabel, scope } = resetCardioPlanSchema.parse(request.body);
    const dayKey = scope === "free" ? FREE_DAY_KEY : (dayLabel ?? "");
    await resetCardioPlan(fastify.prisma, request.user.sub, phase, dayKey);
    return reply.send(await getCardioPlan(fastify.prisma, request.user.sub, phase));
  });
}
