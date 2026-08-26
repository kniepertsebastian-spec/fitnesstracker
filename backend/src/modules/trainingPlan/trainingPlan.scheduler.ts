import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { rotateAllDuePlans } from "./trainingPlan.service.js";
import { withSchedulerLock } from "../../lib/schedulerLock.js";

// Phase rotations only ever land on a Monday (see trainingPlan.service.ts), so checking a few
// times a day is more than enough precision while staying cheap for a single-user app.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Arbitrary, distinct from the other schedulers' lock keys — see schedulerLock.ts.
const SCHEDULER_LOCK_KEY = 72_700_001;

// Background tick that advances any training plan whose 8-week phase is overdue. Runs
// independently of any request so a phase change (and, later, its Phase-5 push reminder) fires
// even if nobody opens the app on the exact Monday it happens.
export default fp(async (fastify: FastifyInstance) => {
  const tick = async () => {
    try {
      await withSchedulerLock(fastify.prisma, SCHEDULER_LOCK_KEY, async () => {
        const { rotatedPlans } = await rotateAllDuePlans(fastify.prisma);
        if (rotatedPlans > 0) {
          fastify.log.info({ rotatedPlans }, "Training plan phase(s) rotated");
        }
      });
    } catch (error) {
      fastify.log.error(error, "Training plan rotation tick failed");
    }
  };

  // Catch up immediately on boot in case a rotation became due while the server was down,
  // rather than waiting up to CHECK_INTERVAL_MS for the first tick.
  await tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  fastify.addHook("onClose", async () => clearInterval(timer));
});
