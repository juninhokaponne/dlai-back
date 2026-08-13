import type { NextFunction, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { subscriptions, users } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { PLANS, PLAN_KEYS, TRIAL_PERIOD_DAYS, type PlanKey } from "../../shared/billing/plans.config.js";
import { TRIAL_CREDITS } from "../../shared/billing/credits.config.js";
import { getCreditsUsedThisCycle } from "../../shared/billing/credits.service.js";
import { getStripeClient } from "../../shared/billing/stripe-client.js";
import { getOrCreateStripeCustomerId } from "../../shared/billing/stripe-customer.js";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

export class BillingController {
  async listPlans(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const plans = PLAN_KEYS.map((key) => ({
        key,
        name: PLANS[key].name,
        priceBrlCents: PLANS[key].priceBrlCents,
        credits: PLANS[key].credits,
      }));

      return res.json({ plans, trialPeriodDays: TRIAL_PERIOD_DAYS });
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

      // Only first-time subscribers get a trial, so canceling and
      // resubscribing doesn't grant a fresh trial every time.
      const [previousSubscription] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.userId, req.user!.userId))
        .limit(1);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: `${FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${FRONTEND_URL}/billing/cancel`,
        metadata: { userId: req.user!.userId, plan: req.body.plan },
        // Prices are set in BRL; adaptive_pricing lets Stripe show a localized
        // estimate to customers paying with a non-BRL card without us having
        // to maintain per-currency prices.
        adaptive_pricing: { enabled: true },
        ...(previousSubscription
          ? {}
          : { subscription_data: { trial_period_days: TRIAL_PERIOD_DAYS } }),
      });

      return res.status(201).json({ url: session.url });
    } catch (err) {
      next(err);
    }
  }

  async getSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;

      const [subscription] = await db
        .select({
          plan: subscriptions.plan,
          status: subscriptions.status,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

      const planCredits =
        subscription && (PLAN_KEYS as readonly string[]).includes(subscription.plan)
          ? PLANS[subscription.plan as PlanKey].credits
          : TRIAL_CREDITS;

      const creditsUsedThisCycle = await getCreditsUsedThisCycle(userId);

      return res.json({
        subscription: subscription ?? null,
        planCredits,
        creditsUsedThisCycle,
      });
    } catch (err) {
      next(err);
    }
  }

  async listInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId })
        .from(users)
        .where(eq(users.id, req.user!.userId))
        .limit(1);

      if (!user?.stripeCustomerId) {
        return res.json({ invoices: [] });
      }

      const stripe = getStripeClient();
      const result = await stripe.invoices.list({
        customer: user.stripeCustomerId,
        limit: 12,
      });

      const invoices = result.data.map((invoice) => ({
        id: invoice.id,
        amountBrlCents: invoice.amount_paid,
        status: invoice.status,
        createdAt: new Date(invoice.created * 1000).toISOString(),
        hostedInvoiceUrl: invoice.hosted_invoice_url,
      }));

      return res.json({ invoices });
    } catch (err) {
      next(err);
    }
  }
}
