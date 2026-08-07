import { and, eq, gte, sql } from "drizzle-orm";
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
