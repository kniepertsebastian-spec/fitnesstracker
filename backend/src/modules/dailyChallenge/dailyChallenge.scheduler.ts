import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { sendDueDailyChallengeReminders } from "./dailyChallenge.service.js";
import { withSchedulerLock } from "../../lib/schedulerLock.js";

// Same hourly cadence and reasoning as workoutReminder.scheduler.ts.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Arbitrary, distinct from the other schedulers' lock keys — see schedulerLock.ts.
const SCHEDULER_LOCK_KEY = 72_700_005;

export default fp(async (fastify: FastifyInstance) => {
  const tick = async () => {
    try {
      await withSchedulerLock(fastify.prisma, SCHEDULER_LOCK_KEY, async () => {
        const { sent } = await sendDueDailyChallengeReminders(fastify.prisma);
        if (sent > 0) {
          fastify.log.info({ sent }, "Daily challenge reminder(s) sent");
        }
      });
    } catch (error) {
      fastify.log.error(error, "Daily challenge reminder tick failed");
    }
  };

  await tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  fastify.addHook("onClose", async () => clearInterval(timer));
});
