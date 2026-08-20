import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSupplementSchema, updateSupplementSchema } from "@fitnesstracker/shared";
import {
  createSupplement,
  deleteSupplement,
  listSupplements,
  updateSupplement,
} from "./supplement.service.js";
import { toSupplementDto } from "./supplement.types.js";
import { HttpError } from "../../errors/httpErrors.js";

const idParamSchema = z.object({ id: z.string().uuid() });

export default async function supplementRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/supplements", async (request, reply) => {
    const items = await listSupplements(fastify.prisma, request.user.sub);
    return reply.send({ items: items.map(toSupplementDto) });
  });

  fastify.post("/supplements", async (request, reply) => {
    const input = createSupplementSchema.parse(request.body);
    const supplement = await createSupplement(fastify.prisma, request.user.sub, input);
    return reply.code(201).send(toSupplementDto(supplement));
  });

  fastify.patch("/supplements/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = updateSupplementSchema.parse(request.body);
    try {
      const supplement = await updateSupplement(fastify.prisma, request.user.sub, id, input);
      return reply.send(toSupplementDto(supplement));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/supplements/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    try {
      await deleteSupplement(fastify.prisma, request.user.sub, id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
