import { and, eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { automations } from "../../database/schema/schema.js";
import { findNodeByTriggerSubtype, startRunForContacts } from "./run-orchestration.js";
import type { GraphNode } from "./graph-walk.js";
import { createLogger } from "../logger/logger.js";

const logger = createLogger("contact-triggers");

// Never throws - a trigger failing to fire must never break the contact-creation
// request that caused it, same reasoning as createNotification.
export async function fireNewSubscriberAutomations(organizationId: string, contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;

  try {
    const activeAutomations = await db
      .select()
      .from(automations)
      .where(and(eq(automations.organizationId, organizationId), eq(automations.status, "active")));

    for (const automation of activeAutomations) {
      const nodes = automation.nodes as GraphNode[];
      if (!findNodeByTriggerSubtype(nodes, "new_subscriber")) continue;

      await startRunForContacts(automation, "new_subscriber", contactIds);
    }
  } catch (err) {
    logger.error({ err, organizationId }, "Failed to fire new_subscriber automations");
  }
}
