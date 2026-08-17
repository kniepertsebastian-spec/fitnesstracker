import Fastify, { type FastifyError } from "fastify";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import prismaPlugin from "./plugins/prisma.plugin.js";
import cookiePlugin from "./plugins/cookie.plugin.js";
import corsPlugin from "./plugins/cors.plugin.js";
import jwtPlugin from "./plugins/jwt.plugin.js";
import authHooks from "./modules/auth/auth.hooks.js";
import authRoutes from "./modules/auth/auth.routes.js";
import workoutLogRoutes from "./modules/workoutLogs/workoutLog.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : true,
  });

  // Order matters: prisma/cookie/cors/jwt decorate the instance before any route plugin
  // (including auth.hooks' `authenticate`) can reference those decorations.
  app.register(prismaPlugin);
  app.register(cookiePlugin);
  app.register(corsPlugin);
  app.register(jwtPlugin);
  app.register(authHooks);

  app.get("/api/health", async () => ({ status: "ok" }));

  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(workoutLogRoutes, { prefix: "/api" });

  app.setErrorHandler((error: FastifyError | ZodError, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ message: "Validation error", issues: error.issues });
    }
    app.log.error(error);
    return reply.code(error.statusCode ?? 500).send({ message: error.message ?? "Internal error" });
  });

  return app;
}
