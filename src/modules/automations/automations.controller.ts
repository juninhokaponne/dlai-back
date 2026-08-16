import type { NextFunction, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import { automations, users } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { computeNextRunAt, type RecurringSchedule } from "../../shared/automations/schedule.js";
import type { GraphNode } from "../../shared/automations/graph-walk.js";

const idParamSchema = z.string().uuid();

export class AutomationsController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db
        .select({
          id: automations.id,
          userId: automations.userId,
          name: automations.name,
          status: automations.status,
          updatedAt: automations.updatedAt,
          createdByName: users.name,
        })
        .from(automations)
        .innerJoin(users, eq(automations.userId, users.id))
        .where(eq(automations.organizationId, req.user!.organizationId))
        .orderBy(desc(automations.updatedAt));

      return res.json({ automations: rows });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const name =
        typeof req.body.name === "string" && req.body.name.trim()
          ? req.body.name.trim()
          : "Untitled automation";

      const [automation] = await db
        .insert(automations)
        .values({
          userId: req.user!.userId,
          organizationId: req.user!.organizationId,
          name,
          status: "draft",
          nodes: [],
          edges: [],
        })
        .returning();

      return res.status(201).json({ automation });
    } catch (err) {
      next(err);
    }
  }

  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid automation id." });
      }

      const [automation] = await db
        .select()
        .from(automations)
        .where(and(eq(automations.id, parsedId.data), eq(automations.organizationId, req.user!.organizationId)))
        .limit(1);

      if (!automation) {
        return res.status(404).json({ error: "Automation not found." });
      }

      return res.json({ automation });
    } catch (err) {
      next(err);
    }
  }

  async save(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid automation id." });
      }

      const { name, status, nodes, edges } = req.body;

      let nextRunAt: Date | null = null;
      if (status === "active" && Array.isArray(nodes)) {
        const trigger = (nodes as GraphNode[]).find(
          (node) => node.type === "trigger" && node.data?.subtype === "recurring_schedule",
        );
        const rawConfig = trigger?.data.config;
        if (rawConfig?.time) {
          const [owner] = await db
            .select({ timezone: users.timezone })
            .from(users)
            .where(eq(users.id, req.user!.userId))
            .limit(1);
          const schedule: RecurringSchedule = {
            time: rawConfig.time,
            days: JSON.parse(rawConfig.days ?? "[]"),
          };
          nextRunAt = computeNextRunAt(schedule, owner?.timezone ?? "America/Sao_Paulo", new Date());
        }
      }

      const [automation] = await db
        .update(automations)
        .set({ name, status, nodes, edges, nextRunAt, updatedAt: new Date() })
        .where(and(eq(automations.id, parsedId.data), eq(automations.organizationId, req.user!.organizationId)))
        .returning();

      if (!automation) {
        return res.status(404).json({ error: "Automation not found." });
      }

      return res.json({ automation });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid automation id." });
      }

      const [deleted] = await db
        .delete(automations)
        .where(and(eq(automations.id, parsedId.data), eq(automations.organizationId, req.user!.organizationId)))
        .returning({ id: automations.id });

      if (!deleted) {
        return res.status(404).json({ error: "Automation not found." });
      }

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
