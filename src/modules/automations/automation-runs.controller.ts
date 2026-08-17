import type { NextFunction, Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import {
  automations,
  automationRuns,
  automationRunContacts,
  emailSendEvents,
  contacts,
  newsletters,
} from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";

const idParamSchema = z.string().uuid();

async function findOwnedAutomation(id: string, organizationId: string) {
  const [automation] = await db
    .select({ id: automations.id })
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.organizationId, organizationId)))
    .limit(1);

  return automation;
}

export class AutomationRunsController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid automation id." });
      }

      const automation = await findOwnedAutomation(parsedId.data, req.user!.organizationId);
      if (!automation) {
        return res.status(404).json({ error: "Automation not found." });
      }

      const runs = await db
        .select({
          id: automationRuns.id,
          status: automationRuns.status,
          triggeredAt: automationRuns.triggeredAt,
          newsletterId: automationRuns.newsletterId,
          newsletterTitle: newsletters.title,
        })
        .from(automationRuns)
        .leftJoin(newsletters, eq(automationRuns.newsletterId, newsletters.id))
        .where(eq(automationRuns.automationId, automation.id))
        .orderBy(desc(automationRuns.triggeredAt))
        .limit(50);

      const runIds = runs.map((run) => run.id);
      const counts = runIds.length
        ? await db
            .select({
              runId: automationRunContacts.runId,
              status: automationRunContacts.status,
              count: sql<number>`count(*)::int`,
            })
            .from(automationRunContacts)
            .where(inArray(automationRunContacts.runId, runIds))
            .groupBy(automationRunContacts.runId, automationRunContacts.status)
        : [];

      const runsWithCounts = runs.map((run) => {
        const forRun = counts.filter((row) => row.runId === run.id);
        const totalContacts = forRun.reduce((sum, row) => sum + row.count, 0);
        return {
          ...run,
          totalContacts,
          pending: forRun.find((row) => row.status === "pending")?.count ?? 0,
          waiting: forRun.find((row) => row.status === "waiting")?.count ?? 0,
          completed: forRun.find((row) => row.status === "completed")?.count ?? 0,
          failed: forRun.find((row) => row.status === "failed")?.count ?? 0,
        };
      });

      return res.json({ runs: runsWithCounts });
    } catch (err) {
      next(err);
    }
  }

  async listContacts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedAutomationId = idParamSchema.safeParse(req.params.id);
      const parsedRunId = idParamSchema.safeParse(req.params.runId);
      if (!parsedAutomationId.success || !parsedRunId.success) {
        return res.status(400).json({ error: "Invalid id." });
      }

      const automation = await findOwnedAutomation(parsedAutomationId.data, req.user!.organizationId);
      if (!automation) {
        return res.status(404).json({ error: "Automation not found." });
      }

      const [run] = await db
        .select({ id: automationRuns.id })
        .from(automationRuns)
        .where(and(eq(automationRuns.id, parsedRunId.data), eq(automationRuns.automationId, automation.id)))
        .limit(1);

      if (!run) {
        return res.status(404).json({ error: "Run not found." });
      }

      const runContacts = await db
        .select({
          id: automationRunContacts.id,
          contactId: automationRunContacts.contactId,
          email: contacts.email,
          name: contacts.name,
          currentNodeId: automationRunContacts.currentNodeId,
          status: automationRunContacts.status,
          waitUntil: automationRunContacts.waitUntil,
          updatedAt: automationRunContacts.updatedAt,
          sentAt: emailSendEvents.sentAt,
          openedAt: emailSendEvents.openedAt,
          clickedAt: emailSendEvents.clickedAt,
        })
        .from(automationRunContacts)
        .innerJoin(contacts, eq(automationRunContacts.contactId, contacts.id))
        .leftJoin(emailSendEvents, eq(automationRunContacts.lastSendEventId, emailSendEvents.id))
        .where(eq(automationRunContacts.runId, run.id))
        .orderBy(desc(automationRunContacts.updatedAt))
        .limit(200);

      return res.json({ contacts: runContacts });
    } catch (err) {
      next(err);
    }
  }
}
