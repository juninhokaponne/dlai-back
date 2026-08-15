import { Router } from "express";
import { AutomationsController } from "./automations.controller.js";
import { requireAuth } from "../../shared/middlewares/auth.js";

const router = Router();
const controller = new AutomationsController();

router.get("/", requireAuth, controller.list);
router.post("/", requireAuth, controller.create);
router.get("/:id", requireAuth, controller.get);
router.put("/:id", requireAuth, controller.save);
router.delete("/:id", requireAuth, controller.remove);

export { router as automationsRoutes };
