import { Router } from "express";
import { WorkspaceController } from "./workspace.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { workspaceGenerateSchema, workspaceTextActionSchema } from "./workspace.schema.js";

const router = Router();
const controller = new WorkspaceController();

router.use(requireAuth);

router.get("/overview", controller.overview);
router.get("/ai-suggestions", controller.aiSuggestions);
router.post("/generate", validate(workspaceGenerateSchema), controller.generate);
router.post("/rewrite", validate(workspaceTextActionSchema), controller.rewrite);
router.post("/summarize", validate(workspaceTextActionSchema), controller.summarize);
router.post("/subject-lines", validate(workspaceTextActionSchema), controller.subjectLines);

export { router as workspaceRoutes };
