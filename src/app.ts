import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { router } from "./routes/index.js";
import { errorHandler } from "./shared/middlewares/error-handler.js";
import { notFound } from "./shared/middlewares/not-found.js";
import { ratelimit } from "./shared/middlewares/rate-limit.js";
import { handleStripeWebhook } from "./modules/billing/billing.webhook.js";
export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? [] }));

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
