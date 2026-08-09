import type { NextFunction, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import { newsletters } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { getNewsletterSendQueue } from "../../queue/newsletter-send.queue.js";
import { contacts } from "../../database/schema/schema.js";
import { createNewsletter, startNewsletterGeneration } from "./newsletter.service.js";

const idParamSchema = z.string().uuid();

async function findOwnedNewsletter(id: string, userId: string) {
  const [newsletter] = await db
    .select()
    .from(newsletters)
    .where(and(eq(newsletters.id, id), eq(newsletters.userId, userId)))
    .limit(1);

  return newsletter;
}

export class NewsletterController {
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
      const newsletter = await createNewsletter(req.user!.userId, topic);
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

      const newsletter = await findOwnedNewsletter(
        parsedId.data,
        req.user!.userId,
      );
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

  async generate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid newsletter id." });
      }

      const newsletter = await findOwnedNewsletter(
        parsedId.data,
        req.user!.userId,
      );
      if (!newsletter) {
        return res.status(404).json({ error: "Newsletter not found." });
      }

      if (newsletter.status === "generating") {
        return res
          .status(409)
          .json({ error: "Generation already in progress for this newsletter." });
      }

      const { newsletter: updated, creditBalance } = await startNewsletterGeneration(
        newsletter.id,
        req.user!.userId,
      );

      return res.status(202).json({ newsletter: updated, creditBalance });
    } catch (err) {
      next(err);
    }
  }

  async send(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid newsletter id." });
      }

      const newsletter = await findOwnedNewsletter(
        parsedId.data,
        req.user!.userId,
      );
      if (!newsletter) {
        return res.status(404).json({ error: "Newsletter not found." });
      }

      if (newsletter.status === "sending") {
        return res
          .status(409)
          .json({ error: "This newsletter is already being sent." });
      }

      if (newsletter.status !== "ready" && newsletter.status !== "sent") {
        return res.status(409).json({
          error: "Newsletter must be generated (status 'ready') before sending.",
        });
      }

      const count = await db.$count(
        contacts,
        and(eq(contacts.userId, req.user!.userId), eq(contacts.status, "subscribed")),
      );

      if (count === 0) {
        return res
          .status(400)
          .json({ error: "No subscribed contacts to send this newsletter to." });
      }

      const [updated] = await db
        .update(newsletters)
        .set({ status: "sending", updatedAt: new Date() })
        .where(eq(newsletters.id, newsletter.id))
        .returning();

      await getNewsletterSendQueue().add("send", {
        newsletterId: newsletter.id,
        userId: req.user!.userId,
      });

      return res
        .status(202)
        .json({ newsletter: updated, recipientCount: count });
    } catch (err) {
      next(err);
    }
  }
}
