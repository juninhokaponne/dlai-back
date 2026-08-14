import { Router } from "express";
import { NotificationsController } from "./notifications.controller.js";
import { requireAuth } from "../../shared/middlewares/auth.js";

const router = Router();
const controller = new NotificationsController();

router.get("/", requireAuth, controller.list);
router.post("/:id/read", requireAuth, controller.markRead);
router.post("/read-all", requireAuth, controller.markAllRead);

export { router as notificationsRoutes };
