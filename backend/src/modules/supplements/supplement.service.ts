import type { PrismaClient } from "@prisma/client";
import type { CreateSupplementInput, UpdateSupplementInput } from "@fitnesstracker/shared";
import { NotFoundError } from "../../errors/httpErrors.js";
import { sendNotificationToUser } from "../push/push.service.js";

export function listSupplements(prisma: PrismaClient, userId: string) {
  return prisma.supplement.findMany({ where: { userId }, orderBy: { reminderTime: "asc" } });
}

export function createSupplement(prisma: PrismaClient, userId: string, input: CreateSupplementInput) {
  return prisma.supplement.create({ data: { userId, ...input } });
}

export async function updateSupplement(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateSupplementInput,
) {
  const existing = await prisma.supplement.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new NotFoundError("Supplement not found");
  }
  return prisma.supplement.update({ where: { id }, data: input });
}

export async function deleteSupplement(prisma: PrismaClient, userId: string, id: string) {
  const existing = await prisma.supplement.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new NotFoundError("Supplement not found");
  }
  await prisma.supplement.delete({ where: { id } });
}

// Formats `date` as that IANA timezone's local "YYYY-MM-DD" and "HH:MM" — built on Intl, no
// timezone library dependency needed.
function getLocalDateAndTime(date: Date, timeZone: string): { day: string; time: string } {
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
export async function checkAndSendReminders(prisma: PrismaClient): Promise<{ sent: number }> {
  const supplements = await prisma.supplement.findMany({ where: { enabled: true } });
  const now = new Date();
  let sent = 0;

  for (const supplement of supplements) {
    let local: { day: string; time: string };
    try {
      local = getLocalDateAndTime(now, supplement.timeZone);
    } catch {
      // Invalid/unknown timezone string — skip this one rather than crashing the whole tick.
      continue;
    }
    // `>=` rather than an exact match: if the event loop stalls for a few seconds around the
    // target minute (e.g. 07:59:58 -> 08:00:02 on the next tick), an exact `===` would miss the
    // reminder for the whole day. `lastRemindedOn` still guarantees at most one send per local day.
    if (local.time < supplement.reminderTime) continue;
    if (supplement.lastRemindedOn === local.day) continue;

    await sendNotificationToUser(prisma, supplement.userId, {
      title: "Supplement-Erinnerung",
      body: supplement.name,
      url: "/nutrition",
    });
    await prisma.supplement.update({
      where: { id: supplement.id },
      data: { lastRemindedOn: local.day },
    });
    sent += 1;
  }

  return { sent };
}
