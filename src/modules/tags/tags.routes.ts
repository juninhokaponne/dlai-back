import { Router } from "express";
import { TagsController } from "./tags.controller.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { validate } from "../../shared/middlewares/validate.js";
import { createTagSchema } from "./tags.schema.js";

const router = Router();
const controller = new TagsController();

router.use(requireAuth);

router.get("/", controller.list);
router.post("/", validate(createTagSchema), controller.create);
router.delete("/:id", controller.remove);

export { router as tagsRoutes };
