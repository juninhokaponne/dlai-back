import { eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { passwordResetTokens, refreshTokens, users } from "../../database/schema/schema.js";
import { generateVerificationTokenRaw, hashToken, passwordResetTokenExpiry } from "../../shared/utils/security.js";
import type { EmailLocale } from "../../shared/email/templates/copy.js";

export async function createPasswordResetToken(userId: string): Promise<string> {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));

  const rawToken = generateVerificationTokenRaw();

  await db.insert(passwordResetTokens).values({
    userId,
    hashedToken: hashToken(rawToken),
    expiresAt: passwordResetTokenExpiry(),
  });

  return rawToken;
}

export type ConfirmPasswordResetResult =
  | { status: "confirmed"; email: string; name: string; locale: EmailLocale }
  | { status: "invalid" }
  | { status: "expired" };

export async function confirmPasswordResetToken(
  rawToken: string,
  newPasswordHash: string,
): Promise<ConfirmPasswordResetResult> {
  const [stored] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.hashedToken, hashToken(rawToken)))
    .limit(1);

  if (!stored) {
    return { status: "invalid" };
  }

  if (stored.expiresAt < new Date()) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, stored.id));
    return { status: "expired" };
  }

  const [user] = await db
    .select({ email: users.email, name: users.name, locale: users.locale })
    .from(users)
    .where(eq(users.id, stored.userId))
    .limit(1);

  if (!user) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, stored.id));
    return { status: "invalid" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, stored.userId));

    await tx.update(refreshTokens).set({ isRevoked: true }).where(eq(refreshTokens.userId, stored.userId));

    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, stored.userId));
  });

  return { status: "confirmed", email: user.email, name: user.name, locale: user.locale as EmailLocale };
}
