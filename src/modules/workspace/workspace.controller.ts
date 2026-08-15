import type { NextFunction, Response } from "express";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { contacts, newsletters, organizations, users } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { AIService } from "../../shared/ai/ai.service.js";
import { OpenRouterProvider } from "../../shared/ai/openrouter.provider.js";
import { createNewsletter, startNewsletterGeneration } from "../newsletter/newsletter.service.js";
import { debitCredits } from "../../shared/billing/credits.service.js";
import { QUICK_ACTION_CREDIT_COST } from "../../shared/billing/credits.config.js";
import { MATCH_INPUT_LANGUAGE_INSTRUCTION, languageInstructionForLocale } from "../../shared/ai/language-instruction.js";

const aiService = new AIService(new OpenRouterProvider());
const MAX_SUGGESTIONS = 5;
const RECENT_TOPICS_SAMPLE = 10;

function splitLines(content: string, max: number): string[] {
  return content
    .split("\n")
    .map((line) => line.trim().replace(/^[-*\d.]+\s*/, ""))
    .filter(Boolean)
    .slice(0, max);
}

export class WorkspaceController {
  async overview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.user!;

      const [organization] = await db
        .select({ creditBalance: organizations.creditBalance })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      const statusRows = await db
        .select({ status: newsletters.status, count: count() })
        .from(newsletters)
        .where(eq(newsletters.organizationId, organizationId))
        .groupBy(newsletters.status);

      const newslettersByStatus = Object.fromEntries(
        statusRows.map((row) => [row.status, row.count]),
      );

      const subscribedContacts = await db.$count(
        contacts,
        and(eq(contacts.organizationId, organizationId), eq(contacts.status, "subscribed")),
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
        .where(eq(newsletters.organizationId, organizationId))
        .orderBy(desc(newsletters.createdAt))
        .limit(5);

      return res.json({
        creditBalance: organization?.creditBalance ?? 0,
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

      const [user] = await db
        .select({ locale: users.locale })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const recent = await db
        .select({ topic: newsletters.topic })
        .from(newsletters)
        .where(eq(newsletters.organizationId, req.user!.organizationId))
        .orderBy(desc(newsletters.createdAt))
        .limit(RECENT_TOPICS_SAMPLE);

      const topics = recent.map((r) => r.topic);

      const prompt =
        topics.length > 0
          ? `Based on these previous newsletter topics from the user: ${topics.join(", ")}. Suggest ${MAX_SUGGESTIONS} new, related, creative and specific newsletter topics. One per line, no numbering, no explanation.

${languageInstructionForLocale(user?.locale ?? "en")}`
          : `Suggest ${MAX_SUGGESTIONS} interesting and varied newsletter topics. One per line, no numbering, no explanation.

${languageInstructionForLocale(user?.locale ?? "en")}`;

      const result = await aiService.run("title", prompt);
      const suggestions = splitLines(result.content, MAX_SUGGESTIONS);

      return res.json({ suggestions });
    } catch (err) {
      next(err);
    }
  }

  async rewrite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { text } = req.body;

      const creditBalance = await debitCredits({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        amount: QUICK_ACTION_CREDIT_COST,
        reason: "generation_debit",
      });

      const result = await aiService.run(
        "body",
        `Rewrite the text below to be more concise, engaging and well written, keeping the same language and original meaning. Reply only with the rewritten text, no comments or explanations.\n\nOriginal text:\n"""${text}"""\n\n${MATCH_INPUT_LANGUAGE_INSTRUCTION}`,
      );

      return res.json({ result: result.content.trim(), creditBalance });
    } catch (err) {
      next(err);
    }
  }

  async summarize(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { text } = req.body;

      const creditBalance = await debitCredits({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        amount: QUICK_ACTION_CREDIT_COST,
        reason: "generation_debit",
      });

      const result = await aiService.run(
        "body",
        `Summarize the content below (it may be a blog post, article or notes) into a format ready to become a newsletter: a short opening paragraph followed by the main points. Keep the same language as the original text. Reply only with the summary, no comments.\n\nOriginal content:\n"""${text}"""\n\n${MATCH_INPUT_LANGUAGE_INSTRUCTION}`,
      );

      return res.json({ result: result.content.trim(), creditBalance });
    } catch (err) {
      next(err);
    }
  }

  async subjectLines(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { text } = req.body;

      const creditBalance = await debitCredits({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        amount: QUICK_ACTION_CREDIT_COST,
        reason: "generation_debit",
      });

      const result = await aiService.run(
        "title",
        `Generate ${MAX_SUGGESTIONS} catchy email subject line suggestions for the content below, in the same language as the text. One per line, no numbering, no quotes, no explanation.\n\nContent:\n"""${text}"""\n\n${MATCH_INPUT_LANGUAGE_INSTRUCTION}`,
      );

      const suggestions = splitLines(result.content, MAX_SUGGESTIONS);

      return res.json({ suggestions, creditBalance });
    } catch (err) {
      next(err);
    }
  }

  async generate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { topic, model } = req.body;
      const { userId, organizationId } = req.user!;

      const newsletter = await createNewsletter(organizationId, userId, topic);
      const { newsletter: updated, creditBalance } = await startNewsletterGeneration(
        newsletter.id,
        organizationId,
        userId,
        model,
      );

      return res.status(202).json({ newsletter: updated, creditBalance });
    } catch (err) {
      next(err);
    }
  }
}
