import type { NextFunction, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import { newsletters, templates } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { AIService } from "../../shared/ai/ai.service.js";
import { OpenRouterProvider } from "../../shared/ai/openrouter.provider.js";
import { buildEmailDesignInstructions } from "../../shared/ai/email-design-prompt.js";
import { MATCH_INPUT_LANGUAGE_INSTRUCTION } from "../../shared/ai/language-instruction.js";
import { createNotification } from "../../shared/notifications/notifications.service.js";

const aiService = new AIService(new OpenRouterProvider());
const idParamSchema = z.string().uuid();

export class TemplatesController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db
        .select()
        .from(templates)
        .where(eq(templates.userId, req.user!.userId))
        .orderBy(desc(templates.createdAt));

      return res.json({ templates: rows });
    } catch (err) {
      next(err);
    }
  }

  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid template id." });
      }

      const [template] = await db
        .select()
        .from(templates)
        .where(and(eq(templates.id, parsedId.data), eq(templates.userId, req.user!.userId)))
        .limit(1);

      if (!template) {
        return res.status(404).json({ error: "Template not found." });
      }

      return res.json({ template });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, description, category, contentHtml } = req.body;

      const [template] = await db
        .insert(templates)
        .values({
          userId: req.user!.userId,
          name,
          contentHtml,
          ...(description !== undefined ? { description } : {}),
          ...(category !== undefined ? { category } : {}),
        })
        .returning();

      return res.status(201).json({ template });
    } catch (err) {
      next(err);
    }
  }

  async generateWithAi(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, description, category, useImages, useLinks } = req.body;

      const prompt = `Write the body of a reusable newsletter email template. The template is called "${name}" and its description/purpose is: "${description}". Be concise.

${buildEmailDesignInstructions({ useImages, useLinks })}

You can personalize the email using exactly these placeholders (with double curly braces), without inventing other variants: {{name}} for the subscriber's name, {{sender_name}} for the sender's name, {{company}} for the sender's company, and {{date}} for today's date. Only use the ones that make sense for the content - don't force the use of all of them.

${MATCH_INPUT_LANGUAGE_INSTRUCTION}`;
      const result = await aiService.run("body", prompt);

      const [template] = await db
        .insert(templates)
        .values({
          userId: req.user!.userId,
          name,
          description,
          contentHtml: result.content.trim(),
          aiGenerated: true,
          ...(category !== undefined ? { category } : {}),
        })
        .returning();

      return res.status(201).json({ template });
    } catch (err) {
      next(err);
    }
  }

  async useForNewsletter(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid template id." });
      }

      const [template] = await db
        .select()
        .from(templates)
        .where(and(eq(templates.id, parsedId.data), eq(templates.userId, req.user!.userId)))
        .limit(1);

      if (!template) {
        return res.status(404).json({ error: "Template not found." });
      }

      const [newsletter] = await db
        .insert(newsletters)
        .values({
          userId: req.user!.userId,
          topic: template.name,
          title: template.name,
          content: template.contentHtml,
          status: "ready",
        })
        .returning();

      await createNotification({
        userId: req.user!.userId,
        type: "newsletter_generated",
        newsletterId: newsletter!.id,
      });

      return res.status(201).json({ newsletter });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid template id." });
      }

      const [deleted] = await db
        .delete(templates)
        .where(and(eq(templates.id, parsedId.data), eq(templates.userId, req.user!.userId)))
        .returning({ id: templates.id });

      if (!deleted) {
        return res.status(404).json({ error: "Template not found." });
      }

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
