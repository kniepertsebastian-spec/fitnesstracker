import type { PrismaClient } from "@prisma/client";
import { sendNotificationToUser } from "../push/push.service.js";
import { localDayStart } from "../../lib/userTime.js";

// "Training vergessen zu beenden": an open (ACTIVE/PAUSED) session is checked after 2h, and if
// the question stays unanswered for another 30 min (= 2.5h in total) it is completed
// automatically. "Answered" means the user tapped "Weiter" (keepAliveAt restarts the 2h clock) or
// logged a set after the prompt; finishing/aborting the session obviously ends it too.
export const PROMPT_AFTER_MS = 2 * 60 * 60 * 1000;
export const AUTO_COMPLETE_AFTER_PROMPT_MS = 30 * 60 * 1000;

const OPEN = ["ACTIVE", "PAUSED"] as const;

export async function processForgottenSessions(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<{ prompted: number; completed: number }> {
  let completed = 0;
  let prompted = 0;

  // 1) Unanswered prompts → complete (or treat as answered if the user trained on meanwhile).
  const overdue = await prisma.workoutSession.findMany({
    where: {
      kind: "TRAINING",
      status: { in: [...OPEN] },
      stopPromptSentAt: { lte: new Date(now.getTime() - AUTO_COMPLETE_AFTER_PROMPT_MS) },
    },
    include: { user: { select: { remindWorkout: true } } },
  });

  for (const session of overdue) {
    const promptAt = session.stopPromptSentAt as Date;
    const lastLog = await prisma.workoutLog.findFirst({
      where: { userId: session.userId, deletedAt: null, performedAt: { gte: session.startedAt } },
      orderBy: { performedAt: "desc" },
      select: { performedAt: true },
    });

    if (lastLog && lastLog.performedAt > promptAt) {
      await prisma.workoutSession.update({
        where: { id: session.id },
        data: { stopPromptSentAt: null, keepAliveAt: now },
      });
      continue;
    }

    // The honest end of the workout is the last set, not the moment the app noticed.
    const endedAt = lastLog ? lastLog.performedAt : promptAt;
    const result = await prisma.workoutSession.updateMany({
      where: { id: session.id, status: { in: [...OPEN] } },
      data: { status: "COMPLETED", endedAt },
    });
    if (result.count === 0) continue;
    completed += 1;
    if (session.user.remindWorkout) {
      await sendNotificationToUser(prisma, session.userId, {
        title: "Training automatisch beendet",
        body: "Du hast nicht reagiert – dein Training wurde abgeschlossen.",
        url: "/",
        tag: "forgotten-session",
      });
    }
  }

  // 2) Sessions running (or paused) for 2h without an answer → ask.
  const cutoff = new Date(now.getTime() - PROMPT_AFTER_MS);
  const due = await prisma.workoutSession.findMany({
    where: {
      kind: "TRAINING",
      status: { in: [...OPEN] },
      stopPromptSentAt: null,
      OR: [{ keepAliveAt: null, startedAt: { lte: cutoff } }, { keepAliveAt: { lte: cutoff } }],
    },
    include: { user: { select: { remindWorkout: true } } },
  });

  for (const session of due) {
    const result = await prisma.workoutSession.updateMany({
      where: { id: session.id, stopPromptSentAt: null, status: { in: [...OPEN] } },
      data: { stopPromptSentAt: now },
    });
    if (result.count === 0) continue;
    prompted += 1;
    if (session.user.remindWorkout) {
      await sendNotificationToUser(prisma, session.userId, {
        title: "Training noch aktiv?",
        body: "Dein Training läuft seit über 2 Stunden. Beenden oder weitermachen? Ohne Antwort schließe ich es in 30 Minuten ab.",
        url: "/training",
        tag: "forgotten-session",
      });
    }
  }

  completed += await completeStaleDailySessions(prisma, now);
  return { prompted, completed };
}

// A Daily session is meant to stay open (and paused) for the whole day so it can be picked up again
// between other things. It is never prompted or auto-closed after hours like a workout, but it ends at
// the user's midnight: whatever was done by then is the day's result.
export async function completeStaleDailySessions(prisma: PrismaClient, now: Date = new Date()): Promise<number> {
  const open = await prisma.workoutSession.findMany({
    where: { kind: "DAILY", status: { in: [...OPEN] } },
    include: { user: { select: { timeZone: true } } },
  });
  let completed = 0;
  for (const session of open) {
    if (session.startedAt >= localDayStart(now, session.user.timeZone)) continue;
    const lastLog = await prisma.workoutLog.findFirst({
      where: { userId: session.userId, deletedAt: null, performedAt: { gte: session.startedAt } },
      orderBy: { performedAt: "desc" },
      select: { performedAt: true },
    });
    const result = await prisma.workoutSession.updateMany({
      where: { id: session.id, status: { in: [...OPEN] } },
      data: { status: "COMPLETED", endedAt: lastLog ? lastLog.performedAt : session.startedAt },
    });
    completed += result.count;
  }
  return completed;
}
