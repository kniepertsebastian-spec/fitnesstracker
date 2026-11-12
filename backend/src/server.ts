import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = buildApp();

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`Backend listening on port ${env.PORT}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });

// `docker stop` / `restart` send SIGTERM: stop accepting connections, let running requests
// finish and disconnect Prisma (the plugin's onClose hook) instead of being killed mid-write.
// If closing hangs, exit anyway before Docker's own 10 s kill.
let shuttingDown = false;
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`${signal} received, shutting down`);
  const forceExit = setTimeout(() => {
    app.log.error("Graceful shutdown timed out, exiting");
    process.exit(1);
  }, 8_000);
  forceExit.unref();
  app
    .close()
    .then(() => process.exit(0))
    .catch((error) => {
      app.log.error(error);
      process.exit(1);
    });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
