import Fastify, { type FastifyError } from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { toErrorResponse } from "./errors/errorResponse.js";
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
import dailyChallengeRoutes from "./modules/dailyChallenge/dailyChallenge.routes.js";
import supplementRoutes from "./modules/supplements/supplement.routes.js";
import supplementScheduler from "./modules/supplements/supplement.scheduler.js";
import bodyCompositionRoutes from "./modules/bodyComposition/bodyComposition.routes.js";
import bodyAnalysisRoutes from "./modules/bodyAnalysis/bodyAnalysis.routes.js";
import progressPhotoRoutes from "./modules/progressPhotos/progressPhoto.routes.js";
import progressPhotoScheduler from "./modules/progressPhotos/progressPhoto.scheduler.js";
import workoutReminderScheduler from "./modules/workoutLogs/workoutReminder.scheduler.js";
import forgottenSessionScheduler from "./modules/workoutSessions/forgottenSession.scheduler.js";
import dailyChallengeScheduler from "./modules/dailyChallenge/dailyChallenge.scheduler.js";
import aiSettingsRoutes from "./modules/aiSettings/aiSettings.routes.js";
import aiPlanGeneratorRoutes from "./modules/aiPlanGenerator/aiPlanGenerator.routes.js";
import cardioLogRoutes from "./modules/cardioLogs/cardioLog.routes.js";
import workoutSessionRoutes from "./modules/workoutSessions/workoutSession.routes.js";
import dataExportRoutes from "./modules/dataExport/dataExport.routes.js";
import stretchingRoutes from "./modules/stretching/stretching.routes.js";
import formAnalysisRoutes from "./modules/formAnalysis/formAnalysis.routes.js";
import cardioPlanRoutes from "./modules/cardioPlan/cardioPlan.routes.js";
import activityRoutes from "./modules/activity/activity.routes.js";
import exerciseImageRoutes from "./modules/exerciseImages/exerciseImage.routes.js";
import healthSyncRoutes, { healthSyncWebhookRoutes } from "./modules/healthSync/healthSync.routes.js";

export function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: options.logger ?? (env.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : true),
    // Behind Caddy/Cloudflare `request.ip` is only the real visitor when the proxy chain is trusted
    // (see TRUST_PROXY in config/env.ts). The per-IP rate limits depend on it.
    trustProxy: env.TRUST_PROXY,
  });

  // Order matters: prisma/cookie/cors/jwt decorate the instance before any route plugin
  // (including auth.hooks' `authenticate`) can reference those decorations.
  app.register(prismaPlugin);
  app.register(cookiePlugin);
  app.register(corsPlugin);
  app.register(jwtPlugin);
  // 10MB per file — enough for photos and short technique clips without unbounded memory use.
  app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  // `global: false` — only routes that opt in via `config: { rateLimit }` (login/register and the
  // expensive routes, see lib/rateLimits.ts) are limited; every other route is unaffected.
  // In-memory store is fine for a single backend instance; if that ever changes, this needs a
  // shared store (e.g. Redis), same as the scheduler locks in lib/schedulerLock.ts.
  app.register(rateLimit, { global: false });
  app.register(authHooks);
  app.register(trainingPlanScheduler);
  app.register(supplementScheduler);
  app.register(progressPhotoScheduler);
  app.register(workoutReminderScheduler);
  app.register(dailyChallengeScheduler);
  app.register(forgottenSessionScheduler);

  // Reports ready only when the database answers too, so the container healthcheck (and the CI
  // wait loop) notice a backend that is up but cut off from Postgres.
  app.get("/api/health", async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch (error) {
      app.log.error(error, "health check: database unreachable");
      return reply.code(503).send({ status: "unavailable" });
    }
  });

  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(exerciseImageRoutes, { prefix: "/api" });
  app.register(exerciseRoutes, { prefix: "/api" });
  app.register(workoutLogRoutes, { prefix: "/api" });
  app.register(trainingPlanRoutes, { prefix: "/api" });
  app.register(planExerciseRoutes, { prefix: "/api" });
  app.register(goalRoutes, { prefix: "/api" });
  app.register(pushRoutes, { prefix: "/api" });
  app.register(profileRoutes, { prefix: "/api" });
  app.register(dailyChallengeRoutes, { prefix: "/api" });
  app.register(supplementRoutes, { prefix: "/api" });
  app.register(bodyCompositionRoutes, { prefix: "/api" });
  app.register(bodyAnalysisRoutes, { prefix: "/api" });
  app.register(progressPhotoRoutes, { prefix: "/api" });
  app.register(aiSettingsRoutes, { prefix: "/api" });
  app.register(aiPlanGeneratorRoutes, { prefix: "/api" });
  app.register(cardioLogRoutes, { prefix: "/api" });
  app.register(workoutSessionRoutes, { prefix: "/api" });
  app.register(dataExportRoutes, { prefix: "/api" });
  app.register(formAnalysisRoutes, { prefix: "/api" });
  app.register(stretchingRoutes, { prefix: "/api" });
  app.register(cardioPlanRoutes, { prefix: "/api" });
  app.register(activityRoutes, { prefix: "/api" });
  app.register(healthSyncRoutes, { prefix: "/api" });
  app.register(healthSyncWebhookRoutes, { prefix: "/api" });

  app.setErrorHandler((error: FastifyError | ZodError, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ message: "Validation error", issues: error.issues });
    }
    app.log.error(error);
    const { statusCode, message } = toErrorResponse(error);
    return reply.code(statusCode).send({ message });
  });

  return app;
}
