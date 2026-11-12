import { DEFAULT_REPORT_DAYS, MAX_REPORT_DAYS, } from "@fitnesstracker/shared";
import { BadRequestError } from "../../errors/httpErrors.js";
import { addDays, composeActivityReport, DEFAULT_TIME_ZONE, isValidTimeZone, reportRange } from "./activityReport.js";
const DAY_MS = 86_400_000;
function isoDay(date) {
    return date.toISOString().slice(0, 10);
}
function parseDay(value) {
    return new Date(`${value}T00:00:00.000Z`);
}
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
// --- Insurance report (date range based) ---
// `to` defaults to today and `from` to 4 weeks before it (inclusive, so 28 days). Same UTC
// calendar-day convention as the rest of the app's date ranges.
export function resolveReportRange(query, now = new Date()) {
    const to = query.to ?? isoDay(now);
    const from = query.from ?? isoDay(new Date(parseDay(to).getTime() - (DEFAULT_REPORT_DAYS - 1) * DAY_MS));
    const span = (parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS + 1;
    if (Number.isNaN(span) || span < 1)
        throw new BadRequestError("'from' must not be after 'to'");
    if (span > MAX_REPORT_DAYS)
        throw new BadRequestError(`The report covers at most ${MAX_REPORT_DAYS} days`);
    return { from, to };
}
// Pure so the sums can be tested without a database.
export function buildActivityReport(input) {
    const days = input.days.map((d) => ({
        date: isoDay(d.date),
        steps: d.steps,
        distanceKm: round2(Number(d.distanceKm.toString())),
        source: d.source,
    }));
    const bikeSessions = input.bike.map((b) => ({
        performedAt: b.performedAt.toISOString(),
        machine: b.machine,
        durationMinutes: b.durationMinutes,
        distanceKm: b.distanceKm === null ? null : round2(Number(b.distanceKm.toString())),
        source: b.source,
    }));
    return {
        firstName: input.user.firstName,
        lastName: input.user.lastName,
        email: input.user.email,
        from: input.from,
        to: input.to,
        generatedAt: (input.now ?? new Date()).toISOString(),
        days,
        bikeSessions,
        totals: {
            steps: days.reduce((sum, d) => sum + d.steps, 0),
            stepsDistanceKm: round1(days.reduce((sum, d) => sum + d.distanceKm, 0)),
            daysWithSteps: days.filter((d) => d.steps > 0).length,
            bikeSessions: bikeSessions.length,
            bikeKm: round1(bikeSessions.reduce((sum, b) => sum + (b.distanceKm ?? 0), 0)),
            bikeMinutes: bikeSessions.reduce((sum, b) => sum + b.durationMinutes, 0),
            manualBikeSessions: bikeSessions.filter((b) => b.source === "MANUAL").length,
        },
    };
}
export async function getActivityReport(prisma, userId, query) {
    const { from, to } = resolveReportRange(query);
    const start = parseDay(from);
    const endExclusive = new Date(parseDay(to).getTime() + DAY_MS);
    const [user, days, bike] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } }),
        prisma.activityDay.findMany({
            where: { userId, date: { gte: start, lt: endExclusive } },
            orderBy: { date: "asc" },
        }),
        prisma.cardioLog.findMany({
            where: { userId, deletedAt: null, machine: "BIKE", performedAt: { gte: start, lt: endExclusive } },
            orderBy: { performedAt: "asc" },
        }),
    ]);
    return buildActivityReport({ user, from, to, days, bike });
}
// A day is rewritten when it is imported again — the export's value for that day is the truth,
// never added on top of what is already stored.
export async function importActivityDays(prisma, userId, input, source = "IMPORT") {
    const dates = input.days.map((d) => parseDay(d.date));
    const existing = await prisma.activityDay.findMany({
        where: { userId, date: { in: dates } },
        select: { date: true },
    });
    const known = new Set(existing.map((e) => isoDay(e.date)));
    await prisma.$transaction(input.days.map((d) => prisma.activityDay.upsert({
        where: { userId_date: { userId, date: parseDay(d.date) } },
        create: { userId, date: parseDay(d.date), steps: d.steps, distanceKm: d.distanceKm, source },
        update: { steps: d.steps, distanceKm: d.distanceKm, source },
    })));
    const updated = input.days.filter((d) => known.has(d.date)).length;
    return { imported: input.days.length - updated, updated };
}
// --- Weekly comprehensive report (for exports with strength training) ---
export function resolveTimeZone(requested) {
    return requested && isValidTimeZone(requested) ? requested : DEFAULT_TIME_ZONE;
}
// Reads the rows of the last `weeks` weeks and hands them to the pure composer. Rows are fetched
// with a day of slack on both sides because the week borders are cut at local midnight, which can
// be up to 14 hours away from UTC midnight.
export async function loadActivityReport(prisma, userId, options) {
    const timeZone = resolveTimeZone(options.timeZone);
    const now = options.now ?? new Date();
    const { firstMonday, lastSunday } = reportRange(options.weeks, timeZone, now);
    const from = new Date(`${addDays(firstMonday, -1)}T00:00:00.000Z`);
    const until = new Date(`${addDays(lastSunday, 2)}T00:00:00.000Z`);
    const [sets, studioBike, days, rides] = await Promise.all([
        prisma.workoutLog.findMany({
            where: { userId, deletedAt: null, performedAt: { gte: from, lt: until } },
            select: { performedAt: true, reps: true, weightKg: true, rir: true, exercise: { select: { primaryMuscles: true } } },
        }),
        prisma.cardioLog.findMany({
            where: { userId, deletedAt: null, machine: "BIKE", performedAt: { gte: from, lt: until } },
            select: { performedAt: true, durationMinutes: true },
        }),
        prisma.dailyActivity.findMany({
            where: { userId, date: { gte: new Date(`${firstMonday}T00:00:00.000Z`), lte: new Date(`${lastSunday}T00:00:00.000Z`) } },
            select: { date: true, steps: true, distanceMeters: true },
        }),
        prisma.cyclingSession.findMany({
            where: { userId, startedAt: { gte: from, lt: until } },
            select: { startedAt: true, durationSeconds: true, distanceMeters: true },
        }),
    ]);
    return composeActivityReport({
        workoutSets: sets.map((s) => ({
            performedAt: s.performedAt,
            reps: s.reps,
            weightKg: Number(s.weightKg),
            rir: s.rir,
            primaryMuscles: s.exercise.primaryMuscles,
        })),
        studioBike,
        days: days.map((d) => ({ date: d.date.toISOString().slice(0, 10), steps: d.steps, distanceMeters: d.distanceMeters })),
        rides,
    }, { weeks: options.weeks, timeZone, now });
}
//# sourceMappingURL=activity.service.js.map