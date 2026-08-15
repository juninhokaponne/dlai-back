import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  organizations,
  creditTransactions,
  type creditTransactionReason,
} from "../../database/schema/schema.js";
import { InsufficientCreditsError } from "./billing.errors.js";

type CreditReason = (typeof creditTransactionReason.enumValues)[number];

export interface DebitCreditsParams {
  organizationId: string;
  userId: string;
  amount: number;
  reason: CreditReason;
  newsletterId?: string;
}

export async function debitCredits(params: DebitCreditsParams): Promise<number> {
  const { organizationId, userId, amount, reason, newsletterId } = params;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(organizations)
      .set({ creditBalance: sql`${organizations.creditBalance} - ${amount}` })
      .where(and(eq(organizations.id, organizationId), gte(organizations.creditBalance, amount)))
      .returning({ creditBalance: organizations.creditBalance });

    if (!updated) {
      throw new InsufficientCreditsError();
    }

    await tx.insert(creditTransactions).values({
      organizationId,
      userId,
      amount: -amount,
      reason,
      ...(newsletterId ? { newsletterId } : {}),
    });

    return updated.creditBalance;
  });
}

export interface CreditCreditsParams {
  organizationId: string;
  userId: string;
  amount: number;
  reason: CreditReason;
  newsletterId?: string;
  stripeEventId?: string;
}

export async function creditCredits(params: CreditCreditsParams): Promise<number> {
  const { organizationId, userId, amount, reason, newsletterId, stripeEventId } = params;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(organizations)
      .set({ creditBalance: sql`${organizations.creditBalance} + ${amount}` })
      .where(eq(organizations.id, organizationId))
      .returning({ creditBalance: organizations.creditBalance });

    await tx.insert(creditTransactions).values({
      organizationId,
      userId,
      amount,
      reason,
      ...(newsletterId ? { newsletterId } : {}),
      ...(stripeEventId ? { stripeEventId } : {}),
    });

    return updated!.creditBalance;
  });
}

export async function getCreditsUsedThisCycle(organizationId: string): Promise<number> {
  const [lastGrant] = await db
    .select({ createdAt: creditTransactions.createdAt })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.organizationId, organizationId),
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
        eq(creditTransactions.organizationId, organizationId),
        inArray(creditTransactions.reason, ["generation_debit", "generation_refund"]),
        gte(creditTransactions.createdAt, cycleStart),
      ),
    );

  return Math.max(0, -Number(usage?.total ?? 0));
}
