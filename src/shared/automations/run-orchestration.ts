import { and, eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { automations, automationRuns, automationRunContacts, newsletters, templates } from "../../database/schema/schema.js";
import type { GraphEdge, GraphNode } from "./graph-walk.js";
import { createNewsletter, startNewsletterGeneration } from "../../modules/newsletter/newsletter.service.js";
import { InsufficientCreditsError } from "../billing/billing.errors.js";
import { createNotification } from "../notifications/notifications.service.js";
import { createLogger } from "../logger/logger.js";

const logger = createLogger("automation-run-orchestration");

export function findNodeByTriggerSubtype(nodes: GraphNode[], subtype: string): GraphNode | undefined {
  return nodes.find((node) => node.type === "trigger" && node.data.subtype === subtype);
}

export function findSendEmailNode(nodes: GraphNode[]): GraphNode | undefined {
  return nodes.find((node) => node.type === "action" && node.data.subtype === "send_email");
}

export function firstNodeAfter(nodeId: string, nodes: GraphNode[], edges: GraphEdge[]): GraphNode | undefined {
  const edge = edges.find((candidate) => candidate.source === nodeId);
  if (!edge) return undefined;
  return nodes.find((node) => node.id === edge.target);
}

export async function resolveRunContent(
  automation: typeof automations.$inferSelect,
  sendEmailNode: GraphNode,
): Promise<{ newsletterId: string } | null> {
  const config = sendEmailNode.data.config ?? {};
  const contentMode = config.contentMode ?? "existing";

  if (contentMode === "generate") {
    const topic = config.topic?.trim();
    if (!topic) return null;

    try {
      const newsletter = await createNewsletter(automation.organizationId!, automation.userId, topic);
      await startNewsletterGeneration(newsletter.id, automation.organizationId!, automation.userId);
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
      .where(and(eq(newsletters.id, config.contentId), eq(newsletters.organizationId, automation.organizationId!)))
      .limit(1);
    if (!existing || (existing.status !== "ready" && existing.status !== "sent")) return null;
    return { newsletterId: config.contentId };
  }

  if (config.contentType === "template" && config.contentId) {
    const [template] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, config.contentId), eq(templates.organizationId, automation.organizationId!)))
      .limit(1);
    if (!template) return null;

    const [newsletter] = await db
      .insert(newsletters)
      .values({
        userId: automation.userId,
        organizationId: automation.organizationId,
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

// Content is resolved once per call (one AI generation at most), regardless of how many
// contactIds are passed in - callers that fire per-event (e.g. a contact-import batch)
// must pass every contact from that batch in a single call, never one call per contact,
// or "generate" mode would spend credits once per contact instead of once per run.
export async function startRunForContacts(
  automation: typeof automations.$inferSelect,
  triggerSubtype: string,
  contactIds: string[],
): Promise<void> {
  if (contactIds.length === 0) return;

  const nodes = automation.nodes as GraphNode[];
  const edges = automation.edges as GraphEdge[];
  const trigger = findNodeByTriggerSubtype(nodes, triggerSubtype);
  if (!trigger) return;

  const startNode = firstNodeAfter(trigger.id, nodes, edges);
  if (!startNode) return;

  const sendEmailNode = findSendEmailNode(nodes);
  const content = sendEmailNode ? await resolveRunContent(automation, sendEmailNode) : null;
  if (sendEmailNode && !content) return;

  const [run] = await db
    .insert(automationRuns)
    .values({
      automationId: automation.id,
      newsletterId: content?.newsletterId,
      status: "running",
    })
    .returning();

  await db.insert(automationRunContacts).values(
    contactIds.map((contactId) => ({
      runId: run!.id,
      automationId: automation.id,
      contactId,
      currentNodeId: startNode.id,
      status: "pending" as const,
    })),
  );
}
