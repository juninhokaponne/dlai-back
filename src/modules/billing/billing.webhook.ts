import type { Request, Response } from "express";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { users, subscriptions, stripeEvents } from "../../database/schema/schema.js";
import { getStripeClient } from "../../shared/billing/stripe-client.js";
import { creditCredits } from "../../shared/billing/credits.service.js";
import { PLANS, type PlanKey } from "../../shared/billing/plans.config.js";
import { subscriptionStatus } from "../../database/schema/schema.js";
import { createLogger } from "../../shared/logger/logger.js";

const logger = createLogger("billing.webhook");

type SubscriptionStatus = (typeof subscriptionStatus.enumValues)[number];

function toSubscriptionStatus(status: string): SubscriptionStatus {
  const known = subscriptionStatus.enumValues as readonly string[];
  return known.includes(status) ? (status as SubscriptionStatus) : "incomplete";
}

function findPlanByPriceId(priceId: string): { key: PlanKey; credits: number } | null {
  for (const key of Object.keys(PLANS) as PlanKey[]) {
    if (PLANS[key].stripePriceId === priceId) {
      return { key, credits: PLANS[key].credits };
    }
  }
  return null;
}

async function findUserIdByCustomerId(customerId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  return user?.id ?? null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const userId = await findUserIdByCustomerId(customerId);
  if (!userId) {
    logger.error({ customerId }, "No user found for Stripe customer");
    return;
  }

  const item = subscription.items.data[0];
  if (!item) return;

  const priceId = item.price.id;
  const plan = findPlanByPriceId(priceId);

  const values = {
    userId,
    plan: plan?.key ?? "unknown",
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    status: toSubscriptionStatus(subscription.status),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: new Date(item.current_period_end * 1000),
  };

  await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: { ...values, updatedAt: new Date() },
    });
}

async function grantTrialCredits(subscription: Stripe.Subscription, eventId: string) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const userId = await findUserIdByCustomerId(customerId);
  if (!userId) {
    logger.error({ customerId }, "No user found for Stripe customer");
    return;
  }

  const item = subscription.items.data[0];
  if (!item) return;

  const plan = findPlanByPriceId(item.price.id);
  if (!plan) {
    logger.error({ priceId: item.price.id }, "No matching plan for Stripe price");
    return;
  }

  await creditCredits(userId, plan.credits, "subscription_grant", {
    stripeEventId: eventId,
  });
}

async function markSubscriptionCanceled(subscription: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({ status: "canceled", cancelAtPeriodEnd: false, updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
}

async function grantCreditsForInvoice(invoice: Stripe.Invoice, eventId: string) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const userId = await findUserIdByCustomerId(customerId);
  if (!userId) {
    logger.error({ customerId }, "No user found for Stripe customer");
    return;
  }

  const line = invoice.lines.data[0];
  const priceRef = line?.pricing?.price_details?.price;
  const priceId = typeof priceRef === "string" ? priceRef : priceRef?.id;
  if (!priceId) {
    logger.error({ invoiceId: invoice.id }, "Invoice has no price on its line items");
    return;
  }

  const plan = findPlanByPriceId(priceId);
  if (!plan) {
    logger.error({ priceId }, "No matching plan for Stripe price");
    return;
  }

  await creditCredits(userId, plan.credits, "subscription_grant", {
    stripeEventId: eventId,
  });
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const stripe = getStripeClient();
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error("STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).send();
  }
  if (!signature) {
    return res.status(400).send("Missing stripe-signature header.");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      webhookSecret,
    );
  } catch (err) {
    logger.error({ err }, "Webhook signature verification failed");
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  const claimed = await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });

  if (claimed.length === 0) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created": {
        const subscription = event.data.object;
        await syncSubscription(subscription);
        if (subscription.status === "trialing") {
          await grantTrialCredits(subscription, event.id);
        }
        break;
      }
      case "customer.subscription.updated":
        await syncSubscription(event.data.object);
        break;
      case "customer.subscription.deleted":
        await markSubscriptionCanceled(event.data.object);
        break;
      case "invoice.paid":
        await grantCreditsForInvoice(event.data.object, event.id);
        break;
      default:
        break;
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error(
      { err, eventId: event.id, eventType: event.type },
      "Webhook processing failed",
    );
    return res.status(500).json({ error: "Processing failed" });
  }
}
