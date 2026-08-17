import type { NextFunction, Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import { segments, tags } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import type { SegmentCondition } from "../../shared/segments/segments.service.js";

const idParamSchema = z.string().uuid();

async function ensureConditionsTagsOwned(organizationId: string, conditions: SegmentCondition[]): Promise<boolean> {
  const tagIds = new Set<string>();
  for (const condition of conditions) {
    if (condition.type === "tag") tagIds.add(condition.tagId);
    if (condition.type === "tagAny") condition.tagIds.forEach((id) => tagIds.add(id));
  }
  if (tagIds.size === 0) return true;

  const owned = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.organizationId, organizationId), inArray(tags.id, Array.from(tagIds))));

  return owned.length === tagIds.size;
}

function toResponseShape(row: typeof segments.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    conditions: (row.rules as { conditions: SegmentCondition[] }).conditions,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SegmentsController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db
        .select()
        .from(segments)
        .where(eq(segments.organizationId, req.user!.organizationId))
        .orderBy(segments.name);

      return res.json({ segments: rows.map(toResponseShape) });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, conditions } = req.body as { name: string; conditions: SegmentCondition[] };

      const tagsOwned = await ensureConditionsTagsOwned(req.user!.organizationId, conditions);
      if (!tagsOwned) {
        return res.status(400).json({ error: "One or more tags in this segment don't exist." });
      }

      const [segment] = await db
        .insert(segments)
        .values({ organizationId: req.user!.organizationId, name, rules: { conditions } })
        .returning();

      return res.status(201).json({ segment: toResponseShape(segment!) });
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid segment id." });
      }
      const { name, conditions } = req.body as { name: string; conditions: SegmentCondition[] };

      const tagsOwned = await ensureConditionsTagsOwned(req.user!.organizationId, conditions);
      if (!tagsOwned) {
        return res.status(400).json({ error: "One or more tags in this segment don't exist." });
      }

      const [segment] = await db
        .update(segments)
        .set({ name, rules: { conditions }, updatedAt: new Date() })
        .where(and(eq(segments.id, parsedId.data), eq(segments.organizationId, req.user!.organizationId)))
        .returning();

      if (!segment) {
        return res.status(404).json({ error: "Segment not found." });
      }

      return res.json({ segment: toResponseShape(segment) });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid segment id." });
      }

      const [deleted] = await db
        .delete(segments)
        .where(and(eq(segments.id, parsedId.data), eq(segments.organizationId, req.user!.organizationId)))
        .returning({ id: segments.id });

      if (!deleted) {
        return res.status(404).json({ error: "Segment not found." });
      }

      return res.json({ message: "Segment deleted." });
    } catch (err) {
      next(err);
    }
  }
}
