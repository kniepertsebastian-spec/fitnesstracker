import { activityReportQuerySchema, importActivityDaysSchema, activityWeeklyReportQuerySchema } from "@fitnesstracker/shared";
import { getActivityReport, importActivityDays, loadActivityReport } from "./activity.service.js";
import { buildActivityPdf } from "./activityPdf.js";
import { HttpError } from "../../errors/httpErrors.js";
const stamp = () => new Date().toISOString().slice(0, 10);
export default async function activityRoutes(fastify) {
    fastify.addHook("preHandler", fastify.authenticate);
    // Steps per day + bike sessions for a period (default: the last 4 weeks) — the data behind the
    // printable activity report for insurance purposes.
    fastify.get("/activity/report", async (request, reply) => {
        const query = activityReportQuerySchema.parse(request.query);
        try {
            return reply.send(await getActivityReport(fastify.prisma, request.user.sub, query));
        }
        catch (error) {
            if (error instanceof HttpError)
                return reply.code(error.statusCode).send({ message: error.message });
            throw error;
        }
    });
    fastify.post("/activity/import", async (request, reply) => {
        const input = importActivityDaysSchema.parse(request.body);
        return reply.send(await importActivityDays(fastify.prisma, request.user.sub, input));
    });
    // The comprehensive weekly report (strength, steps, cycling) for exports.
    fastify.get("/activity/weekly-report", async (request, reply) => {
        const query = activityWeeklyReportQuerySchema.parse(request.query);
        return reply.send(await loadActivityReport(fastify.prisma, request.user.sub, { weeks: query.weeks, timeZone: query.tz }));
    });
    fastify.get("/export/activity.json", async (request, reply) => {
        const query = activityWeeklyReportQuerySchema.parse(request.query);
        const report = await loadActivityReport(fastify.prisma, request.user.sub, { weeks: query.weeks, timeZone: query.tz });
        return reply
            .header("Content-Type", "application/json; charset=utf-8")
            .header("Content-Disposition", `attachment; filename="aktivitaet-${stamp()}.json"`)
            .send(JSON.stringify(report, null, 2));
    });
    fastify.get("/export/activity.pdf", async (request, reply) => {
        const query = activityWeeklyReportQuerySchema.parse(request.query);
        const report = await loadActivityReport(fastify.prisma, request.user.sub, { weeks: query.weeks, timeZone: query.tz });
        const pdf = await buildActivityPdf(report);
        return reply
            .header("Content-Type", "application/pdf")
            .header("Content-Disposition", `attachment; filename="aktivitaet-${stamp()}.pdf"`)
            .send(pdf);
    });
}
//# sourceMappingURL=activity.routes.js.map