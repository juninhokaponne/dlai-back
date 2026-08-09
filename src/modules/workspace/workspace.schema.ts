import { z } from "zod";
import { BODY_MODEL_OPTIONS } from "../../shared/ai/ai.config.js";

const bodyModelIds = BODY_MODEL_OPTIONS.map((option) => option.model) as [
  string,
  ...string[],
];

export const workspaceGenerateSchema = z.object({
  topic: z.string().trim().min(1).max(500),
  model: z.enum(bodyModelIds).optional(),
});
