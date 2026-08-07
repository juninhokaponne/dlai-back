import { Router } from "express";
import { NewsletterController } from "./newsletter.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { createNewsletterSchema, updateNewsletterSchema } from "./newsletter.schema.js";

const router = Router();
const controller = new NewsletterController();

router.use(requireAuth);

router.get("/", controller.list);
router.post("/", validate(createNewsletterSchema), controller.create);
router.get("/:id", controller.get);
router.put("/:id", validate(updateNewsletterSchema), controller.update);
router.post("/:id/generate", controller.generate);

export { router as newsletterRoutes };
