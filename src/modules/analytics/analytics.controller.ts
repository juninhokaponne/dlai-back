import type { NextFunction, Response } from "express";
import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  automationRunContacts,
  automations,
  contacts,
  contactStatus,
  emailSendEvents,
  newsletters,
} from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { buildKpis, clampDays, type SendStatsRaw } from "../../shared/analytics/analytics.service.js";

async function loadSendStats(organizationId: string, start: Date, end: Date): Promise<SendStatsRaw> {
  const [row] = await db
    .select({
      sent: sql<number>`count(*)::int`,
      delivered: sql<number>`count(${emailSendEvents.deliveredAt})::int`,
      opened: sql<number>`count(${emailSendEvents.openedAt})::int`,
      clicked: sql<number>`count(${emailSendEvents.clickedAt})::int`,
      bounced: sql<number>`count(${emailSendEvents.bouncedAt})::int`,
    })
    .from(emailSendEvents)
    .where(
      and(
        eq(emailSendEvents.organizationId, organizationId),
        gte(emailSendEvents.sentAt, start),
        lt(emailSendEvents.sentAt, end),
      ),
    );

  return row ?? { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
}

export class AnalyticsController {
  async overview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const days = clampDays(req.query.days);
      const organizationId = req.user!.organizationId;
      const now = new Date();
      const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const previousStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

      const [current, previous, trendRows, newsletterRows, automationRows, healthRows] = await Promise.all([
        loadSendStats(organizationId, periodStart, now),
        loadSendStats(organizationId, previousStart, periodStart),
        db
          .select({
            date: sql<string>`to_char(${emailSendEvents.sentAt}, 'YYYY-MM-DD')`,
            sent: sql<number>`count(*)::int`,
            opened: sql<number>`count(${emailSendEvents.openedAt})::int`,
            clicked: sql<number>`count(${emailSendEvents.clickedAt})::int`,
          })
          .from(emailSendEvents)
          .where(and(eq(emailSendEvents.organizationId, organizationId), gte(emailSendEvents.sentAt, periodStart)))
          .groupBy(sql`to_char(${emailSendEvents.sentAt}, 'YYYY-MM-DD')`)
          .orderBy(sql`to_char(${emailSendEvents.sentAt}, 'YYYY-MM-DD')`),
        db
          .select({
            id: newsletters.id,
            title: newsletters.title,
            sentAt: newsletters.sentAt,
            status: newsletters.status,
            recipientCount: newsletters.recipientCount,
            sent: sql<number>`count(${emailSendEvents.id})::int`,
            opened: sql<number>`count(${emailSendEvents.openedAt})::int`,
            clicked: sql<number>`count(${emailSendEvents.clickedAt})::int`,
          })
          .from(newsletters)
          .leftJoin(emailSendEvents, eq(emailSendEvents.newsletterId, newsletters.id))
          .where(and(eq(newsletters.organizationId, organizationId), isNotNull(newsletters.sentAt)))
          .groupBy(newsletters.id)
          .orderBy(desc(newsletters.sentAt))
          .limit(10),
        db
          .select({
            id: automations.id,
            name: automations.name,
            entered: sql<number>`count(${automationRunContacts.id})::int`,
            completed: sql<number>`count(*) filter (where ${automationRunContacts.status} = 'completed')::int`,
          })
          .from(automations)
          .innerJoin(automationRunContacts, eq(automationRunContacts.automationId, automations.id))
          .where(eq(automations.organizationId, organizationId))
          .groupBy(automations.id)
          .orderBy(desc(sql`count(${automationRunContacts.id})`))
          .limit(5),
        db
          .select({ status: contacts.status, count: sql<number>`count(*)::int` })
          .from(contacts)
          .where(eq(contacts.organizationId, organizationId))
          .groupBy(contacts.status),
      ]);

      const contactHealth = Object.fromEntries(contactStatus.enumValues.map((status) => [status, 0])) as Record<
        (typeof contactStatus.enumValues)[number],
        number
      >;
      for (const row of healthRows) {
        contactHealth[row.status] = row.count;
      }

      return res.json({
        days,
        kpis: buildKpis(current, previous),
        trend: trendRows,
        newsletters: newsletterRows.map((row) => ({
          ...row,
          openRate: row.sent > 0 ? row.opened / row.sent : 0,
          clickRate: row.sent > 0 ? row.clicked / row.sent : 0,
        })),
        automations: automationRows.map((row) => ({
          ...row,
          active: row.entered - row.completed,
          completionRate: row.entered > 0 ? row.completed / row.entered : 0,
        })),
        contactHealth,
      });
    } catch (err) {
      next(err);
    }
  }
}
