import type { FastifyInstance } from "fastify";
import { HEAVY_RATE_LIMIT } from "../../lib/rateLimits.js";
import { buildFullBackup, buildWorkoutLogsCsv } from "./dataExport.service.js";
import { importBackup } from "./backupImport.service.js";

// A backup of years of sets is a few MB of JSON; Fastify's default of 1 MB would refuse it.
const IMPORT_BODY_LIMIT = 25 * 1024 * 1024;

function todayFileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function dataExportRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/export/backup.json", HEAVY_RATE_LIMIT, async (request, reply) => {
    const backup = await buildFullBackup(fastify.prisma, request.user.sub);
    return reply
      .header("Content-Disposition", `attachment; filename="fitnesstracker-backup-${todayFileStamp()}.json"`)
      .send(backup);
  });

  // Restore into an empty account (Konto neu anlegen, dann die eigene Sicherung einspielen).
  fastify.post("/import/backup.json", { ...HEAVY_RATE_LIMIT, bodyLimit: IMPORT_BODY_LIMIT }, async (request) =>
    importBackup(fastify.prisma, request.user.sub, request.body),
  );

  fastify.get("/export/workouts.csv", HEAVY_RATE_LIMIT, async (request, reply) => {
    const csv = await buildWorkoutLogsCsv(fastify.prisma, request.user.sub);
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="workouts-${todayFileStamp()}.csv"`)
      .send(csv);
  });
}
