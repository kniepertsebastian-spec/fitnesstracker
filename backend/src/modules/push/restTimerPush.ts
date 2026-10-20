import type { PrismaClient } from "@prisma/client";
import { sendNotificationToUser } from "./push.service.js";

// Rest timers are short (seconds to a few minutes) and only matter while the workout runs, so
// they live in memory: a restart loses the pending ones, which costs at most one missed
// "Pause vorbei" — not worth a table and a polling scheduler.
const MAX_DELAY_MS = 15 * 60 * 1000;
const pending = new Map<string, NodeJS.Timeout>();

export function cancelRestTimerPush(userId: string) {
  const timer = pending.get(userId);
  if (timer) clearTimeout(timer);
  pending.delete(userId);
}

export function scheduleRestTimerPush(prisma: PrismaClient, userId: string, endsAt: Date, label?: string): boolean {
  cancelRestTimerPush(userId);
  const delay = endsAt.getTime() - Date.now();
  if (delay <= 0 || delay > MAX_DELAY_MS) return false;
  const timer = setTimeout(() => {
    pending.delete(userId);
    void sendNotificationToUser(
      prisma,
      userId,
      {
        title: "Pause vorbei",
        body: label ? `${label} – weiter mit dem nächsten Satz.` : "Weiter mit dem nächsten Satz.",
        url: "/training",
        tag: "rest-timer",
        skipIfVisible: true,
      },
      // Worthless once late: short TTL, delivered with priority.
      { ttlSeconds: 60, urgency: "high" },
    );
  }, delay);
  timer.unref();
  pending.set(userId, timer);
  return true;
}
