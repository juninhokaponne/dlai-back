import type { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";
import { createLogger } from "../logger/logger.js";

const logger = createLogger("error-handler");

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  logger.error({ err }, "Request failed");

  const status = err instanceof MulterError ? 400 : (err.statusCode ?? 500);
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : err.message;

  res.status(status).json({ error: message });
}
