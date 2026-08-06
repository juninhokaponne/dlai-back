import { startServer } from "./server.js";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection: ", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception: ", err);
  process.exit(1);
});

startServer().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
