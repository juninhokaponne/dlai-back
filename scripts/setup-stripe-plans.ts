import "dotenv/config";
import { getStripeClient } from "../src/shared/billing/stripe-client.js";
import { PLANS, PLAN_KEYS } from "../src/shared/billing/plans.config.js";

const stripe = getStripeClient();

for (const key of PLAN_KEYS) {
  const plan = PLANS[key];

  const existing = await stripe.prices.list({
    lookup_keys: [plan.stripeLookupKey],
    limit: 1,
  });

  if (existing.data.length > 0) {
    console.log(`${key}: ja existe -> ${existing.data[0]!.id}`);
    continue;
  }

  const product = await stripe.products.create({
    name: `dlai-back ${plan.name}`,
    metadata: { plan: key, credits: String(plan.credits) },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.priceUsdCents,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: plan.stripeLookupKey,
  });

  console.log(`${key}: criado -> ${price.id}`);
}
