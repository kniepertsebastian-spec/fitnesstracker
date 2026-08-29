import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { sendDueWorkoutReminders } from "./workoutLog.service.js";
import { withSchedulerLock } from "../../lib/schedulerLock.js";

// Hourly — cheap to check (the service itself no-ops before the evening threshold and the
// per-user "already reminded today" marker prevents duplicates), and an hourly tick keeps the
// evening cutoff reasonably tight without needing a dedicated cron-like scheduler.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Arbitrary, distinct from the other schedulers' lock keys — see schedulerLock.ts.
const SCHEDULER_LOCK_KEY = 72_700_004;

export default fp(async (fastify: FastifyInstance) => {
  const tick = async () => {
    try {
      await withSchedulerLock(fastify.prisma, SCHEDULER_LOCK_KEY, async () => {
        const { sent } = await sendDueWorkoutReminders(fastify.prisma);
        if (sent > 0) {
          fastify.log.info({ sent }, "Workout reminder(s) sent");
        }
      });
    } catch (error) {
      fastify.log.error(error, "Workout reminder tick failed");
    }
  };

  await tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  fastify.addHook("onClose", async () => clearInterval(timer));
});
