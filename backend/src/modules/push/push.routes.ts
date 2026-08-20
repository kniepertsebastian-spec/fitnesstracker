import type { FastifyInstance } from "fastify";
import { pushSubscribeSchema, pushUnsubscribeSchema } from "@fitnesstracker/shared";
import { env } from "../../config/env.js";
import { isPushConfigured, subscribeToPush, unsubscribeFromPush } from "./push.service.js";

export default async function pushRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/push/vapid-public-key", async (_request, reply) => {
    return reply.send({ publicKey: isPushConfigured ? env.VAPID_PUBLIC_KEY : null });
  });

  fastify.post("/push/subscribe", async (request, reply) => {
    const input = pushSubscribeSchema.parse(request.body);
    await subscribeToPush(fastify.prisma, request.user.sub, input);
    return reply.code(204).send();
  });

  fastify.delete("/push/subscribe", async (request, reply) => {
    const input = pushUnsubscribeSchema.parse(request.body);
    await unsubscribeFromPush(fastify.prisma, request.user.sub, input.endpoint);
    return reply.code(204).send();
  });
}
