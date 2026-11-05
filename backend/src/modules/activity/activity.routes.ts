import type { FastifyInstance } from "fastify";
import { activityReportQuerySchema, importActivityDaysSchema } from "@fitnesstracker/shared";
import { getActivityReport, importActivityDays } from "./activity.service.js";
import { HttpError } from "../../errors/httpErrors.js";

export default async function activityRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // Steps per day + bike sessions for a period (default: the last 4 weeks) — the data behind the
  // printable activity report.
  fastify.get("/activity/report", async (request, reply) => {
    const query = activityReportQuerySchema.parse(request.query);
    try {
      return reply.send(await getActivityReport(fastify.prisma, request.user.sub, query));
    } catch (error) {
      if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
      throw error;
    }
  });

  fastify.post("/activity/import", async (request, reply) => {
    const input = importActivityDaysSchema.parse(request.body);
    return reply.send(await importActivityDays(fastify.prisma, request.user.sub, input));
  });
}
