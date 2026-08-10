import { Router } from "express";
import { TemplatesController } from "./templates.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { createTemplateSchema, generateTemplateSchema } from "./template.schema.js";

const router = Router();
const controller = new TemplatesController();

router.use(requireAuth);

router.get("/", controller.list);
router.post("/", validate(createTemplateSchema), controller.create);
router.post("/generate", validate(generateTemplateSchema), controller.generateWithAi);
router.get("/:id", controller.get);
router.post("/:id/use", controller.useForNewsletter);
router.delete("/:id", controller.remove);

export { router as templatesRoutes };
