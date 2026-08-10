import type { NextFunction, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { subscriptions } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { PLANS, PLAN_KEYS, type PlanKey } from "../../shared/billing/plans.config.js";
import { getStripeClient } from "../../shared/billing/stripe-client.js";
import { getOrCreateStripeCustomerId } from "../../shared/billing/stripe-customer.js";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

export class BillingController {
  async listPlans(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const plans = PLAN_KEYS.map((key) => ({
        key,
        name: PLANS[key].name,
        priceUsdCents: PLANS[key].priceUsdCents,
        credits: PLANS[key].credits,
      }));

      return res.json({ plans });
    } catch (err) {
      next(err);
    }
  }

  async checkout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const plan = PLANS[req.body.plan as PlanKey];

      if (!plan.stripePriceId) {
        return res.status(500).json({
          error: `Plan "${req.body.plan}" is not configured in Stripe yet.`,
        });
      }

      const customerId = await getOrCreateStripeCustomerId(req.user!.userId);
      const stripe = getStripeClient();

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: `${FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${FRONTEND_URL}/billing/cancel`,
        metadata: { userId: req.user!.userId, plan: req.body.plan },
      });

      return res.status(201).json({ url: session.url });
    } catch (err) {
      next(err);
    }
  }

  async getSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const [subscription] = await db
        .select({
          plan: subscriptions.plan,
          status: subscriptions.status,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, req.user!.userId))
        .limit(1);

      return res.json({ subscription: subscription ?? null });
    } catch (err) {
      next(err);
    }
  }
}
