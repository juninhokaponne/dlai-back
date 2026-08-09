import { Router } from "express";
import { WorkspaceController } from "./workspace.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { workspaceGenerateSchema } from "./workspace.schema.js";

const router = Router();
const controller = new WorkspaceController();

router.use(requireAuth);

router.get("/overview", controller.overview);
router.get("/ai-suggestions", controller.aiSuggestions);
router.post("/generate", validate(workspaceGenerateSchema), controller.generate);

export { router as workspaceRoutes };
