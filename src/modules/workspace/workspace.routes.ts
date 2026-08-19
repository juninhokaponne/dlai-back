import { Router } from "express";
import multer from "multer";
import { WorkspaceController } from "./workspace.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { workspaceGenerateSchema, workspaceTextActionSchema } from "./workspace.schema.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("audio/")) {
      return callback(new Error("Only audio files are allowed."));
    }
    callback(null, true);
  },
});

const router = Router();
const controller = new WorkspaceController();

router.use(requireAuth);

router.get("/overview", controller.overview);
router.get("/ai-suggestions", controller.aiSuggestions);
router.post("/generate", validate(workspaceGenerateSchema), controller.generate);
router.post("/rewrite", validate(workspaceTextActionSchema), controller.rewrite);
router.post("/summarize", validate(workspaceTextActionSchema), controller.summarize);
router.post("/subject-lines", validate(workspaceTextActionSchema), controller.subjectLines);
router.post("/transcribe", upload.single("audio"), controller.transcribe);

export { router as workspaceRoutes };
