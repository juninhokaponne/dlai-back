import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes";

export const router = Router();

router.use("/auth", authRoutes);
