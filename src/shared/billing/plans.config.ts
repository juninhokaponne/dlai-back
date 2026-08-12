export const PLANS = {
  starter: {
    name: "Starter",
    priceBrlCents: 4900,
    credits: 100,
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? "",
    stripeLookupKey: "dlai_starter_monthly",
  },
  pro: {
    name: "Pro",
    priceBrlCents: 14900,
    credits: 500,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? "",
    stripeLookupKey: "dlai_pro_monthly",
  },
  business: {
    name: "Business",
    priceBrlCents: 39900,
    credits: 2000,
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS ?? "",
    stripeLookupKey: "dlai_business_monthly",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export const PLAN_KEYS = Object.keys(PLANS) as PlanKey[];
