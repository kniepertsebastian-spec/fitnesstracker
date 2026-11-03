import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { processForgottenSessions } from "./forgottenSession.js";
import { withSchedulerLock } from "../../lib/schedulerLock.js";

// The 30-minute grace window needs a tighter tick than the hourly reminders.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Arbitrary, distinct from the other schedulers' lock keys — see schedulerLock.ts.
const SCHEDULER_LOCK_KEY = 72_700_010;

export default fp(async (fastify: FastifyInstance) => {
  const tick = async () => {
    try {
      await withSchedulerLock(fastify.prisma, SCHEDULER_LOCK_KEY, async () => {
        const { prompted, completed } = await processForgottenSessions(fastify.prisma);
        if (prompted > 0 || completed > 0) {
          fastify.log.info({ prompted, completed }, "Forgotten workout session(s) handled");
        }
      });
    } catch (error) {
      fastify.log.error(error, "Forgotten session tick failed");
    }
  };

  await tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  fastify.addHook("onClose", async () => clearInterval(timer));
});
