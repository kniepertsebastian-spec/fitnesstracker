import type { FastifyInstance } from "fastify";
import {
  createSyncToken,
  findSyncToken,
  getSyncStatus,
  ingestActivity,
  markTokenUsed,
  revokeSyncToken,
} from "./healthSync.service.js";
import { extractActivity } from "./healthSync.payload.js";

// 10 MB: a backfill of several years of daily totals and rides is far below it, and the app keeps a
// rejected payload and retries, so a limit that is too small would block the whole outbox.
const WEBHOOK_BODY_LIMIT = 10 * 1024 * 1024;
const WEBHOOK_RATE_LIMIT = { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } };

function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  return match ? match[1] : null;
}

// Token management for the signed-in user (JWT).
export default async function healthSyncRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/health-sync/status", async (request, reply) => {
    return reply.send(await getSyncStatus(fastify.prisma, request.user.sub));
  });

  // Creating a token replaces the old one. The plaintext is in this response and nowhere else.
  fastify.post("/health-sync/token", async (request, reply) => {
    const token = await createSyncToken(fastify.prisma, request.user.sub);
    const status = await getSyncStatus(fastify.prisma, request.user.sub);
    return reply.code(201).send({ token, status });
  });

  fastify.delete("/health-sync/token", async (request, reply) => {
    await revokeSyncToken(fastify.prisma, request.user.sub);
    return reply.code(204).send();
  });
}

// The endpoint the Android companion app posts to. It has no cookie or JWT: the bearer token is
// the credential, so this lives in its own plugin scope without the `authenticate` hook.
export async function healthSyncWebhookRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/health-sync/webhook",
    { bodyLimit: WEBHOOK_BODY_LIMIT, ...WEBHOOK_RATE_LIMIT },
    async (request, reply) => {
      const authHeader = request.headers.authorization;
      const token = bearerToken(authHeader);

      // Nothing from the Authorization header or the token is logged — not even a prefix.
      if (!token) {
        fastify.log.warn({ reason: !authHeader ? "missing_auth_header" : "invalid_format" }, "Webhook 401: Token extraction failed");
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const record = await findSyncToken(fastify.prisma, token);
      if (!record) {
        fastify.log.warn({ reason: "token_not_found_in_db" }, "Webhook 401: Token not found in database");
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const activity = extractActivity(request.body);
      if (!activity) return reply.code(422).send({ message: "Expected a JSON object" });

      // A test ping from the app's settings screen: proves URL and token without touching data.
      if (activity.isTest) {
        await markTokenUsed(fastify.prisma, record.id, null);
        return reply.send({ ok: true, test: true });
      }

      const written = await ingestActivity(fastify.prisma, record.userId, activity);
      await markTokenUsed(fastify.prisma, record.id, activity.sequence);
      return reply.send({ ok: true, ...written });
    },
  );
}
