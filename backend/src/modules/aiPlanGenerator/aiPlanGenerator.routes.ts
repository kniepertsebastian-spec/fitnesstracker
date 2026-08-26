import type { FastifyInstance } from "fastify";
import { generatePlanRequestSchema } from "@fitnesstracker/shared";
import { generatePlan } from "./aiPlanGenerator.service.js";
import { HttpError } from "../../errors/httpErrors.js";

export default async function aiPlanGeneratorRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/ai/generate-plan", async (request, reply) => {
    const input = generatePlanRequestSchema.parse(request.body);
    try {
      const result = await generatePlan(fastify.prisma, request.user.sub, input);
      return reply.send(result);
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
