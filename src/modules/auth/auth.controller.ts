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
import { SpacesStorageProvider } from "../../shared/storage/spaces.provider.js";
import {
  generateAccessToken,
  generateRefreshTokenRaw,
  hashPassword,
  hashToken,
  refreshTokenExpiry,
  verifyPassword,
} from "../../shared/utils/security.js";

const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

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

      // No auth middleware runs on this route (the user doesn't exist yet
      // when the request starts), so attach the identity we just created
      // for the request-completion log line to pick up.
      (req as AuthenticatedRequest).user = { userId: newUser!.id, email: newUser!.email };

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

      // Same reasoning as register(): requireAuth never runs on this route,
      // so attach the identity for the request-completion log line.
      (req as AuthenticatedRequest).user = { userId: user.id, email: user.email };

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

      // Same reasoning as register()/login(): requireAuth never runs on
      // this route, so attach the identity for the request-completion log.
      (req as AuthenticatedRequest).user = { userId: user.id, email: user.email };

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
          avatarUrl: users.avatarUrl,
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

  async updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, lastname, company } = req.body;

      const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (lastname !== undefined) updates.lastName = lastname;
      if (company !== undefined) updates.company = company;

      const [user] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, req.user!.userId))
        .returning({
          id: users.id,
          name: users.name,
          lastName: users.lastName,
          email: users.email,
          company: users.company,
          avatarUrl: users.avatarUrl,
          isEmailVerified: users.isEmailVerified,
          creditBalance: users.creditBalance,
          createdAt: users.createdAt,
        });

      return res.json({ user });
    } catch (err) {
      next(err);
    }
  }

  async uploadAvatar(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Image file is required (field 'avatar')." });
      }

      const extension = AVATAR_EXTENSION_BY_MIME[file.mimetype];
      if (!extension) {
        return res.status(400).json({ error: "Only PNG, JPEG or WEBP images are allowed." });
      }

      const storage = new SpacesStorageProvider();
      const avatarUrl = await storage.uploadAvatar(req.user!.userId, file.buffer, file.mimetype, extension);

      const [user] = await db
        .update(users)
        .set({ avatarUrl, updatedAt: new Date() })
        .where(eq(users.id, req.user!.userId))
        .returning({
          id: users.id,
          name: users.name,
          lastName: users.lastName,
          email: users.email,
          company: users.company,
          avatarUrl: users.avatarUrl,
          isEmailVerified: users.isEmailVerified,
          creditBalance: users.creditBalance,
          createdAt: users.createdAt,
        });

      return res.json({ user });
    } catch (err) {
      next(err);
    }
  }
}
