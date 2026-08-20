import type { FastifyInstance } from "fastify";
import { loginSchema, registerSchema } from "@fitnesstracker/shared";
import {
  issueRefreshToken,
  registerUser,
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

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/register", async (request, reply) => {
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

  fastify.post("/login", async (request, reply) => {
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
}
