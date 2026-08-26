import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { checkAndSendReminders } from "./supplement.service.js";
import { withSchedulerLock } from "../../lib/schedulerLock.js";

// Once a minute — unlike the training-plan rotation (which tolerates hours of slop on a
// Monday), a supplement reminder is a specific wall-clock time and needs to fire close to it.
const CHECK_INTERVAL_MS = 60 * 1000;

// Arbitrary, distinct from the other schedulers' lock keys — see schedulerLock.ts.
const SCHEDULER_LOCK_KEY = 72_700_002;

export default fp(async (fastify: FastifyInstance) => {
  const tick = async () => {
    try {
      await withSchedulerLock(fastify.prisma, SCHEDULER_LOCK_KEY, async () => {
        const { sent } = await checkAndSendReminders(fastify.prisma);
        if (sent > 0) {
          fastify.log.info({ sent }, "Supplement reminder(s) sent");
        }
      });
    } catch (error) {
      fastify.log.error(error, "Supplement reminder tick failed");
    }
  };

  await tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  fastify.addHook("onClose", async () => clearInterval(timer));
});
