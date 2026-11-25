import type { FastifyInstance } from "fastify";
import { nutritionExportQuerySchema } from "@fitnesstracker/shared";
import { BadRequestError } from "../../errors/httpErrors.js";
import { getUserTimeZone, localDayKey } from "../../lib/userTime.js";
import { entryNutrients, listMealLogs, listRatings } from "../meals/meal.service.js";
import { currentTargets } from "../nutritionTargets/nutritionTargets.service.js";
import { buildNutritionPdf } from "./nutritionPdf.js";
import { buildNutritionReport, rangeForDays, reportToCsv, reportToMarkdown } from "./nutritionReport.js";

const MAX_DAYS = 366;
const EXPORT_RATE_LIMIT = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };

export default async function nutritionExportRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/nutrition/export", EXPORT_RATE_LIMIT, async (request, reply) => {
    const query = nutritionExportQuerySchema.parse(request.query);
    const userId = request.user.sub;
    const timeZone = await getUserTimeZone(fastify.prisma, userId);
    const now = new Date();
    const { from, to } = query.days ? rangeForDays(localDayKey(now, timeZone), query.days) : { from: query.from!, to: query.to! };
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 >= MAX_DAYS) throw new BadRequestError("Höchstens ein Jahr auf einmal");

    const [logs, ratings, targets] = await Promise.all([
      listMealLogs(fastify.prisma, userId, from, to),
      listRatings(fastify.prisma, userId, from, to),
      currentTargets(fastify.prisma, userId),
    ]);
    const report = buildNutritionReport({
      from,
      to,
      timeZone,
      generatedAt: now.toISOString(),
      meals: logs.map((l) => ({
        date: l.date.toISOString().slice(0, 10),
        mealType: l.mealType,
        eatenAt: l.eatenAt?.toISOString() ?? null,
        entries: l.entries.map((e) => ({
          name: e.name,
          brand: e.brand,
          quantity: e.quantity,
          unitLabel: e.unitLabel,
          grams: e.grams,
          nutrients: entryNutrients(e),
        })),
      })),
      ratings,
      targets: targets
        ? {
            targetCalories: targets.targetCalories,
            targetProteinG: targets.targetProteinG,
            fatG: targets.macros.fatG,
            carbsG: targets.macros.carbsG,
            nutritionPhase: targets.nutritionPhase,
          }
        : null,
    });

    const name = `ernaehrung-${from}-bis-${to}`;
    switch (query.format) {
      case "pdf":
        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="${name}.pdf"`)
          .send(await buildNutritionPdf(report));
      case "csv":
        return reply
          .header("Content-Type", "text/csv; charset=utf-8")
          .header("Content-Disposition", `attachment; filename="${name}.csv"`)
          .send(`\uFEFF${reportToCsv(report)}`);
      case "md":
        return reply
          .header("Content-Type", "text/markdown; charset=utf-8")
          .header("Content-Disposition", `attachment; filename="${name}.md"`)
          .send(reportToMarkdown(report));
      default:
        return reply.header("Content-Disposition", `attachment; filename="${name}.json"`).send(report);
    }
  });
}
