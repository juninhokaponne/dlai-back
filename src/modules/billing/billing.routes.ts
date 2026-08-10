import { Router } from "express";
import { BillingController } from "./billing.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { checkoutSchema } from "./billing.schema.js";

const router = Router();
const controller = new BillingController();

router.get("/plans", controller.listPlans);
router.get("/subscription", requireAuth, controller.getSubscription);
router.post("/checkout", requireAuth, validate(checkoutSchema), controller.checkout);

export { router as billingRoutes };
