import type { FastifyInstance } from "fastify";
import { nutritionSyncPullQuerySchema, nutritionSyncPushSchema } from "@fitnesstracker/shared";
import { applyPush, pullChanges } from "./nutritionSync.service.js";

export default async function nutritionSyncRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/nutrition/sync", async (request) => {
    const { updatedSince } = nutritionSyncPullQuerySchema.parse(request.query);
    // Taken before the queries: a row written meanwhile has a later updatedAt and comes with the
    // next pull instead of falling between two.
    const serverTime = new Date().toISOString();
    const changes = await pullChanges(fastify.prisma, request.user.sub, updatedSince ? new Date(updatedSince) : null);
    return { ...changes, serverTime };
  });

  fastify.post("/nutrition/sync", async (request) => {
    const push = nutritionSyncPushSchema.parse(request.body);
    const results = await applyPush(fastify.prisma, request.user.sub, push);
    return { results, serverTime: new Date().toISOString() };
  });
}
