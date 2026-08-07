import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  refreshTokens,
  users,
  creditTransactions,
} from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { TRIAL_CREDITS } from "../../shared/billing/credits.config.js";
import {
  generateAccessToken,
  generateRefreshTokenRaw,
  hashPassword,
  hashToken,
  refreshTokenExpiry,
  verifyPassword,
} from "../../shared/utils/security.js";

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth",
};

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, lastname, age, email, password, company } = req.body;
      const lastName = lastname;

      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(409).json({ error: "User already exists." });
      }

      const passwordHash = await hashPassword(password);

      const newUser = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values({ name, lastName, age, company, email, passwordHash })
          .returning();

        await tx.insert(creditTransactions).values({
          userId: created!.id,
          amount: TRIAL_CREDITS,
          reason: "trial_grant",
        });

        return created;
      });

      return res.status(201).json({
        message: "User created successfully!",
        user: {
          id: newUser?.id,
          name: newUser?.name,
          email: newUser?.email,
          creditBalance: newUser?.creditBalance,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValidPassword = await verifyPassword(
        password,
        user.passwordHash,
      );
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
      });
      const rawRefreshToken = generateRefreshTokenRaw();
      const expiresAt = refreshTokenExpiry();

      await db.insert(refreshTokens).values({
        userId: user.id,
        hashedToken: hashToken(rawRefreshToken),
        expiresAt,
      });

      res.cookie(REFRESH_COOKIE, rawRefreshToken, {
        ...REFRESH_COOKIE_OPTIONS,
        expires: expiresAt,
      });

      return res.json({
        accessToken,
        user: { id: user.id, name: user.name, email: user.email },
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const rawToken = req.cookies?.[REFRESH_COOKIE];
      if (!rawToken) {
        return res.status(401).json({ error: "Refresh token missing." });
      }

      const hashedToken = hashToken(rawToken);
      const [stored] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.hashedToken, hashedToken))
        .limit(1);

      if (
        !stored ||
        stored.isRevoked ||
        stored.expiresAt.getTime() < Date.now()
      ) {
        res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
        return res.status(401).json({ error: "Invalid refresh token." });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, stored.userId))
        .limit(1);

      if (!user) {
        return res.status(401).json({ error: "Invalid refresh token." });
      }

      await db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.id, stored.id));

      const rawRefreshToken = generateRefreshTokenRaw();
      const expiresAt = refreshTokenExpiry();

      await db.insert(refreshTokens).values({
        userId: user.id,
        hashedToken: hashToken(rawRefreshToken),
        expiresAt,
      });

      res.cookie(REFRESH_COOKIE, rawRefreshToken, {
        ...REFRESH_COOKIE_OPTIONS,
        expires: expiresAt,
      });

      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
      });

      return res.json({ accessToken });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const rawToken = req.cookies?.[REFRESH_COOKIE];
      if (rawToken) {
        await db
          .update(refreshTokens)
          .set({ isRevoked: true })
          .where(eq(refreshTokens.hashedToken, hashToken(rawToken)));
      }

      res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          lastName: users.lastName,
          email: users.email,
          company: users.company,
          isEmailVerified: users.isEmailVerified,
          creditBalance: users.creditBalance,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, req.user!.userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      return res.json({ user });
    } catch (err) {
      next(err);
    }
  }
}
