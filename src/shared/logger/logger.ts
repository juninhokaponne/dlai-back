import pino from "pino";

// Always emit plain JSON here. Pretty-printing for local dev is applied by
// piping `npm run dev` through pino-pretty, not baked into the app's
// runtime — that keeps the shipped image free of the pino-pretty dependency
// and container logs machine-readable.
export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

export function createLogger(scope: string) {
  return rootLogger.child({ scope });
}
