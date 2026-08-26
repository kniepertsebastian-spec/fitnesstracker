import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { sendDueReminders } from "./progressPhoto.service.js";
import { withSchedulerLock } from "../../lib/schedulerLock.js";

// Once a day is plenty for a weekly-cadence nudge — unlike the supplement reminder's exact
// wall-clock-time requirement, nobody notices a few hours of slop here.
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Arbitrary, distinct from the other schedulers' lock keys — see schedulerLock.ts.
const SCHEDULER_LOCK_KEY = 72_700_003;

export default fp(async (fastify: FastifyInstance) => {
  const tick = async () => {
    try {
      await withSchedulerLock(fastify.prisma, SCHEDULER_LOCK_KEY, async () => {
        const { sent } = await sendDueReminders(fastify.prisma);
        if (sent > 0) {
          fastify.log.info({ sent }, "Progress photo reminder(s) sent");
        }
      });
    } catch (error) {
      fastify.log.error(error, "Progress photo reminder tick failed");
    }
  };

  await tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  fastify.addHook("onClose", async () => clearInterval(timer));
});
