import { hash, verify } from "@node-rs/argon2";
import jwt from "jsonwebtoken";
import crytpo from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-access-lets-rock";

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
  console.log("hashStr", hashStr);
  console.log("password", password);
  return await verify(hashStr, password);
}

export function generateAccessToken(payload: {
  userId: string;
  email: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function generateRefreshTokenRaw(): string {
  return crytpo.randomBytes(40).toString("hex");
}

export function hashToken(token: string): string {
  return crytpo.createHash("sha256").update(token).digest("hex");
}
