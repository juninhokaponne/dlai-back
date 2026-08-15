import { eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { newsletters } from "../../database/schema/schema.js";
import { getNewsletterGenerateQueue } from "../../queue/newsletter-generate.queue.js";
import { debitCredits } from "../../shared/billing/credits.service.js";
import { GENERATION_CREDIT_COST } from "../../shared/billing/credits.config.js";
import { findBodyModelOption, type BodyModelId } from "../../shared/ai/ai.config.js";

export async function createNewsletter(organizationId: string, userId: string, topic: string) {
  const [newsletter] = await db
    .insert(newsletters)
    .values({ organizationId, userId, topic })
    .returning();

  return newsletter!;
}

export async function startNewsletterGeneration(
  newsletterId: string,
  organizationId: string,
  userId: string,
  bodyModel?: BodyModelId,
) {
  let creditCost = GENERATION_CREDIT_COST;

  if (bodyModel) {
    const option = findBodyModelOption(bodyModel);
    if (!option) {
      throw Object.assign(new Error(`Unknown model "${bodyModel}".`), {
        statusCode: 400,
      });
    }
    creditCost = option.creditCost;
  }

  const creditBalance = await debitCredits({
    organizationId,
    userId,
    amount: creditCost,
    reason: "generation_debit",
    newsletterId,
  });

  const [updated] = await db
    .update(newsletters)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(newsletters.id, newsletterId))
    .returning();

  await getNewsletterGenerateQueue().add("generate", {
    newsletterId,
    organizationId,
    userId,
    creditCost,
    ...(bodyModel ? { bodyModel } : {}),
  });

  return { newsletter: updated!, creditBalance };
}
