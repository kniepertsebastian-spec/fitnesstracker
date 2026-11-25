import cors from "@fastify/cors";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

// Only relevant for cross-origin setups: in dev, frontend (localhost:5173), Kalorientracker
// (localhost:5174, via CORS_EXTRA_ORIGINS) and backend (localhost:3000) are different origins. In
// prod, Caddy serves each PWA same-origin with its /api, so this is effectively a no-op allowlist.
// Never use origin: '*' — it's incompatible with credentialed cookies anyway.
export function allowedOrigins(): string[] {
  return [...new Set([env.FRONTEND_ORIGIN.replace(/\/+$/, ""), ...env.CORS_EXTRA_ORIGINS])];
}

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(cors, {
    origin: allowedOrigins(),
    credentials: true,
  });
});
