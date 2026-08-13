import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  users,
  creditTransactions,
  type creditTransactionReason,
} from "../../database/schema/schema.js";
import { InsufficientCreditsError } from "./billing.errors.js";

type CreditReason = (typeof creditTransactionReason.enumValues)[number];

export async function debitCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
  newsletterId?: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} - ${amount}` })
      .where(and(eq(users.id, userId), gte(users.creditBalance, amount)))
      .returning({ creditBalance: users.creditBalance });

    if (!updated) {
      throw new InsufficientCreditsError();
    }

    await tx.insert(creditTransactions).values({
      userId,
      amount: -amount,
      reason,
      ...(newsletterId ? { newsletterId } : {}),
    });

    return updated.creditBalance;
  });
}

export async function creditCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
  options: { newsletterId?: string; stripeEventId?: string } = {},
): Promise<number> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} + ${amount}` })
      .where(eq(users.id, userId))
      .returning({ creditBalance: users.creditBalance });

    await tx.insert(creditTransactions).values({
      userId,
      amount,
      reason,
      ...(options.newsletterId ? { newsletterId: options.newsletterId } : {}),
      ...(options.stripeEventId ? { stripeEventId: options.stripeEventId } : {}),
    });

    return updated!.creditBalance;
  });
}

export async function getCreditsUsedThisCycle(userId: string): Promise<number> {
  const [lastGrant] = await db
    .select({ createdAt: creditTransactions.createdAt })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        inArray(creditTransactions.reason, ["subscription_grant", "trial_grant"]),
      ),
    )
    .orderBy(desc(creditTransactions.createdAt))
    .limit(1);

  const cycleStart = lastGrant?.createdAt ?? new Date(0);

  const [usage] = await db
    .select({ total: sql<string>`coalesce(sum(${creditTransactions.amount}), 0)` })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        inArray(creditTransactions.reason, ["generation_debit", "generation_refund"]),
        gte(creditTransactions.createdAt, cycleStart),
      ),
    );

  return Math.max(0, -Number(usage?.total ?? 0));
}
