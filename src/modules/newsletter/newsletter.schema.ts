import { z } from "zod";

export const createNewsletterSchema = z.object({
  topic: z.string().trim().min(1).max(500),
});

export const updateNewsletterSchema = z.object({
  topic: z.string().trim().min(1).max(500).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().trim().min(1).optional(),
});
