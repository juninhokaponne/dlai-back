import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import { organizations, organizationMembers, organizationInvites, users } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { generateVerificationTokenRaw, hashPassword, inviteTokenExpiry } from "../../shared/utils/security.js";
import { sendOrganizationInviteEmail } from "../../shared/email/send-organization-invite-email.js";
import type { EmailLocale } from "../../shared/email/templates/copy.js";
import { createLogger } from "../../shared/logger/logger.js";

const logger = createLogger("organizations.controller");

const idParamSchema = z.string().uuid();
const tokenParamSchema = z.string().min(1);

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

  async revokeInvite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedInviteId = idParamSchema.safeParse(req.params.inviteId);
      if (!parsedInviteId.success) {
        return res.status(400).json({ error: "Invalid invite id." });
      }

      const [invite] = await db
        .update(organizationInvites)
        .set({ status: "revoked" })
        .where(
          and(
            eq(organizationInvites.id, parsedInviteId.data),
            eq(organizationInvites.organizationId, req.user!.organizationId),
            eq(organizationInvites.status, "pending"),
          ),
        )
        .returning({ id: organizationInvites.id });

      if (!invite) {
        return res.status(404).json({ error: "Invite not found." });
      }

      return res.json({ message: "Invite revoked." });
    } catch (err) {
      next(err);
    }
  }

  async getInviteByToken(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedToken = tokenParamSchema.safeParse(req.params.token);
      if (!parsedToken.success) {
        return res.status(404).json({ error: "This invite link is invalid." });
      }

      const [invite] = await db
        .select({
          email: organizationInvites.email,
          role: organizationInvites.role,
          status: organizationInvites.status,
          expiresAt: organizationInvites.expiresAt,
          organizationId: organizationInvites.organizationId,
        })
        .from(organizationInvites)
        .where(eq(organizationInvites.token, parsedToken.data))
        .limit(1);

      if (!invite) {
        return res.status(404).json({ error: "This invite link is invalid." });
      }

      const [organization] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, invite.organizationId))
        .limit(1);

      const status = invite.status === "pending" && invite.expiresAt < new Date() ? "expired" : invite.status;

      return res.json({
        email: invite.email,
        role: invite.role,
        organizationName: organization?.name ?? "LetterGo AI",
        status,
      });
    } catch (err) {
      next(err);
    }
  }

  async acceptInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedToken = tokenParamSchema.safeParse(req.params.token);
      if (!parsedToken.success) {
        return res.status(404).json({ error: "This invite link is invalid." });
      }
      const { name, lastname, password } = req.body;

      const [invite] = await db
        .select()
        .from(organizationInvites)
        .where(eq(organizationInvites.token, parsedToken.data))
        .limit(1);

      if (!invite) {
        return res.status(404).json({ error: "This invite link is invalid." });
      }
      if (invite.status !== "pending") {
        return res.status(400).json({ error: "This invite is no longer valid." });
      }
      if (invite.expiresAt < new Date()) {
        return res.status(400).json({ error: "This invite link has expired." });
      }

      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, invite.email))
        .limit(1);
      if (existingUser) {
        return res.status(409).json({ error: "An account with this email already exists." });
      }

      const passwordHash = await hashPassword(password);

      const newUser = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values({ name, lastName: lastname, email: invite.email, passwordHash, isEmailVerified: true })
          .returning();

        await tx.insert(organizationMembers).values({
          organizationId: invite.organizationId,
          userId: created!.id,
          role: invite.role,
        });

        await tx
          .update(organizationInvites)
          .set({ status: "accepted" })
          .where(eq(organizationInvites.id, invite.id));

        return created!;
      });

      // No auth middleware runs on this route (the user doesn't exist yet
      // when the request starts), so attach the identity we just created
      // for the request-completion log line to pick up.
      (req as AuthenticatedRequest).user = {
        userId: newUser.id,
        email: newUser.email,
        organizationId: invite.organizationId,
        role: invite.role,
      };

      return res.status(201).json({ message: "Account created. You can sign in now.", email: newUser.email });
    } catch (err) {
      next(err);
    }
  }

  async updateMemberRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedUserId = idParamSchema.safeParse(req.params.userId);
      if (!parsedUserId.success) {
        return res.status(400).json({ error: "Invalid member id." });
      }
      const userId = parsedUserId.data;
      const { role } = req.body;

      const [target] = await db
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, req.user!.organizationId),
          ),
        )
        .limit(1);

      if (!target) {
        return res.status(404).json({ error: "Member not found." });
      }

      if (target.role === "admin" && role !== "admin") {
        const adminCount = await db.$count(
          organizationMembers,
          and(
            eq(organizationMembers.organizationId, req.user!.organizationId),
            eq(organizationMembers.role, "admin"),
          ),
        );
        if (adminCount <= 1) {
          return res.status(400).json({ error: "An organization must have at least one Admin." });
        }
      }

      await db.update(organizationMembers).set({ role }).where(eq(organizationMembers.userId, userId));

      return res.json({ member: { userId, role } });
    } catch (err) {
      next(err);
    }
  }

  async removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedUserId = idParamSchema.safeParse(req.params.userId);
      if (!parsedUserId.success) {
        return res.status(400).json({ error: "Invalid member id." });
      }
      const userId = parsedUserId.data;

      const [target] = await db
        .select({ role: organizationMembers.role, name: users.name })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, req.user!.organizationId),
          ),
        )
        .limit(1);

      if (!target) {
        return res.status(404).json({ error: "Member not found." });
      }

      if (target.role === "admin") {
        const adminCount = await db.$count(
          organizationMembers,
          and(
            eq(organizationMembers.organizationId, req.user!.organizationId),
            eq(organizationMembers.role, "admin"),
          ),
        );
        if (adminCount <= 1) {
          return res.status(400).json({ error: "An organization must have at least one Admin." });
        }
      }

      await db.transaction(async (tx) => {
        await tx.delete(organizationMembers).where(eq(organizationMembers.userId, userId));

        const [newOrganization] = await tx
          .insert(organizations)
          .values({ name: `${target.name}'s workspace` })
          .returning();

        await tx.insert(organizationMembers).values({
          organizationId: newOrganization!.id,
          userId,
          role: "admin",
        });
      });

      return res.json({ message: "Member removed." });
    } catch (err) {
      next(err);
    }
  }

  async updateOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;

      const [organization] = await db
        .update(organizations)
        .set({ name, updatedAt: new Date() })
        .where(eq(organizations.id, req.user!.organizationId))
        .returning({ id: organizations.id, name: organizations.name });

      return res.json({ organization });
    } catch (err) {
      next(err);
    }
  }
}
