import type { Request, Response } from "express";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { users, subscriptions, stripeEvents } from "../../database/schema/schema.js";
import { getStripeClient } from "../../shared/billing/stripe-client.js";
import { creditCredits } from "../../shared/billing/credits.service.js";
import { PLANS, type PlanKey } from "../../shared/billing/plans.config.js";
import { subscriptionStatus } from "../../database/schema/schema.js";

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
    console.error(`Webhook: no user found for Stripe customer ${customerId}`);
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

async function markSubscriptionCanceled(subscription: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
}

async function grantCreditsForInvoice(invoice: Stripe.Invoice, eventId: string) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const userId = await findUserIdByCustomerId(customerId);
  if (!userId) {
    console.error(`Webhook: no user found for Stripe customer ${customerId}`);
    return;
  }

  const line = invoice.lines.data[0];
  const priceRef = line?.pricing?.price_details?.price;
  const priceId = typeof priceRef === "string" ? priceRef : priceRef?.id;
  if (!priceId) {
    console.error(`Webhook: invoice ${invoice.id} has no price on its line items.`);
    return;
  }

  const plan = findPlanByPriceId(priceId);
  if (!plan) {
    console.error(`Webhook: no matching plan for Stripe price ${priceId}`);
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
    console.error("STRIPE_WEBHOOK_SECRET is not set.");
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
    console.error("Webhook signature verification failed:", (err as Error).message);
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
      case "customer.subscription.created":
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
    console.error(
      `Webhook processing failed for event ${event.id} (${event.type}):`,
      err,
    );
    return res.status(500).json({ error: "Processing failed" });
  }
}
