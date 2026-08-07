import http from "node:http";
import { app } from "./app.js";
import { startNewsletterGenerateWorker } from "./queue/newsletter-generate.worker.js";

const PORT = Number(process.env.PORT) || 3000;

export async function startServer() {
  const server = http.createServer(app);
  const newsletterWorker = startNewsletterGenerateWorker();

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, closing server...`);
    Promise.all([
      new Promise((resolve) => server.close(resolve)),
      newsletterWorker.close(),
    ]).then(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}
