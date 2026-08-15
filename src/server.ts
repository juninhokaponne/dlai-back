import http from "node:http";
import { app } from "./app.js";
import { startNewsletterGenerateWorker } from "./queue/newsletter-generate.worker.js";
import { startNewsletterSendWorker } from "./queue/newsletter-send.worker.js";
import { startAutomationHeartbeatWorker } from "./queue/automation-heartbeat.worker.js";
import { scheduleAutomationHeartbeat } from "./queue/automation-heartbeat.queue.js";
import { createLogger } from "./shared/logger/logger.js";

const PORT = Number(process.env.PORT) || 3000;
const logger = createLogger("server");

export async function startServer() {
  const server = http.createServer(app);
  const newsletterGenerateWorker = startNewsletterGenerateWorker();
  const newsletterSendWorker = startNewsletterSendWorker();
  const automationHeartbeatWorker = startAutomationHeartbeatWorker();
  await scheduleAutomationHeartbeat();

  server.listen(PORT, () => {
    logger.info({ port: PORT }, "Server listening");
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Signal received, closing server");
    Promise.all([
      new Promise((resolve) => server.close(resolve)),
      newsletterGenerateWorker.close(),
      newsletterSendWorker.close(),
      automationHeartbeatWorker.close(),
    ]).then(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}
