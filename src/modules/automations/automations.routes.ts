import { Router } from "express";
import { AutomationsController } from "./automations.controller.js";
import { AutomationRunsController } from "./automation-runs.controller.js";
import { requireAuth } from "../../shared/middlewares/auth.js";

const router = Router();
const controller = new AutomationsController();
const runsController = new AutomationRunsController();

router.get("/", requireAuth, controller.list);
router.post("/", requireAuth, controller.create);
router.get("/:id", requireAuth, controller.get);
router.put("/:id", requireAuth, controller.save);
router.delete("/:id", requireAuth, controller.remove);
router.get("/:id/runs", requireAuth, runsController.list);
router.get("/:id/runs/:runId/contacts", requireAuth, runsController.listContacts);

export { router as automationsRoutes };
