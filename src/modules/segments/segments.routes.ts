import { Router } from "express";
import { SegmentsController } from "./segments.controller.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { validate } from "../../shared/middlewares/validate.js";
import { upsertSegmentSchema } from "../../shared/segments/segments.service.js";

const router = Router();
const controller = new SegmentsController();

router.use(requireAuth);

router.get("/", controller.list);
router.post("/", validate(upsertSegmentSchema), controller.create);
router.patch("/:id", validate(upsertSegmentSchema), controller.update);
router.delete("/:id", controller.remove);

export { router as segmentsRoutes };
