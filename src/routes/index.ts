import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { newsletterRoutes } from "../modules/newsletter/newsletter.routes.js";

export const router = Router();

router.use("/auth", authRoutes);
router.use("/newsletters", newsletterRoutes);
