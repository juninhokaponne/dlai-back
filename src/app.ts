import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { pinoHttp } from "pino-http";
import { router } from "./routes/index.js";
import { errorHandler } from "./shared/middlewares/error-handler.js";
import { notFound } from "./shared/middlewares/not-found.js";
import { apiRateLimit } from "./shared/middlewares/rate-limit.js";
import { handleStripeWebhook } from "./modules/billing/billing.webhook.js";
import { handleResendWebhook } from "./modules/tracking/resend-webhook.controller.js";
import { rootLogger } from "./shared/logger/logger.js";
import { buildOpenApiDocument } from "./shared/openapi/document.js";
import type { AuthenticatedRequest } from "./shared/middlewares/auth.js";
export const app = express();

// In production the app sits behind exactly one reverse proxy (Caddy on the
// same host), so we trust one hop of X-Forwarded-For for correct client IPs
// (req.ip, rate limiting, secure cookies).
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Mounted before helmet() so the strict API CSP (script-src 'self', no
// inline) doesn't break Swagger UI's bundled inline script.
const openApiDocument = buildOpenApiDocument();
app.get("/docs/openapi.json", (_req, res) => res.json(openApiDocument));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? [] }));
app.use(
  pinoHttp({
    logger: rootLogger,
    // Keep request logs to the essentials — the default serializers dump
    // every header (including Authorization/Cookie), which both leaks
    // credentials into logs and is mostly noise. `id` is pino-http's
    // auto-generated per-request correlation id (reqId); userId is filled
    // in once requireAuth resolves the request (undefined for public
    // routes) so a user's activity can be filtered across requests.
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    customProps: (req) => ({
      userId: (req as AuthenticatedRequest).user?.userId,
    }),
  }),
);

// Stripe needs the raw request body to verify the webhook signature, so this
// must be registered before the global express.json() body parser below.
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

// Resend needs the raw request body too, for the same svix-signature reason.
app.post(
  "/api/webhooks/resend",
  express.raw({ type: "application/json" }),
  handleResendWebhook,
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use(apiRateLimit());
app.use("/api", router);

app.use(notFound);
app.use(errorHandler);
