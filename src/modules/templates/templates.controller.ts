import type { NextFunction, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import { templates } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { AIService } from "../../shared/ai/ai.service.js";
import { OpenRouterProvider } from "../../shared/ai/openrouter.provider.js";

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
      const { name, description, category } = req.body;

      const prompt = `Gere o corpo de um template de email de newsletter reutilizavel, em HTML simples (sem tags html/head/body, so o conteudo com paragrafos, titulos e placeholders como [Nome], [Empresa] onde fizer sentido). O template se chama "${name}" e a descricao/objetivo e: "${description}". Seja conciso.`;
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
