import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";

// SSL is about whether Postgres itself is configured for encrypted
// connections, not about the app's environment — our self-hosted Postgres
// runs in the same docker-compose network without TLS, so this is opt-in
// via its own flag (e.g. for a managed DB that requires it) rather than
// tied to NODE_ENV.
const useSsl = process.env.DATABASE_SSL === "true";

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL!,
    ssl: useSsl,
  },
});
