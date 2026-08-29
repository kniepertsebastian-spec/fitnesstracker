import type { FastifyInstance } from "fastify";
import { buildFullBackup, buildWorkoutLogsCsv } from "./dataExport.service.js";

function todayFileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function dataExportRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/export/backup.json", async (request, reply) => {
    const backup = await buildFullBackup(fastify.prisma, request.user.sub);
    return reply
      .header("Content-Disposition", `attachment; filename="fitnesstracker-backup-${todayFileStamp()}.json"`)
      .send(backup);
  });

  fastify.get("/export/workouts.csv", async (request, reply) => {
    const csv = await buildWorkoutLogsCsv(fastify.prisma, request.user.sub);
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="workouts-${todayFileStamp()}.csv"`)
      .send(csv);
  });
}
