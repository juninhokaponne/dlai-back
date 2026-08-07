import { z } from "zod";
import { PLAN_KEYS } from "../../shared/billing/plans.config.js";

export const checkoutSchema = z.object({
  plan: z.enum(PLAN_KEYS as [string, ...string[]]),
});
