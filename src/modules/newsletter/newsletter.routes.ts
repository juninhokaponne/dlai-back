import { Router } from "express";
import { NewsletterController } from "./newsletter.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { AIService } from "../../shared/ai/ai.service.js";
import { OpenRouterProvider } from "../../shared/ai/openrouter.provider.js";
import { createNewsletterSchema, updateNewsletterSchema } from "./newsletter.schema.js";

const router = Router();
const controller = new NewsletterController(new AIService(new OpenRouterProvider()));

router.use(requireAuth);

router.get("/", controller.list);
router.post("/", validate(createNewsletterSchema), controller.create);
router.get("/:id", controller.get);
router.put("/:id", validate(updateNewsletterSchema), controller.update);

export { router as newsletterRoutes };
