import type { FastifyInstance } from "fastify";
import { activityReportQuerySchema } from "@fitnesstracker/shared";
import { loadActivityReport } from "./activity.service.js";
import { buildActivityPdf } from "./activityPdf.js";

const stamp = () => new Date().toISOString().slice(0, 10);

export default async function activityRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // The same report the exports are made of, for the in-app week card.
  fastify.get("/activity/report", async (request, reply) => {
    const query = activityReportQuerySchema.parse(request.query);
    return reply.send(await loadActivityReport(fastify.prisma, request.user.sub, { weeks: query.weeks, timeZone: query.tz }));
  });

  fastify.get("/export/activity.json", async (request, reply) => {
    const query = activityReportQuerySchema.parse(request.query);
    const report = await loadActivityReport(fastify.prisma, request.user.sub, { weeks: query.weeks, timeZone: query.tz });
    return reply
      .header("Content-Type", "application/json; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="aktivitaet-${stamp()}.json"`)
      .send(JSON.stringify(report, null, 2));
  });

  fastify.get("/export/activity.pdf", async (request, reply) => {
    const query = activityReportQuerySchema.parse(request.query);
    const report = await loadActivityReport(fastify.prisma, request.user.sub, { weeks: query.weeks, timeZone: query.tz });
    const pdf = await buildActivityPdf(report);
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="aktivitaet-${stamp()}.pdf"`)
      .send(pdf);
  });
}
