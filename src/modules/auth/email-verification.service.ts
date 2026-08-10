import { eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { emailVerificationTokens, users } from "../../database/schema/schema.js";
import {
  generateVerificationTokenRaw,
  hashToken,
  verificationTokenExpiry,
} from "../../shared/utils/security.js";

export async function createVerificationToken(userId: string): Promise<string> {
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));

  const rawToken = generateVerificationTokenRaw();

  await db.insert(emailVerificationTokens).values({
    userId,
    hashedToken: hashToken(rawToken),
    expiresAt: verificationTokenExpiry(),
  });

  return rawToken;
}

export async function confirmVerificationToken(
  rawToken: string,
): Promise<"confirmed" | "invalid" | "expired"> {
  const [stored] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.hashedToken, hashToken(rawToken)))
    .limit(1);

  if (!stored) {
    return "invalid";
  }

  if (stored.expiresAt < new Date()) {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, stored.id));
    return "expired";
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ isEmailVerified: true, updatedAt: new Date() }).where(eq(users.id, stored.userId));
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, stored.userId));
  });

  return "confirmed";
}
