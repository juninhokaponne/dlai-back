import http from "node:http";
import { app } from "./app";

const PORT = Number(process.env.PORT) || 3000;

export async function startServer() {
  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, closing server...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}
