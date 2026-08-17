import { Router } from "express";
import { AnalyticsController } from "./analytics.controller.js";
import { requireAuth } from "../../shared/middlewares/auth.js";

const router = Router();
const controller = new AnalyticsController();

router.use(requireAuth);

router.get("/overview", controller.overview);

export { router as analyticsRoutes };
