import { Router } from "express";
import multer from "multer";
import { AuthController } from "./auth.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "./auth.schema.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return callback(new Error("Only PNG, JPEG or WEBP images are allowed."));
    }
    callback(null, true);
  },
});

const router = Router();
const controller = new AuthController();

router.post("/login", validate(loginSchema), controller.login);
router.post("/register", validate(registerSchema), controller.register);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", requireAuth, controller.me);
router.patch("/me", requireAuth, validate(updateProfileSchema), controller.updateMe);
router.post("/me/avatar", requireAuth, upload.single("avatar"), controller.uploadAvatar);
router.post(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  controller.changePassword,
);

export { router as authRoutes };
