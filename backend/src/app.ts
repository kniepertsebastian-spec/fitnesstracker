import Fastify, { type FastifyError } from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import prismaPlugin from "./plugins/prisma.plugin.js";
import cookiePlugin from "./plugins/cookie.plugin.js";
import corsPlugin from "./plugins/cors.plugin.js";
import jwtPlugin from "./plugins/jwt.plugin.js";
import authHooks from "./modules/auth/auth.hooks.js";
import authRoutes from "./modules/auth/auth.routes.js";
import workoutLogRoutes from "./modules/workoutLogs/workoutLog.routes.js";
import exerciseRoutes from "./modules/exercises/exercise.routes.js";
import trainingPlanRoutes from "./modules/trainingPlan/trainingPlan.routes.js";
import trainingPlanScheduler from "./modules/trainingPlan/trainingPlan.scheduler.js";
import planExerciseRoutes from "./modules/trainingPlan/planExercise.routes.js";
import goalRoutes from "./modules/goals/goal.routes.js";
import pushRoutes from "./modules/push/push.routes.js";
import profileRoutes from "./modules/profile/profile.routes.js";
import waterRoutes from "./modules/water/water.routes.js";
import dailyChallengeRoutes from "./modules/dailyChallenge/dailyChallenge.routes.js";
import supplementRoutes from "./modules/supplements/supplement.routes.js";
import supplementScheduler from "./modules/supplements/supplement.scheduler.js";
import bodyCompositionRoutes from "./modules/bodyComposition/bodyComposition.routes.js";
import progressPhotoRoutes from "./modules/progressPhotos/progressPhoto.routes.js";
import progressPhotoScheduler from "./modules/progressPhotos/progressPhoto.scheduler.js";
import aiSettingsRoutes from "./modules/aiSettings/aiSettings.routes.js";
import aiPlanGeneratorRoutes from "./modules/aiPlanGenerator/aiPlanGenerator.routes.js";
import cardioLogRoutes from "./modules/cardioLogs/cardioLog.routes.js";

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
  // 10MB per file — plenty for a phone photo, small enough to keep disk usage sane on the VPS.
  app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  // `global: false` — only routes that opt in via `config: { rateLimit }` (login/register) are
  // limited; every other route is unaffected. In-memory store is fine for a single backend
  // instance; if that ever changes, this needs a shared store (e.g. Redis), same as the
  // scheduler locks in lib/schedulerLock.ts.
  app.register(rateLimit, { global: false });
  app.register(authHooks);
  app.register(trainingPlanScheduler);
  app.register(supplementScheduler);
  app.register(progressPhotoScheduler);

  app.get("/api/health", async () => ({ status: "ok" }));

  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(exerciseRoutes, { prefix: "/api" });
  app.register(workoutLogRoutes, { prefix: "/api" });
  app.register(trainingPlanRoutes, { prefix: "/api" });
  app.register(planExerciseRoutes, { prefix: "/api" });
  app.register(goalRoutes, { prefix: "/api" });
  app.register(pushRoutes, { prefix: "/api" });
  app.register(profileRoutes, { prefix: "/api" });
  app.register(waterRoutes, { prefix: "/api" });
  app.register(dailyChallengeRoutes, { prefix: "/api" });
  app.register(supplementRoutes, { prefix: "/api" });
  app.register(bodyCompositionRoutes, { prefix: "/api" });
  app.register(progressPhotoRoutes, { prefix: "/api" });
  app.register(aiSettingsRoutes, { prefix: "/api" });
  app.register(aiPlanGeneratorRoutes, { prefix: "/api" });
  app.register(cardioLogRoutes, { prefix: "/api" });

  app.setErrorHandler((error: FastifyError | ZodError, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ message: "Validation error", issues: error.issues });
    }
    app.log.error(error);
    return reply.code(error.statusCode ?? 500).send({ message: error.message ?? "Internal error" });
  });

  return app;
}
