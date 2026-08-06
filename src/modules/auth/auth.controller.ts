import type { Request, Response } from "express";
import { db } from "../../database/index.js";
import { refreshTokens, users } from "../../database/schema/schema.js";
import {
  generateAccessToken,
  generateRefreshTokenRaw,
  hashPassword,
  hashToken,
  verifyPassword,
} from "../../shared/utils/security.js";
import { eq } from "drizzle-orm";

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { name, lastname, age, email, password, company } = req.body;
      const lastName = lastname;

      if (!email || !name || !password) {
        return res.status(400).json({
          error: "All fields are required.",
        });
      }

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        res.status(409).json({
          error: "User already exists.",
        });
      }

      const passwordHash = await hashPassword(password);

      const [newUser] = await db
        .insert(users)
        .values({ name, lastName, age, company, email, passwordHash })
        .returning();

      console.log(newUser);

      return res.status(201).json({
        message: "User created successfuly!",
        user: {
          id: newUser?.id,
          name: newUser?.name,
          email: newUser?.email,
        },
      });
    } catch (err) {
      console.error(err);
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(401).json({
          error: "All fiels are required!",
        });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!user) {
        return res.status(401).json({
          error: "Invalid credentials",
        });
      }

      const isValidPassword = await verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        res.status(401).json({
          error: "Invalid credentials",
        });
      }

      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
      });
      const rawRefreshToken = generateRefreshTokenRaw();
      const hashedRefreshToken = hashToken(rawRefreshToken);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 valid days

      await db.insert(refreshTokens).values({
        userId: user.id,
        hashedToken: hashedRefreshToken,
        expiresAt,
      });

      res.cookie("refreshTokens", rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        expires: expiresAt,
        path: "/auth/refresh",
      });

      return res.json({
        accessToken,
        user: { id: user.id, name: user.name, email: user.email },
      });
    } catch (err) {
      console.error(err);
      throw new Error("Server Error");
    }
  }
}
