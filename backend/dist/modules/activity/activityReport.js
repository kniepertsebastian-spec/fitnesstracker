// Builds the weekly activity report from raw rows. Pure: everything it needs is passed in, so the
// week and average rules below are testable without a database.
//
// Rules (also listed in frontend/src/data/calculations.ts):
//  - Weeks run Monday to Sunday in the viewer's time zone; the last one is the running week.
//  - Steps: the average per day is the total over the days that have a stored value.
//  - Cycling: the average per day is the total over all days of the week that count (7, or the
//    elapsed days of the running week), because a day without a ride is a day with 0 minutes.
export const DEFAULT_TIME_ZONE = "Europe/Berlin";
const DAY_MS = 24 * 60 * 60 * 1000;
export function isValidTimeZone(timeZone) {
    try {
        new Intl.DateTimeFormat("en-CA", { timeZone });
        return true;
    }
    catch {
        return false;
    }
}
const formatters = new Map();
// "2026-10-18": the calendar day of an instant in `timeZone`.
export function localDate(instant, timeZone) {
    let formatter = formatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
        formatters.set(timeZone, formatter);
    }
    return formatter.format(instant);
}
const parseDay = (date) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};
export function addDays(date, days) {
    return new Date(parseDay(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}
function daysBetween(from, to) {
    return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);
}
export function mondayOf(date) {
    const dayOfWeek = (parseDay(date).getUTCDay() + 6) % 7; // Monday = 0
    return addDays(date, -dayOfWeek);
}
// "2026-W44": the ISO week is the one that holds the week's Thursday.
export function isoWeekLabel(monday) {
    const thursday = parseDay(addDays(monday, 3));
    const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
    const week = Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;
    return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
export function reportRange(weeks, timeZone, now) {
    const today = localDate(now, timeZone);
    const currentMonday = mondayOf(today);
    return { today, currentMonday, firstMonday: addDays(currentMonday, -(weeks - 1) * 7), lastSunday: addDays(currentMonday, 6) };
}
const round1 = (value) => Math.round(value * 10) / 10;
function groupBy(items, key) {
    const groups = new Map();
    for (const item of items) {
        const k = key(item);
        const group = groups.get(k);
        if (group)
            group.push(item);
        else
            groups.set(k, [item]);
    }
    return groups;
}
function strengthWeek(sets, dates, timeZone) {
    const inWeek = sets.filter((s) => dates.includes(localDate(s.performedAt, timeZone)));
    const trainingDays = new Set(inWeek.map((s) => localDate(s.performedAt, timeZone))).size;
    const withRir = inWeek.filter((s) => s.rir !== null);
    const setsByMuscle = {};
    for (const set of inWeek) {
        for (const muscle of set.primaryMuscles)
            setsByMuscle[muscle] = (setsByMuscle[muscle] ?? 0) + 1;
    }
    return {
        trainingDays,
        sets: inWeek.length,
        reps: inWeek.reduce((sum, s) => sum + s.reps, 0),
        volumeKg: Math.round(inWeek.reduce((sum, s) => sum + s.reps * s.weightKg, 0)),
        averageRir: withRir.length > 0 ? round1(withRir.reduce((sum, s) => sum + (s.rir ?? 0), 0) / withRir.length) : null,
        setsByMuscle,
    };
}
function cyclingWeek(entries, dates, daysCounted) {
    const byDate = groupBy(entries, (e) => e.date);
    const days = dates.map((date) => {
        const rows = byDate.get(date) ?? [];
        const withKm = rows.filter((r) => r.km !== null);
        return {
            date,
            minutes: round1(rows.reduce((sum, r) => sum + r.minutes, 0)),
            km: withKm.length > 0 ? Math.round(withKm.reduce((sum, r) => sum + (r.km ?? 0), 0) * 100) / 100 : null,
        };
    });
    const totalMinutes = round1(days.reduce((sum, d) => sum + d.minutes, 0));
    const kmDays = days.filter((d) => d.km !== null);
    const totalKm = kmDays.length > 0 ? Math.round(kmDays.reduce((sum, d) => sum + (d.km ?? 0), 0) * 10) / 10 : null;
    return {
        totalMinutes,
        totalKm,
        rides: entries.filter((e) => dates.includes(e.date)).length,
        averageMinutesPerDay: round1(totalMinutes / daysCounted),
        averageKmPerDay: totalKm === null ? null : Math.round((totalKm / daysCounted) * 100) / 100,
        days,
    };
}
export function composeActivityReport(inputs, options) {
    const { weeks, timeZone } = options;
    const now = options.now ?? new Date();
    const { today, currentMonday, firstMonday } = reportRange(weeks, timeZone, now);
    const stepsByDate = new Map(inputs.days.map((d) => [d.date, d]));
    const outdoor = inputs.rides.map((r) => ({
        date: localDate(r.startedAt, timeZone),
        minutes: r.durationSeconds / 60,
        km: r.distanceMeters === null ? null : r.distanceMeters / 1000,
    }));
    const studio = inputs.studioBike.map((s) => ({
        date: localDate(s.performedAt, timeZone),
        minutes: s.durationMinutes,
        km: null,
    }));
    const reportWeeks = [];
    for (let w = 0; w < weeks; w++) {
        const weekStart = addDays(firstMonday, w * 7);
        const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        const partial = weekStart === currentMonday;
        const daysCounted = partial ? daysBetween(weekStart, today) + 1 : 7;
        const stepDays = dates.map((date) => ({ date, steps: stepsByDate.get(date)?.steps ?? null }));
        const withData = stepDays.filter((d) => d.steps !== null);
        const stepsTotal = withData.reduce((sum, d) => sum + (d.steps ?? 0), 0);
        reportWeeks.push({
            weekStart,
            weekEnd: dates[6],
            isoWeek: isoWeekLabel(weekStart),
            partial,
            daysCounted,
            strength: strengthWeek(inputs.workoutSets, dates, timeZone),
            steps: {
                total: stepsTotal,
                daysWithData: withData.length,
                averagePerDay: withData.length > 0 ? Math.round(stepsTotal / withData.length) : null,
                days: stepDays,
            },
            cyclingOutdoor: cyclingWeek(outdoor, dates, daysCounted),
            cyclingStudio: cyclingWeek(studio, dates, daysCounted),
        });
    }
    const stepsTotal = reportWeeks.reduce((sum, w) => sum + w.steps.total, 0);
    const stepDaysWithData = reportWeeks.reduce((sum, w) => sum + w.steps.daysWithData, 0);
    const outdoorKm = reportWeeks.filter((w) => w.cyclingOutdoor.totalKm !== null);
    return {
        format: "fitnesstracker-activity",
        version: 1,
        generatedAt: now.toISOString(),
        timeZone,
        range: { from: firstMonday, to: today },
        totals: {
            steps: {
                total: stepsTotal,
                daysWithData: stepDaysWithData,
                averagePerDay: stepDaysWithData > 0 ? Math.round(stepsTotal / stepDaysWithData) : null,
            },
            cyclingOutdoor: {
                minutes: round1(reportWeeks.reduce((sum, w) => sum + w.cyclingOutdoor.totalMinutes, 0)),
                km: outdoorKm.length > 0 ? Math.round(outdoorKm.reduce((sum, w) => sum + (w.cyclingOutdoor.totalKm ?? 0), 0) * 10) / 10 : null,
                rides: reportWeeks.reduce((sum, w) => sum + w.cyclingOutdoor.rides, 0),
            },
            cyclingStudio: {
                minutes: round1(reportWeeks.reduce((sum, w) => sum + w.cyclingStudio.totalMinutes, 0)),
                sessions: reportWeeks.reduce((sum, w) => sum + w.cyclingStudio.rides, 0),
            },
            strength: {
                trainingDays: reportWeeks.reduce((sum, w) => sum + w.strength.trainingDays, 0),
                sets: reportWeeks.reduce((sum, w) => sum + w.strength.sets, 0),
                volumeKg: reportWeeks.reduce((sum, w) => sum + w.strength.volumeKg, 0),
            },
        },
        weeks: reportWeeks,
        records: buildRecords(inputs, timeZone, firstMonday, addDays(currentMonday, 6)),
    };
}
const dayStart = (date) => `${date}T00:00:00`;
const dayEnd = (date) => `${date}T23:59:59`;
function buildRecords(inputs, timeZone, firstDay, lastDay) {
    const inRange = (date) => date >= firstDay && date <= lastDay;
    const records = [];
    for (const day of inputs.days) {
        if (!inRange(day.date))
            continue;
        records.push({
            type: "DailySteps",
            unit: "count",
            startDate: dayStart(day.date),
            endDate: dayEnd(day.date),
            value: day.steps,
            sourceName: "Health Connect",
        });
    }
    for (const ride of inputs.rides) {
        if (!inRange(localDate(ride.startedAt, timeZone)))
            continue;
        const endDate = new Date(ride.startedAt.getTime() + ride.durationSeconds * 1000).toISOString();
        records.push({
            type: "CyclingOutdoorDuration",
            unit: "min",
            startDate: ride.startedAt.toISOString(),
            endDate,
            value: round1(ride.durationSeconds / 60),
            sourceName: "Health Connect",
        });
        if (ride.distanceMeters !== null) {
            records.push({
                type: "CyclingOutdoorDistance",
                unit: "km",
                startDate: ride.startedAt.toISOString(),
                endDate,
                value: Math.round(ride.distanceMeters / 10) / 100,
                sourceName: "Health Connect",
            });
        }
    }
    for (const session of inputs.studioBike) {
        if (!inRange(localDate(session.performedAt, timeZone)))
            continue;
        records.push({
            type: "CyclingStudioDuration",
            unit: "min",
            startDate: session.performedAt.toISOString(),
            endDate: new Date(session.performedAt.getTime() + session.durationMinutes * 60_000).toISOString(),
            value: session.durationMinutes,
            sourceName: "Fitnesstracker",
        });
    }
    const setsByDay = groupBy(inputs.workoutSets, (s) => localDate(s.performedAt, timeZone));
    for (const [date, sets] of setsByDay) {
        if (!inRange(date))
            continue;
        records.push({
            type: "StrengthTrainingSets",
            unit: "count",
            startDate: dayStart(date),
            endDate: dayEnd(date),
            value: sets.length,
            sourceName: "Fitnesstracker",
        });
        records.push({
            type: "StrengthTrainingVolume",
            unit: "kg",
            startDate: dayStart(date),
            endDate: dayEnd(date),
            value: Math.round(sets.reduce((sum, s) => sum + s.reps * s.weightKg, 0)),
            sourceName: "Fitnesstracker",
        });
    }
    return records.sort((a, b) => (a.startDate === b.startDate ? a.type.localeCompare(b.type) : a.startDate < b.startDate ? -1 : 1));
}
//# sourceMappingURL=activityReport.js.map