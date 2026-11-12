import { NotFoundError } from "../../errors/httpErrors.js";
import { sendNotificationToUser } from "../push/push.service.js";
export function listSupplements(prisma, userId) {
    return prisma.supplement.findMany({ where: { userId }, orderBy: { reminderTime: "asc" } });
}
export function createSupplement(prisma, userId, input) {
    const { aiAnalysis, ...rest } = input;
    return prisma.supplement.create({
        data: {
            userId,
            ...rest,
            ...(aiAnalysis !== undefined
                ? { aiAnalysis: (aiAnalysis ?? null) }
                : {}),
        },
    });
}
export async function updateSupplement(prisma, userId, id, input) {
    const existing = await prisma.supplement.findFirst({ where: { id, userId } });
    if (!existing) {
        throw new NotFoundError("Supplement not found");
    }
    const { aiAnalysis, ...rest } = input;
    return prisma.supplement.update({
        where: { id },
        data: {
            ...rest,
            ...(aiAnalysis !== undefined
                ? { aiAnalysis: (aiAnalysis ?? null) }
                : {}),
        },
    });
}
export async function deleteSupplement(prisma, userId, id) {
    const existing = await prisma.supplement.findFirst({ where: { id, userId } });
    if (!existing) {
        throw new NotFoundError("Supplement not found");
    }
    await prisma.supplement.delete({ where: { id } });
}
// Formats `date` as that IANA timezone's local "YYYY-MM-DD" and "HH:MM" — built on Intl, no
// timezone library dependency needed.
function getLocalDateAndTime(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return { day: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
}
// Scheduler tick: checks every enabled supplement's reminder time against "now" in that
// supplement's own timezone, and sends at most once per local day.
export async function checkAndSendReminders(prisma) {
    const supplements = await prisma.supplement.findMany({
        where: { enabled: true },
        include: { user: { select: { remindSupplements: true } } },
    });
    const now = new Date();
    let sent = 0;
    for (const supplement of supplements) {
        let local;
        try {
            local = getLocalDateAndTime(now, supplement.timeZone);
        }
        catch {
            // Invalid/unknown timezone string — skip this one rather than crashing the whole tick.
            continue;
        }
        // `>=` rather than an exact match: if the event loop stalls for a few seconds around the
        // target minute (e.g. 07:59:58 -> 08:00:02 on the next tick), an exact `===` would miss the
        // reminder for the whole day. `lastRemindedOn` still guarantees at most one send per local day.
        if (local.time < supplement.reminderTime)
            continue;
        if (supplement.lastRemindedOn === local.day)
            continue;
        // Phase 30: per-reminder-type opt-out. `lastRemindedOn` still advances even when suppressed
        // — "today's reminder was processed" is independent of whether push actually delivered it,
        // and not advancing it would just re-check (and re-suppress) this supplement every tick for
        // the rest of the day for no benefit.
        if (supplement.user.remindSupplements) {
            await sendNotificationToUser(prisma, supplement.userId, {
                title: "Supplement-Erinnerung",
                body: supplement.name,
                url: "/nutrition",
            });
            sent += 1;
        }
        await prisma.supplement.update({
            where: { id: supplement.id },
            data: { lastRemindedOn: local.day },
        });
    }
    return { sent };
}
//# sourceMappingURL=supplement.service.js.map