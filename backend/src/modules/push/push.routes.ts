import type { FastifyInstance } from "fastify";
import { pushSubscribeSchema, pushUnsubscribeSchema, updatePushSettingsSchema } from "@fitnesstracker/shared";
import { env } from "../../config/env.js";
import {
  getPushSettings,
  isPushConfigured,
  subscribeToPush,
  unsubscribeFromPush,
  updatePushSettings,
} from "./push.service.js";

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

  fastify.get("/push/settings", async (request, reply) => {
    const settings = await getPushSettings(fastify.prisma, request.user.sub);
    return reply.send(settings);
  });

  fastify.patch("/push/settings", async (request, reply) => {
    const input = updatePushSettingsSchema.parse(request.body);
    const settings = await updatePushSettings(fastify.prisma, request.user.sub, input);
    return reply.send(settings);
  });
}
