import { eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { newsletters } from "../../database/schema/schema.js";
import { getNewsletterGenerateQueue } from "../../queue/newsletter-generate.queue.js";
import { debitCredits } from "../../shared/billing/credits.service.js";
import { GENERATION_CREDIT_COST } from "../../shared/billing/credits.config.js";

export async function createNewsletter(userId: string, topic: string) {
  const [newsletter] = await db
    .insert(newsletters)
    .values({ userId, topic })
    .returning();

  return newsletter!;
}

export async function startNewsletterGeneration(newsletterId: string, userId: string) {
  const creditBalance = await debitCredits(
    userId,
    GENERATION_CREDIT_COST,
    "generation_debit",
    newsletterId,
  );

  const [updated] = await db
    .update(newsletters)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(newsletters.id, newsletterId))
    .returning();

  await getNewsletterGenerateQueue().add("generate", { newsletterId, userId });

  return { newsletter: updated!, creditBalance };
}
