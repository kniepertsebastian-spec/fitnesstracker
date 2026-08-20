import cors from "@fastify/cors";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

// Only relevant in dev, where frontend (localhost:5173) and backend (localhost:3000) are
// different origins. In prod, Caddy serves both same-origin and this is effectively a no-op
// allowlist of one. Never use origin: '*' — it's incompatible with credentialed cookies anyway.
export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(cors, {
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  });
});
