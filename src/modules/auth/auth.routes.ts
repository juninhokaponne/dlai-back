import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { loginSchema, registerSchema, updateProfileSchema } from "./auth.schema.js";

const router = Router();
const controller = new AuthController();

router.post("/login", validate(loginSchema), controller.login);
router.post("/register", validate(registerSchema), controller.register);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", requireAuth, controller.me);
router.patch("/me", requireAuth, validate(updateProfileSchema), controller.updateMe);

export { router as authRoutes };
