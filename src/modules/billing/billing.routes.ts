import { Router } from "express";
import { BillingController } from "./billing.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { requireAuth, requireRole } from "../../shared/middlewares/auth.js";
import { checkoutSchema } from "./billing.schema.js";

const router = Router();
const controller = new BillingController();

router.get("/plans", controller.listPlans);
router.get("/subscription", requireAuth, controller.getSubscription);
router.get("/invoices", requireAuth, controller.listInvoices);
router.post("/cancel", requireAuth, requireRole("admin"), controller.cancelSubscription);
router.post("/checkout", requireAuth, requireRole("admin"), validate(checkoutSchema), controller.checkout);

export { router as billingRoutes };
