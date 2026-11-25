import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { withSchedulerLock } from "../../lib/schedulerLock.js";
import { ensureWeeklyDrops } from "./weeklyDrops.service.js";

// Hourly, like the other schedulers: the first tick after Sunday 06:00 (Berlin) creates the
// week's drops; every other tick finds them and does nothing. Reading the drops also creates
// them, so a missed tick only delays nothing.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Arbitrary, distinct from the other schedulers' lock keys — see schedulerLock.ts.
const SCHEDULER_LOCK_KEY = 72_700_020;

export default fp(async (fastify: FastifyInstance) => {
  const tick = async () => {
    try {
      await withSchedulerLock(fastify.prisma, SCHEDULER_LOCK_KEY, async () => {
        const { weekStart, created } = await ensureWeeklyDrops(fastify.prisma);
        if (created > 0) fastify.log.info({ weekStart, created }, "Weekly nutrition drops created");
      });
    } catch (error) {
      fastify.log.error(error, "Weekly nutrition drops tick failed");
    }
  };

  await tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  fastify.addHook("onClose", async () => clearInterval(timer));
});
