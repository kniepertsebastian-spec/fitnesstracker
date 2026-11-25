import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nutritionSettingsSchema } from "@fitnesstracker/shared";
import { getBodyTrend, getNutritionSettings, getTodayTargets, updateNutritionSettings } from "./nutritionTargets.service.js";

const bodyTrendQuerySchema = z.object({ days: z.coerce.number().int().min(7).max(90).default(30) });

export default async function nutritionTargetRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/nutrition/targets/today", async (request) => getTodayTargets(fastify.prisma, request.user.sub));

  fastify.get("/nutrition/body-trend", async (request) => {
    const { days } = bodyTrendQuerySchema.parse(request.query);
    return getBodyTrend(fastify.prisma, request.user.sub, days);
  });

  fastify.get("/nutrition/settings", async (request) => getNutritionSettings(fastify.prisma, request.user.sub));

  fastify.put("/nutrition/settings", async (request) => {
    const { fatPercentOfRemaining } = nutritionSettingsSchema.parse(request.body);
    return updateNutritionSettings(fastify.prisma, request.user.sub, fatPercentOfRemaining);
  });
}
