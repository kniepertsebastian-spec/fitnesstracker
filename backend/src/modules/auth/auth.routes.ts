import type { FastifyInstance } from "fastify";
import { unlink } from "node:fs/promises";
import path from "node:path";
import {
  changePasswordSchema,
  deleteAccountSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateNameSchema,
  updateTimeZoneSchema,
} from "@fitnesstracker/shared";
import {
  changePassword,
  deleteAccount,
  issueRefreshToken,
  registerUser,
  resetPassword,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyCredentials,
} from "./auth.service.js";
import { toUserDto } from "./auth.types.js";
import { HttpError } from "../../errors/httpErrors.js";
import { REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_MS } from "../../lib/tokens.js";
import { env } from "../../config/env.js";

function setRefreshCookie(reply: import("fastify").FastifyReply, token: string) {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_TTL_MS / 1000,
  });
}

// Brute-force protection for the two credential-guessing-prone routes — 5 requests/minute per
// IP (default of AUTH_RATE_LIMIT_PER_MINUTE) is generous for a legitimate login/registration
// attempt but blunts automated guessing.
const AUTH_RATE_LIMIT = { config: { rateLimit: { max: env.AUTH_RATE_LIMIT_PER_MINUTE, timeWindow: "1 minute" } } };

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/register", AUTH_RATE_LIMIT, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    try {
      const user = await registerUser(fastify.prisma, input);
      return reply.code(201).send({ user: toUserDto(user) });
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.post("/login", AUTH_RATE_LIMIT, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    try {
      const user = await verifyCredentials(fastify.prisma, input.email, input.password);
      const accessToken = await reply.jwtSign({ sub: user.id });
      const refreshToken = await issueRefreshToken(fastify.prisma, user.id);
      setRefreshCookie(reply, refreshToken);
      return reply.send({ user: toUserDto(user), accessToken });
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.post("/refresh", async (request, reply) => {
    const rawToken = request.cookies[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      return reply.code(401).send({ message: "Missing refresh token" });
    }
    try {
      const { userId, newRawToken } = await rotateRefreshToken(fastify.prisma, rawToken);
      const accessToken = await reply.jwtSign({ sub: userId });
      setRefreshCookie(reply, newRawToken);
      return reply.send({ accessToken });
    } catch (error) {
      if (error instanceof HttpError) {
        reply.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.post("/logout", async (request, reply) => {
    const rawToken = request.cookies[REFRESH_COOKIE_NAME];
    if (rawToken) {
      await revokeRefreshToken(fastify.prisma, rawToken);
    }
    reply.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    return reply.code(204).send();
  });

  fastify.get("/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    return reply.send(toUserDto(user));
  });

  fastify.put("/me/name", { preHandler: fastify.authenticate }, async (request, reply) => {
    const input = updateNameSchema.parse(request.body);
    const user = await fastify.prisma.user.update({
      where: { id: request.user.sub },
      data: { firstName: input.firstName, lastName: input.lastName },
    });
    return reply.send(toUserDto(user));
  });

  fastify.put("/me/time-zone", { preHandler: fastify.authenticate }, async (request, reply) => {
    const input = updateTimeZoneSchema.parse(request.body);
    const user = await fastify.prisma.user.update({
      where: { id: request.user.sub },
      data: { timeZone: input.timeZone },
    });
    return reply.send(toUserDto(user));
  });

  fastify.put("/me/password", { preHandler: fastify.authenticate, ...AUTH_RATE_LIMIT }, async (request, reply) => {
    const input = changePasswordSchema.parse(request.body);
    try {
      await changePassword(fastify.prisma, request.user.sub, input, request.cookies[REFRESH_COOKIE_NAME]);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
      throw error;
    }
  });

  // No mail delivery exists, so this is gated by the operator's RESET_TOKEN instead of a mailed link.
  fastify.post("/reset-password", AUTH_RATE_LIMIT, async (request, reply) => {
    const input = resetPasswordSchema.parse(request.body);
    try {
      await resetPassword(fastify.prisma, input);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
      throw error;
    }
  });

  fastify.delete("/me", { preHandler: fastify.authenticate, ...AUTH_RATE_LIMIT }, async (request, reply) => {
    const input = deleteAccountSchema.parse(request.body);
    try {
      const filenames = await deleteAccount(fastify.prisma, request.user.sub, input.password);
      await Promise.all(filenames.map((name) => unlink(path.join(path.resolve(env.UPLOADS_DIR), name)).catch(() => undefined)));
      reply.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
      throw error;
    }
  });
}
