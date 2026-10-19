import type { FastifyInstance } from "fastify";
import { generatePlanRequestSchema, planPhaseRequestSchema } from "@fitnesstracker/shared";
import {
  acceptPlanDraft,
  discardPlanDraft,
  generatePlan,
  getPlanDraftState,
  getPlanPreferences,
  restorePlanBackup,
} from "./aiPlanGenerator.service.js";

export default async function aiPlanGeneratorRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/ai/generate-plan", async (request, reply) => {
    const input = generatePlanRequestSchema.parse(request.body);
    return reply.send(await generatePlan(fastify.prisma, request.user.sub, input));
  });

  fastify.get("/ai/preferences", async (request, reply) => {
    return reply.send({ preferences: await getPlanPreferences(fastify.prisma, request.user.sub) });
  });

  fastify.get("/ai/plan-draft", async (request, reply) => {
    const { phase } = planPhaseRequestSchema.parse(request.query);
    return reply.send(await getPlanDraftState(fastify.prisma, request.user.sub, phase));
  });

  fastify.delete("/ai/plan-draft", async (request, reply) => {
    const { phase } = planPhaseRequestSchema.parse(request.query);
    await discardPlanDraft(fastify.prisma, request.user.sub, phase);
    return reply.code(204).send();
  });

  fastify.post("/ai/plan-draft/accept", async (request, reply) => {
    const { phase } = planPhaseRequestSchema.parse(request.body);
    return reply.send({ items: await acceptPlanDraft(fastify.prisma, request.user.sub, phase) });
  });

  fastify.post("/ai/plan-backup/restore", async (request, reply) => {
    const { phase } = planPhaseRequestSchema.parse(request.body);
    return reply.send({ items: await restorePlanBackup(fastify.prisma, request.user.sub, phase) });
  });
}
