import { eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { organizations } from "../../database/schema/schema.js";
import { getStripeClient } from "./stripe-client.js";

export async function getOrCreateStripeCustomerId(
  organizationId: string,
  email: string,
): Promise<string> {
  const [organization] = await db
    .select({ stripeCustomerId: organizations.stripeCustomerId })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new Error("Organization not found.");
  }

  if (organization.stripeCustomerId) {
    return organization.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: { organizationId },
  });

  await db
    .update(organizations)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organizations.id, organizationId));

  return customer.id;
}
