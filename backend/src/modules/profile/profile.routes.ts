import type { FastifyInstance } from "fastify";
import { upsertProfileSchema } from "@fitnesstracker/shared";
import { getProfile, upsertProfile } from "./profile.service.js";
import { toProfileDto } from "./profile.types.js";

export default async function profileRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/profile", async (request, reply) => {
    const profile = await getProfile(fastify.prisma, request.user.sub);
    return reply.send(profile ? toProfileDto(profile) : null);
  });

  fastify.put("/profile", async (request, reply) => {
    const input = upsertProfileSchema.parse(request.body);
    const profile = await upsertProfile(fastify.prisma, request.user.sub, input);
    return reply.send(toProfileDto(profile));
  });
}
