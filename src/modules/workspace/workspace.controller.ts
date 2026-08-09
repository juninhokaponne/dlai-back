import type { NextFunction, Response } from "express";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { contacts, newsletters, users } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { AIService } from "../../shared/ai/ai.service.js";
import { OpenRouterProvider } from "../../shared/ai/openrouter.provider.js";
import { createNewsletter, startNewsletterGeneration } from "../newsletter/newsletter.service.js";

const aiService = new AIService(new OpenRouterProvider());
const MAX_SUGGESTIONS = 5;
const RECENT_TOPICS_SAMPLE = 10;

export class WorkspaceController {
  async overview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;

      const [user] = await db
        .select({ creditBalance: users.creditBalance })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const statusRows = await db
        .select({ status: newsletters.status, count: count() })
        .from(newsletters)
        .where(eq(newsletters.userId, userId))
        .groupBy(newsletters.status);

      const newslettersByStatus = Object.fromEntries(
        statusRows.map((row) => [row.status, row.count]),
      );

      const subscribedContacts = await db.$count(
        contacts,
        and(eq(contacts.userId, userId), eq(contacts.status, "subscribed")),
      );

      const recentNewsletters = await db
        .select({
          id: newsletters.id,
          topic: newsletters.topic,
          title: newsletters.title,
          status: newsletters.status,
          createdAt: newsletters.createdAt,
        })
        .from(newsletters)
        .where(eq(newsletters.userId, userId))
        .orderBy(desc(newsletters.createdAt))
        .limit(5);

      return res.json({
        creditBalance: user?.creditBalance ?? 0,
        newslettersByStatus,
        subscribedContacts,
        recentNewsletters,
      });
    } catch (err) {
      next(err);
    }
  }

  async aiSuggestions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;

      const recent = await db
        .select({ topic: newsletters.topic })
        .from(newsletters)
        .where(eq(newsletters.userId, userId))
        .orderBy(desc(newsletters.createdAt))
        .limit(RECENT_TOPICS_SAMPLE);

      const topics = recent.map((r) => r.topic);

      const prompt =
        topics.length > 0
          ? `Baseado nesses temas anteriores de newsletter do usuario: ${topics.join(", ")}. Sugira ${MAX_SUGGESTIONS} novos temas de newsletter relacionados, criativos e especificos. Um por linha, sem numeracao, sem explicacao.`
          : `Sugira ${MAX_SUGGESTIONS} temas interessantes e variados para uma newsletter. Um por linha, sem numeracao, sem explicacao.`;

      const result = await aiService.run("title", prompt);

      const suggestions = result.content
        .split("\n")
        .map((line) => line.trim().replace(/^[-*\d.]+\s*/, ""))
        .filter(Boolean)
        .slice(0, MAX_SUGGESTIONS);

      return res.json({ suggestions });
    } catch (err) {
      next(err);
    }
  }

  async generate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { topic, model } = req.body;
      const userId = req.user!.userId;

      const newsletter = await createNewsletter(userId, topic);
      const { newsletter: updated, creditBalance } = await startNewsletterGeneration(
        newsletter.id,
        userId,
        model,
      );

      return res.status(202).json({ newsletter: updated, creditBalance });
    } catch (err) {
      next(err);
    }
  }
}
