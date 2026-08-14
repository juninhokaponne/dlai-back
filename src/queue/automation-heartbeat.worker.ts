import { Worker } from "bullmq";
import { and, eq, lte, or } from "drizzle-orm";
import { db } from "../database/index.js";
import {
  automations,
  automationRuns,
  automationRunContacts,
  automationSendEvents,
  contacts,
  newsletters,
  templates,
  users,
} from "../database/schema/schema.js";
import { getRedisConnection } from "./redis-connection.js";
import { AUTOMATION_HEARTBEAT_QUEUE } from "./automation-heartbeat.queue.js";
import { computeNextRunAt, type RecurringSchedule } from "../shared/automations/schedule.js";
import { decideNextStep, type GraphEdge, type GraphNode, type SendEventState } from "../shared/automations/graph-walk.js";
import { getNewsletterSendQueue } from "./newsletter-send.queue.js";
import { createNewsletter, startNewsletterGeneration } from "../modules/newsletter/newsletter.service.js";
import { InsufficientCreditsError } from "../shared/billing/billing.errors.js";
import { createNotification } from "../shared/notifications/notifications.service.js";
import { createLogger } from "../shared/logger/logger.js";

const logger = createLogger("automation-heartbeat.worker");

function findRecurringScheduleTrigger(nodes: GraphNode[]): GraphNode | undefined {
  return nodes.find((node) => node.type === "trigger" && node.data.subtype === "recurring_schedule");
}

function findSendEmailNode(nodes: GraphNode[]): GraphNode | undefined {
  return nodes.find((node) => node.type === "action" && node.data.subtype === "send_email");
}

function firstNodeAfter(nodeId: string, nodes: GraphNode[], edges: GraphEdge[]): GraphNode | undefined {
  const edge = edges.find((candidate) => candidate.source === nodeId);
  if (!edge) return undefined;
  return nodes.find((node) => node.id === edge.target);
}

async function claimDueAutomations(): Promise<(typeof automations.$inferSelect)[]> {
  const now = new Date();
  const due = await db
    .select()
    .from(automations)
    .where(and(eq(automations.status, "active"), lte(automations.nextRunAt, now)));

  const claimed: (typeof automations.$inferSelect)[] = [];

  for (const automation of due) {
    const nodes = automation.nodes as GraphNode[];
    const trigger = findRecurringScheduleTrigger(nodes);
    const rawConfig = trigger?.data.config;
    const schedule: RecurringSchedule | undefined = rawConfig?.time
      ? { time: rawConfig.time, days: JSON.parse(rawConfig.days ?? "[]") }
      : undefined;
    if (!trigger || !schedule || schedule.days.length === 0) continue;

    const [owner] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, automation.userId)).limit(1);
    const timezone = owner?.timezone ?? "America/Sao_Paulo";
    const next = computeNextRunAt(schedule, timezone, now);

    const [updated] = await db
      .update(automations)
      .set({ nextRunAt: next, lastRunAt: now, updatedAt: now })
      .where(and(eq(automations.id, automation.id), lte(automations.nextRunAt, now)))
      .returning();

    if (updated) claimed.push(updated);
  }

  return claimed;
}

async function resolveRunContent(
  automation: typeof automations.$inferSelect,
  sendEmailNode: GraphNode,
): Promise<{ newsletterId: string } | null> {
  const config = sendEmailNode.data.config ?? {};
  const contentMode = config.contentMode ?? "existing";

  if (contentMode === "generate") {
    const topic = config.topic?.trim();
    if (!topic) return null;

    try {
      const newsletter = await createNewsletter(automation.userId, topic);
      await startNewsletterGeneration(newsletter.id, automation.userId);
      return { newsletterId: newsletter.id };
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        await db
          .update(automations)
          .set({ status: "draft", nextRunAt: null, updatedAt: new Date() })
          .where(eq(automations.id, automation.id));
        await createNotification({ userId: automation.userId, type: "automation_paused_insufficient_credits" });
        return null;
      }
      logger.error({ err, automationId: automation.id }, "Failed to start automation content generation");
      await createNotification({ userId: automation.userId, type: "automation_run_failed" });
      return null;
    }
  }

  if (config.contentType === "newsletter" && config.contentId) {
    const [existing] = await db
      .select({ status: newsletters.status })
      .from(newsletters)
      .where(eq(newsletters.id, config.contentId))
      .limit(1);
    if (!existing || (existing.status !== "ready" && existing.status !== "sent")) return null;
    return { newsletterId: config.contentId };
  }

  if (config.contentType === "template" && config.contentId) {
    const [template] = await db.select().from(templates).where(eq(templates.id, config.contentId)).limit(1);
    if (!template) return null;

    const [newsletter] = await db
      .insert(newsletters)
      .values({
        userId: automation.userId,
        topic: template.name,
        title: template.name,
        content: template.contentHtml,
        status: "ready",
      })
      .returning();

    return { newsletterId: newsletter!.id };
  }

  return null;
}

