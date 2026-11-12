// Reads the webhook payload of the Android companion app that forwards Health Connect data (the
// "Life Dashboard Companion", https://github.com/owen282000/life-dashboard-companion-app, payload
// reference docs/webhook.md). Only what this app needs is read:
//   - daily_totals[]: { date, steps, distance_meters } per local day (replaces the stored day)
//   - exercise[]:     biking sessions (type "8" / name "biking") with start_time, end_time
//   - distance[]:     { meters, start_time, end_time } intervals, summed onto the rides they lie in
// Everything else in the payload is ignored. A malformed entry is skipped instead of failing the
// whole payload, so one odd record cannot block the sync (the app would keep retrying it).
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 4000;
const MAX_RIDES = 20_000;
const MAX_STEPS_PER_DAY = 300_000;
const MAX_RIDE_SECONDS = 24 * 60 * 60;
const DISTANCE_TOLERANCE_MS = 1000;
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function parseTime(value) {
    if (typeof value !== "string")
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
function validCalendarDate(value) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function extractDays(raw) {
    if (!Array.isArray(raw))
        return [];
    const byDate = new Map();
    for (const item of raw.slice(0, MAX_DAYS)) {
        if (!isRecord(item) || typeof item.date !== "string")
            continue;
        if (!DATE_PATTERN.test(item.date) || !validCalendarDate(item.date))
            continue;
        const steps = finiteNumber(item.steps);
        if (steps === null || steps < 0 || steps > MAX_STEPS_PER_DAY)
            continue;
        const distance = finiteNumber(item.distance_meters);
        byDate.set(item.date, {
            date: item.date,
            steps: Math.round(steps),
            distanceMeters: distance !== null && distance >= 0 ? distance : null,
        });
    }
    return [...byDate.values()];
}
function extractDistances(raw) {
    if (!Array.isArray(raw))
        return [];
    const intervals = [];
    for (const item of raw) {
        if (!isRecord(item))
            continue;
        const meters = finiteNumber(item.meters);
        const start = parseTime(item.start_time);
        const end = parseTime(item.end_time);
        if (meters === null || meters < 0 || !start || !end)
            continue;
        intervals.push({ start: start.getTime(), end: end.getTime(), meters });
    }
    return intervals.sort((a, b) => a.start - b.start);
}
// Sum of the distance intervals that lie inside [start, end]; null when none does.
function distanceWithin(sorted, start, end) {
    let low = 0;
    let high = sorted.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (sorted[mid].start < start - DISTANCE_TOLERANCE_MS)
            low = mid + 1;
        else
            high = mid;
    }
    let sum = 0;
    let found = false;
    for (let i = low; i < sorted.length && sorted[i].start <= end; i++) {
        if (sorted[i].end <= end + DISTANCE_TOLERANCE_MS) {
            sum += sorted[i].meters;
            found = true;
        }
    }
    return found ? sum : null;
}
// Outdoor rides only: Health Connect's "biking" (8). "biking_stationary" (9) is an indoor bike and
// would duplicate what is logged as a studio bike session in the cardio log.
function isOutdoorBike(item) {
    const name = typeof item.name === "string" ? item.name.toLowerCase() : "";
    const type = typeof item.type === "string" || typeof item.type === "number" ? String(item.type) : "";
    return name === "biking" || (name === "" && type === "8");
}
function extractRides(raw, distances) {
    if (!Array.isArray(raw))
        return [];
    const rides = new Map();
    for (const item of raw.slice(0, MAX_RIDES)) {
        if (!isRecord(item) || !isOutdoorBike(item))
            continue;
        const startedAt = parseTime(item.start_time);
        const endedAt = parseTime(item.end_time);
        if (!startedAt || !endedAt || endedAt <= startedAt)
            continue;
        const reported = finiteNumber(item.duration_seconds);
        const durationSeconds = Math.round(reported !== null && reported > 0 ? reported : (endedAt.getTime() - startedAt.getTime()) / 1000);
        if (durationSeconds <= 0 || durationSeconds > MAX_RIDE_SECONDS)
            continue;
        const uuid = typeof item.uuid === "string" && item.uuid.trim() !== "" ? item.uuid.trim() : null;
        const externalId = uuid ?? `${startedAt.toISOString()}|${endedAt.toISOString()}`;
        const title = typeof item.title === "string" && item.title.trim() !== "" ? item.title.trim().slice(0, 200) : null;
        rides.set(externalId, {
            externalId,
            startedAt,
            endedAt,
            durationSeconds,
            distanceMeters: distanceWithin(distances, startedAt.getTime(), endedAt.getTime()),
            title,
        });
    }
    return [...rides.values()];
}
// null when the body is not a JSON object at all.
export function extractActivity(payload) {
    if (!isRecord(payload))
        return null;
    const sequence = finiteNumber(payload.sequence);
    return {
        isTest: payload.test === true,
        sequence: sequence !== null && Number.isInteger(sequence) && sequence >= 0 ? sequence : null,
        days: extractDays(payload.daily_totals),
        rides: extractRides(payload.exercise, extractDistances(payload.distance)),
    };
}
//# sourceMappingURL=healthSync.payload.js.map