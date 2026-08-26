import type { FastifyInstance } from "fastify";
import { addWaterSchema, setWaterTargetSchema } from "@fitnesstracker/shared";
import { addWater, getStatus, setTargetOverride } from "./water.service.js";
import { toWaterStatusDto } from "./water.types.js";

const HISTORY_DAYS = 7;

export default async function waterRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/water", async (request, reply) => {
    const { history, target } = await getStatus(fastify.prisma, request.user.sub, HISTORY_DAYS);
    return reply.send(toWaterStatusDto(history, target));
  });

  fastify.post("/water/log", async (request, reply) => {
    const input = addWaterSchema.parse(request.body);
    await addWater(fastify.prisma, request.user.sub, input.amountMl);
    const { history, target } = await getStatus(fastify.prisma, request.user.sub, HISTORY_DAYS);
    return reply.send(toWaterStatusDto(history, target));
  });

  fastify.put("/water/target", async (request, reply) => {
    const input = setWaterTargetSchema.parse(request.body);
    await setTargetOverride(fastify.prisma, request.user.sub, input.targetMl);
    const { history, target } = await getStatus(fastify.prisma, request.user.sub, HISTORY_DAYS);
    return reply.send(toWaterStatusDto(history, target));
  });
}
