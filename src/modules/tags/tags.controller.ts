import type { NextFunction, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import { tags } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";

const idParamSchema = z.string().uuid();

export class TagsController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db
        .select({ id: tags.id, name: tags.name, createdAt: tags.createdAt })
        .from(tags)
        .where(eq(tags.organizationId, req.user!.organizationId))
        .orderBy(tags.name);

      return res.json({ tags: rows });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;

      const [existing] = await db
        .select({ id: tags.id, name: tags.name, createdAt: tags.createdAt })
        .from(tags)
        .where(and(eq(tags.organizationId, req.user!.organizationId), eq(tags.name, name)))
        .limit(1);

      if (existing) {
        return res.status(200).json({ tag: existing });
      }

      const [tag] = await db
        .insert(tags)
        .values({ organizationId: req.user!.organizationId, name })
        .returning({ id: tags.id, name: tags.name, createdAt: tags.createdAt });

      return res.status(201).json({ tag });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid tag id." });
      }

      const [deleted] = await db
        .delete(tags)
        .where(and(eq(tags.id, parsedId.data), eq(tags.organizationId, req.user!.organizationId)))
        .returning({ id: tags.id });

      if (!deleted) {
        return res.status(404).json({ error: "Tag not found." });
      }

      return res.json({ message: "Tag deleted." });
    } catch (err) {
      next(err);
    }
  }
}
