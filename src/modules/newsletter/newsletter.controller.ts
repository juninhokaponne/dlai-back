import type { NextFunction, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import { newsletters } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import type { AIService } from "../../shared/ai/ai.service.js";

const idParamSchema = z.string().uuid();

export class NewsletterController {
  constructor(_aiService: AIService) {}

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db
        .select()
        .from(newsletters)
        .where(eq(newsletters.userId, req.user!.userId))
        .orderBy(desc(newsletters.createdAt));

      return res.json({ newsletters: rows });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { topic } = req.body;

      const [newsletter] = await db
        .insert(newsletters)
        .values({ userId: req.user!.userId, topic })
        .returning();

      return res.status(201).json({ newsletter });
    } catch (err) {
      next(err);
    }
  }

  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid newsletter id." });
      }

      const [newsletter] = await db
        .select()
        .from(newsletters)
        .where(
          and(
            eq(newsletters.id, parsedId.data),
            eq(newsletters.userId, req.user!.userId),
          ),
        )
        .limit(1);

      if (!newsletter) {
        return res.status(404).json({ error: "Newsletter not found." });
      }

      return res.json({ newsletter });
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid newsletter id." });
      }

      const updates = req.body;
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update." });
      }

      const [newsletter] = await db
        .update(newsletters)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(
            eq(newsletters.id, parsedId.data),
            eq(newsletters.userId, req.user!.userId),
          ),
        )
        .returning();

      if (!newsletter) {
        return res.status(404).json({ error: "Newsletter not found." });
      }

      return res.json({ newsletter });
    } catch (err) {
      next(err);
    }
  }
}
