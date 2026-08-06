import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { registerSchema } from "./auth.schema.js";

const router = Router();
const controller = new AuthController();

// router.post("/login", validate(loginSchema), controller.login);
router.post("/register", validate(registerSchema), controller.register);

export { router as authRoutes };
