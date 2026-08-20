import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createBodyCompositionEntrySchema, updateBodyCompositionEntrySchema } from "@fitnesstracker/shared";
import { createEntry, deleteEntry, listEntries, updateEntry } from "./bodyComposition.service.js";
import { toBodyCompositionEntryDto } from "./bodyComposition.types.js";
import { HttpError } from "../../errors/httpErrors.js";

const idParamSchema = z.object({ id: z.string().uuid() });

export default async function bodyCompositionRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/body-composition", async (request, reply) => {
    const entries = await listEntries(fastify.prisma, request.user.sub);
    return reply.send({ items: entries.map(toBodyCompositionEntryDto) });
  });

  fastify.post("/body-composition", async (request, reply) => {
    const input = createBodyCompositionEntrySchema.parse(request.body);
    const entry = await createEntry(fastify.prisma, request.user.sub, input);
    return reply.code(201).send(toBodyCompositionEntryDto(entry));
  });

  fastify.patch("/body-composition/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = updateBodyCompositionEntrySchema.parse(request.body);
    try {
      const entry = await updateEntry(fastify.prisma, request.user.sub, id, input);
      return reply.send(toBodyCompositionEntryDto(entry));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/body-composition/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    try {
      await deleteEntry(fastify.prisma, request.user.sub, id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
