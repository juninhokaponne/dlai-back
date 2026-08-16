import { and, eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { notifications, organizationMembers, type notificationType } from "../../database/schema/schema.js";
import { createLogger } from "../logger/logger.js";

const logger = createLogger("notifications.service");

type NotificationType = (typeof notificationType.enumValues)[number];

// The one seam every trigger point calls through. Today it only writes the
// in-app row; when email/push delivery is added, this is the single place
// that grows to also enqueue those, instead of touching every worker again.
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  newsletterId?: string;
}): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: params.userId,
      type: params.type,
      newsletterId: params.newsletterId,
    });
  } catch (err) {
    // A notification failing to record must never fail the job that
    // triggered it (newsletter generation/send already completed or
    // failed on its own terms by the time this runs).
    logger.error({ err, ...params }, "Failed to create notification");
  }
}

// Admin-relevant events (e.g. billing/credit issues) notify every admin in
// the organization, not just whoever triggered the run — only admins can
// act on billing (see requireRole("admin") on the billing routes).
export async function notifyOrganizationAdmins(params: {
  organizationId: string;
  type: NotificationType;
  newsletterId?: string;
}): Promise<void> {
  try {
    const admins = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, params.organizationId), eq(organizationMembers.role, "admin")));

    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.userId,
          type: params.type,
          ...(params.newsletterId !== undefined ? { newsletterId: params.newsletterId } : {}),
        }),
      ),
    );
  } catch (err) {
    logger.error({ err, ...params }, "Failed to notify organization admins");
  }
}
