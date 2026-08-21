import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { sendDueReminders } from "./progressPhoto.service.js";

// Once a day is plenty for a weekly-cadence nudge — unlike the supplement reminder's exact
// wall-clock-time requirement, nobody notices a few hours of slop here.
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export default fp(async (fastify: FastifyInstance) => {
  const tick = async () => {
    try {
      const { sent } = await sendDueReminders(fastify.prisma);
      if (sent > 0) {
        fastify.log.info({ sent }, "Progress photo reminder(s) sent");
      }
    } catch (error) {
      fastify.log.error(error, "Progress photo reminder tick failed");
    }
  };

  await tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  fastify.addHook("onClose", async () => clearInterval(timer));
});
