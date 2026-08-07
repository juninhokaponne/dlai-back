import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { newsletterRoutes } from "../modules/newsletter/newsletter.routes.js";
import { contactsRoutes } from "../modules/contacts/contacts.routes.js";

export const router = Router();

router.use("/auth", authRoutes);
router.use("/newsletters", newsletterRoutes);
router.use("/contacts", contactsRoutes);
