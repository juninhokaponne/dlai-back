import type { NextFunction, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { organizations, organizationMembers, organizationInvites, users } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { generateVerificationTokenRaw, inviteTokenExpiry } from "../../shared/utils/security.js";
import { sendOrganizationInviteEmail } from "../../shared/email/send-organization-invite-email.js";
import type { EmailLocale } from "../../shared/email/templates/copy.js";
import { createLogger } from "../../shared/logger/logger.js";

const logger = createLogger("organizations.controller");

export class OrganizationsController {
  async listMembers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const members = await db
        .select({
          userId: organizationMembers.userId,
          name: users.name,
          lastName: users.lastName,
          email: users.email,
          role: organizationMembers.role,
          createdAt: organizationMembers.createdAt,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(eq(organizationMembers.organizationId, req.user!.organizationId))
        .orderBy(organizationMembers.createdAt);

      let invites: {
        id: string;
        email: string;
        role: "admin" | "member";
        status: string;
        expiresAt: Date;
        createdAt: Date;
      }[] = [];

      if (req.user!.role === "admin") {
        const rows = await db
          .select({
            id: organizationInvites.id,
            email: organizationInvites.email,
            role: organizationInvites.role,
            status: organizationInvites.status,
            expiresAt: organizationInvites.expiresAt,
            createdAt: organizationInvites.createdAt,
          })
          .from(organizationInvites)
          .where(
            and(
              eq(organizationInvites.organizationId, req.user!.organizationId),
              eq(organizationInvites.status, "pending"),
            ),
          )
          .orderBy(organizationInvites.createdAt);

        invites = rows.map((row) => ({
          ...row,
          status: row.expiresAt < new Date() ? "expired" : row.status,
        }));
      }

      return res.json({ members, invites });
    } catch (err) {
      next(err);
    }
  }

  async inviteMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email, role } = req.body;

      const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existingUser) {
        return res.status(409).json({ error: "This email already belongs to an existing account." });
      }

      const [organization] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, req.user!.organizationId))
        .limit(1);

      const [inviter] = await db
        .select({ locale: users.locale })
        .from(users)
        .where(eq(users.id, req.user!.userId))
        .limit(1);

      const rawToken = generateVerificationTokenRaw();
      const expiresAt = inviteTokenExpiry();

      const [existingInvite] = await db
        .select({ id: organizationInvites.id })
        .from(organizationInvites)
        .where(
          and(
            eq(organizationInvites.organizationId, req.user!.organizationId),
            eq(organizationInvites.email, email),
            eq(organizationInvites.status, "pending"),
          ),
        )
        .limit(1);

      let invite;
      if (existingInvite) {
        [invite] = await db
          .update(organizationInvites)
          .set({ role, token: rawToken, expiresAt, invitedByUserId: req.user!.userId })
          .where(eq(organizationInvites.id, existingInvite.id))
          .returning();
      } else {
        [invite] = await db
          .insert(organizationInvites)
          .values({
            organizationId: req.user!.organizationId,
            email,
            role,
            invitedByUserId: req.user!.userId,
            token: rawToken,
            expiresAt,
          })
          .returning();
      }

      sendOrganizationInviteEmail({
        email,
        locale: (inviter?.locale as EmailLocale) ?? "en",
        organizationName: organization?.name ?? "LetterGo AI",
        inviteToken: rawToken,
      }).catch((err) => logger.error({ err, email }, "Failed to send organization invite email"));

      return res.status(201).json({
        invite: {
          id: invite!.id,
          email: invite!.email,
          role: invite!.role,
          status: invite!.status,
          expiresAt: invite!.expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
