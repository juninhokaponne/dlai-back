import type { NextFunction, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import { automationSendEvents } from "../../database/schema/schema.js";

const idParamSchema = z.string().uuid();

// 1x1 transparent PNG.
const TRACKING_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

export class TrackingController {
  async open(req: Request, res: Response, next: NextFunction) {
    try {
      const rawId = typeof req.params.sendEventId === "string" ? req.params.sendEventId.replace(/\.png$/, "") : "";
      const parsedId = idParamSchema.safeParse(rawId);

      if (parsedId.success) {
        await db
          .update(automationSendEvents)
          .set({ openedAt: new Date() })
          .where(and(eq(automationSendEvents.id, parsedId.data), isNull(automationSendEvents.openedAt)));
      }

      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "no-store");
      return res.status(200).send(TRACKING_PIXEL);
    } catch (err) {
      next(err);
    }
  }

  async click(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.sendEventId);
      const encodedUrl = typeof req.query.u === "string" ? req.query.u : "";

      let targetUrl = "/";
      try {
        const decoded = Buffer.from(encodedUrl, "base64url").toString("utf-8");
        const parsed = new URL(decoded);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          targetUrl = decoded;
        }
      } catch {
        // Falls back to "/" below.
      }

      if (parsedId.success) {
        await db
          .update(automationSendEvents)
          .set({ clickedAt: new Date() })
          .where(and(eq(automationSendEvents.id, parsedId.data), isNull(automationSendEvents.clickedAt)));
      }

      return res.redirect(302, targetUrl);
    } catch (err) {
      next(err);
    }
  }
}
