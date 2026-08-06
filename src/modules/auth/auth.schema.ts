import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address.")
    .trim()
    .nonempty()
    .toLowerCase(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  name: z.string().nonempty(),
  email: z
    .string()
    .email("Please enter a valid email address.")
    .nonempty()
    .trim()
    .toLowerCase(),
  lastname: z.string().nonempty(),
  password: z.string().min(8).nonempty(),
  age: z.number(),
  company: z.string().max(32).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
