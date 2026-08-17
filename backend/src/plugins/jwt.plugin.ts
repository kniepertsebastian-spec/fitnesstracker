import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

// Access tokens only — refresh tokens are opaque random strings hashed in the DB (see lib/tokens.ts),
// not JWTs, so they can be revoked/rotated server-side.
export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: "15m" },
  });
});
