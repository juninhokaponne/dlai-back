import { z } from "zod";

const strongPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(128)
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/\d/, "Password must include a number.");

export const loginSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address.")
    .trim()
    .nonempty()
    .toLowerCase(),
  password: z.string().min(1),
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
  password: strongPasswordSchema,
  age: z.number().optional(),
  company: z.string().max(32).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().nonempty().max(255).optional(),
  lastname: z.string().trim().nonempty().max(255).optional(),
  company: z.string().trim().max(32).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
