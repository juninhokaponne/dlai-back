import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/security.js";

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; organizationId: string; role: "admin" | "member" };
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

export function requireRole(role: "admin" | "member") {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: "You don't have permission to do this." });
    }
    next();
  };
}
