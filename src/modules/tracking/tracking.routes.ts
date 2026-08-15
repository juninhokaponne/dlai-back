import { Router } from "express";
import { TrackingController } from "./tracking.controller.js";

const router = Router();
const controller = new TrackingController();

router.get("/o/:sendEventId", controller.open);
router.get("/c/:sendEventId", controller.click);

export { router as trackingRoutes };
