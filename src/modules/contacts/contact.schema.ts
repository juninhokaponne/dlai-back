import { z } from "zod";

export const importTextSchema = z.object({
  text: z.string().trim().min(1, "Paste at least one contact.").max(200_000),
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
