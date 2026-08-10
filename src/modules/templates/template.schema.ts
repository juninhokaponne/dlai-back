import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(100).optional(),
  contentHtml: z.string().trim().min(1),
});

export const generateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(1000),
  category: z.string().trim().max(100).optional(),
  useImages: z.boolean().optional(),
  useLinks: z.boolean().optional(),
});
