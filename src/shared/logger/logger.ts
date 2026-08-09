import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";
const betterStackToken = process.env.BETTERSTACK_SOURCE_TOKEN;

// Always emit plain JSON to stdout. Pretty-printing for local dev is applied
// by piping `npm run dev` through pino-pretty, not baked into the app's
// runtime — that keeps the shipped image free of the pino-pretty dependency
// and container logs machine-readable. When BETTERSTACK_SOURCE_TOKEN is set,
// logs are also shipped to Better Stack in parallel.
export const rootLogger = betterStackToken
  ? pino(
      { level },
      pino.transport({
        targets: [
          { target: "pino/file", level, options: { destination: 1 } },
          {
            target: "@logtail/pino",
            level,
            options: {
              sourceToken: betterStackToken,
              options: {
                endpoint: `https://${process.env.BETTERSTACK_INGESTING_HOST}`,
              },
            },
          },
        ],
      }),
    )
  : pino({ level });

export function createLogger(scope: string) {
  return rootLogger.child({ scope });
}
