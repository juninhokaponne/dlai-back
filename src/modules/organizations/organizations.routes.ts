import { Router } from "express";
import { OrganizationsController } from "./organizations.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { requireAuth, requireRole } from "../../shared/middlewares/auth.js";
import {
  acceptInviteSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from "./organizations.schema.js";

const router = Router();
const controller = new OrganizationsController();

router.patch("/", requireAuth, requireRole("admin"), validate(updateOrganizationSchema), controller.updateOrganization);

router.get("/members", requireAuth, controller.listMembers);
router.patch(
  "/members/:userId/role",
  requireAuth,
  requireRole("admin"),
  validate(updateMemberRoleSchema),
  controller.updateMemberRole,
);
router.delete("/members/:userId", requireAuth, requireRole("admin"), controller.removeMember);

router.post("/invites", requireAuth, requireRole("admin"), validate(inviteMemberSchema), controller.inviteMember);
router.post("/invites/:inviteId/revoke", requireAuth, requireRole("admin"), controller.revokeInvite);
router.get("/invites/token/:token", controller.getInviteByToken);
router.post("/invites/token/:token/accept", validate(acceptInviteSchema), controller.acceptInvite);

export { router as organizationsRoutes };
