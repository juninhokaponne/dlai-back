import type { NextFunction, Response } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../database/index.js";
import { notifications, newsletters, users } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";

export class NotificationsController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;

      const [user] = await db
        .select({ isEmailVerified: users.isEmailVerified })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const rows = await db
        .select({
          id: notifications.id,
          type: notifications.type,
          newsletterId: notifications.newsletterId,
          newsletterTitle: newsletters.title,
          newsletterTopic: newsletters.topic,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .leftJoin(newsletters, eq(notifications.newsletterId, newsletters.id))
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(20);

      const list = rows.map((row) => ({
        id: row.id,
        type: row.type,
        newsletterId: row.newsletterId,
        newsletterTitle: row.newsletterTitle ?? row.newsletterTopic,
        read: row.readAt !== null,
        createdAt: row.createdAt,
      }));

      return res.json({
        notifications: list,
        emailVerificationPending: !(user?.isEmailVerified ?? true),
      });
    } catch (err) {
      next(err);
    }
  }

  async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, req.params.id as string),
            eq(notifications.userId, req.user!.userId),
          ),
        );

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.userId, req.user!.userId), isNull(notifications.readAt)));

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
