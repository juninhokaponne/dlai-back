import { z } from "zod";
import { BODY_MODEL_OPTIONS } from "../../shared/ai/ai.config.js";

const bodyModelIds = BODY_MODEL_OPTIONS.map((option) => option.model) as [
  string,
  ...string[],
];

export const createNewsletterSchema = z.object({
  topic: z.string().trim().min(1).max(500),
});

export const generateSchema = z.object({
  model: z.enum(bodyModelIds).optional(),
});

export const updateNewsletterSchema = z.object({
  topic: z.string().trim().min(1).max(500).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().trim().min(1).optional(),
  isArchived: z.boolean().optional(),
});
