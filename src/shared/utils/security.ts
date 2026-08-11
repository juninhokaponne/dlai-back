import { hash, verify } from "@node-rs/argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production.");
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret";
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 7;
const EMAIL_VERIFICATION_TTL_HOURS = 48;
const PASSWORD_RESET_TTL_HOURS = 1;

export async function hashPassword(password: string): Promise<string> {
  return await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

export async function verifyPassword(
  password: string,
  hashStr: string,
): Promise<boolean> {
  return await verify(hashStr, password);
}

export function generateAccessToken(payload: {
  userId: string;
  email: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): {
  userId: string;
  email: string;
} {
  return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
}

export function generateRefreshTokenRaw(): string {
  return crypto.randomBytes(40).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
}

export function generateVerificationTokenRaw(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function verificationTokenExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFICATION_TTL_HOURS);
  return expiresAt;
}

export function passwordResetTokenExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_TTL_HOURS);
  return expiresAt;
}
