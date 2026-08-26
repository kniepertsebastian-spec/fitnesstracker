import type { FastifyInstance } from "fastify";
import { saveAiSettingsSchema } from "@fitnesstracker/shared";
import { deleteAiSettings, getAiSettings, saveAiSettings } from "./aiSettings.service.js";
import { HttpError } from "../../errors/httpErrors.js";

export default async function aiSettingsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/ai-settings", async (request, reply) => {
    const settings = await getAiSettings(fastify.prisma, request.user.sub);
    return reply.send(settings);
  });

  fastify.put("/ai-settings", async (request, reply) => {
    const input = saveAiSettingsSchema.parse(request.body);
    try {
      await saveAiSettings(fastify.prisma, request.user.sub, input);
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
    const settings = await getAiSettings(fastify.prisma, request.user.sub);
    return reply.send(settings);
  });

  fastify.delete("/ai-settings", async (request, reply) => {
    await deleteAiSettings(fastify.prisma, request.user.sub);
    return reply.code(204).send();
  });
}
