import type { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(err);

  const status = err instanceof MulterError ? 400 : (err.statusCode ?? 500);
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : err.message;

  res.status(status).json({ error: message });
}