export async function startRun(automation: typeof automations.$inferSelect): Promise<void> {
  const nodes = automation.nodes as GraphNode[];
  const edges = automation.edges as GraphEdge[];
  const trigger = findRecurringScheduleTrigger(nodes);
  if (!trigger) return;

  const startNode = firstNodeAfter(trigger.id, nodes, edges);
  if (!startNode) return;

  const sendEmailNode = findSendEmailNode(nodes);
  const content = sendEmailNode ? await resolveRunContent(automation, sendEmailNode) : null;
  if (sendEmailNode && !content) return;

  const recipients = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.userId, automation.userId), eq(contacts.status, "subscribed")));

  if (recipients.length === 0) return;

  const [run] = await db
    .insert(automationRuns)
    .values({
      automationId: automation.id,
      newsletterId: content?.newsletterId,
      status: "running",
    })
    .returning();

  await db.insert(automationRunContacts).values(
    recipients.map((contact) => ({
      runId: run!.id,
      automationId: automation.id,
      contactId: contact.id,
      currentNodeId: startNode.id,
      status: "pending" as const,
    })),
  );
}

async function loadLastSendEvent(sendEventId: string | null): Promise<SendEventState | null> {
  if (!sendEventId) return null;

  const [event] = await db
    .select({ sentAt: automationSendEvents.sentAt, openedAt: automationSendEvents.openedAt, clickedAt: automationSendEvents.clickedAt })
    .from(automationSendEvents)
    .where(eq(automationSendEvents.id, sendEventId))
    .limit(1);

  return event ?? null;
}

async function advanceOne(runContact: typeof automationRunContacts.$inferSelect): Promise<void> {
  const [run] = await db.select().from(automationRuns).where(eq(automationRuns.id, runContact.runId)).limit(1);
  const [automation] = await db.select().from(automations).where(eq(automations.id, runContact.automationId)).limit(1);
  if (!run || !automation) return;

  const nodes = automation.nodes as GraphNode[];
  const edges = automation.edges as GraphEdge[];
  const node = nodes.find((candidate) => candidate.id === runContact.currentNodeId);

  if (!node) {
    await db
      .update(automationRunContacts)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(automationRunContacts.id, runContact.id));
    return;
  }

  const lastSendEvent = await loadLastSendEvent(runContact.lastSendEventId);
  const result = decideNextStep({ node, edges, now: new Date(), lastSendEvent });

  if (result.action === "wait") {
    await db
      .update(automationRunContacts)
      .set({ status: "waiting", waitUntil: result.waitUntil, updatedAt: new Date() })
      .where(eq(automationRunContacts.id, runContact.id));
    return;
  }

  if (result.action === "send") {
    if (!run.newsletterId) {
      await db
        .update(automationRunContacts)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(automationRunContacts.id, runContact.id));
      return;
    }

    const [newsletter] = await db
      .select({ status: newsletters.status })
      .from(newsletters)
      .where(eq(newsletters.id, run.newsletterId))
      .limit(1);

    if (!newsletter || newsletter.status === "generating" || newsletter.status === "draft") {
      return;
    }

    if (newsletter.status === "failed") {
      await db
        .update(automationRunContacts)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(automationRunContacts.id, runContact.id));
      return;
    }

    const [sendEvent] = await db
      .insert(automationSendEvents)
      .values({ runContactId: runContact.id, contactId: runContact.contactId, newsletterId: run.newsletterId })
      .returning();

    await getNewsletterSendQueue().add("send", {
      newsletterId: run.newsletterId,
      userId: automation.userId,
      contactId: runContact.contactId,
      trackingSendEventId: sendEvent!.id,
    });

    await db
      .update(automationRunContacts)
      .set({
        currentNodeId: result.nextNodeId ?? runContact.currentNodeId,
        status: result.nextNodeId ? "pending" : "completed",
        lastSendEventId: sendEvent!.id,
        updatedAt: new Date(),
      })
      .where(eq(automationRunContacts.id, runContact.id));
    return;
  }

  // result.action === "advance"
  await db
    .update(automationRunContacts)
    .set({
      currentNodeId: result.nextNodeId ?? runContact.currentNodeId,
      status: result.nextNodeId ? "pending" : "completed",
      updatedAt: new Date(),
    })
    .where(eq(automationRunContacts.id, runContact.id));
}

async function advanceRunContacts(): Promise<void> {
  const now = new Date();
  const due = await db
    .select()
    .from(automationRunContacts)
    .where(
      or(
        eq(automationRunContacts.status, "pending"),
        and(eq(automationRunContacts.status, "waiting"), lte(automationRunContacts.waitUntil, now)),
      ),
    );

  for (const runContact of due) {
    await advanceOne(runContact);
  }
}

async function processTick() {
  const claimed = await claimDueAutomations();
  for (const automation of claimed) {
    await startRun(automation);
  }
  await advanceRunContacts();
}

export function startAutomationHeartbeatWorker(): Worker {
  const worker = new Worker(AUTOMATION_HEARTBEAT_QUEUE, processTick, {
    connection: getRedisConnection(),
    concurrency: 1,
  });

  worker.on("failed", (_job, err) => {
    logger.error({ err }, "Automation heartbeat tick failed");
  });

  return worker;
}
