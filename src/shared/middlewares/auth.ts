import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/security.js";

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}
