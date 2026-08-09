import { startServer } from "./server.js";
import { createLogger } from "./shared/logger/logger.js";

const logger = createLogger("bootstrap");

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled Rejection");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught Exception");
  process.exit(1);
});

startServer().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
