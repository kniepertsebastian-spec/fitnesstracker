import type { FastifyInstance } from "fastify";
import { nutritionSettingsSchema } from "@fitnesstracker/shared";
import { getNutritionSettings, getTodayTargets, updateNutritionSettings } from "./nutritionTargets.service.js";

export default async function nutritionTargetRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/nutrition/targets/today", async (request) => getTodayTargets(fastify.prisma, request.user.sub));

  fastify.get("/nutrition/settings", async (request) => getNutritionSettings(fastify.prisma, request.user.sub));

  fastify.put("/nutrition/settings", async (request) => {
    const { fatPercentOfRemaining } = nutritionSettingsSchema.parse(request.body);
    return updateNutritionSettings(fastify.prisma, request.user.sub, fatPercentOfRemaining);
  });
}
