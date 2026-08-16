import { z } from "zod";

export const importTextSchema = z.object({
  text: z.string().trim().min(1, "Paste at least one contact.").max(200_000),
  tagId: z.string().uuid().optional(),
});

export const contactRowSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const createContactSchema = contactRowSchema.extend({
  tagId: z.string().uuid().optional(),
});

export const bulkTagSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1, "Select at least one contact.").max(500),
  tagId: z.string().uuid(),
});
