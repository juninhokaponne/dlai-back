import { z } from "zod";

export const contactRowSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => (value ? value : undefined)),
});
