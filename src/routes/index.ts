import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { newsletterRoutes } from "../modules/newsletter/newsletter.routes.js";
import { contactsRoutes } from "../modules/contacts/contacts.routes.js";
import { billingRoutes } from "../modules/billing/billing.routes.js";
import { workspaceRoutes } from "../modules/workspace/workspace.routes.js";
import { uploadsRoutes } from "../modules/uploads/uploads.routes.js";
import { templatesRoutes } from "../modules/templates/templates.routes.js";
import { notificationsRoutes } from "../modules/notifications/notifications.routes.js";
import { automationsRoutes } from "../modules/automations/automations.routes.js";

export const router = Router();

router.use("/auth", authRoutes);
router.use("/newsletters", newsletterRoutes);
router.use("/contacts", contactsRoutes);
router.use("/billing", billingRoutes);
router.use("/workspace", workspaceRoutes);
router.use("/uploads", uploadsRoutes);
router.use("/templates", templatesRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/automations", automationsRoutes);
