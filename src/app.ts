import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { router } from "./routes/index.js";
import { errorHandler } from "./shared/middlewares/error-handler.js";
import { notFound } from "./shared/middlewares/not-found.js";
import { ratelimit } from "./shared/middlewares/rate-limit.js";
import { handleStripeWebhook } from "./modules/billing/billing.webhook.js";
import { rootLogger } from "./shared/logger/logger.js";
export const app = express();

// In production the app sits behind exactly one reverse proxy (Caddy on the
// same host), so we trust one hop of X-Forwarded-For for correct client IPs
// (req.ip, rate limiting, secure cookies).
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? [] }));
app.use(
  pinoHttp({
    logger: rootLogger,
    // Keep request logs to the essentials — the default serializers dump
    // every header (including Authorization/Cookie), which both leaks
    // credentials into logs and is mostly noise.
    serializers: {
      req: (req) => ({ method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

// Stripe needs the raw request body to verify the webhook signature, so this
// must be registered before the global express.json() body parser below.
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use(ratelimit());
app.use("/api", router);

app.use(notFound);
app.use(errorHandler);
