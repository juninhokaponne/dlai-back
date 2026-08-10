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
  addressLine1: z.string().trim().max(255).optional(),
  addressLine2: z.string().trim().max(255).optional(),
  addressCity: z.string().trim().max(255).optional(),
  addressState: z.string().trim().max(255).optional(),
  addressPostalCode: z.string().trim().max(20).optional(),
  addressCountry: z.string().trim().max(255).optional(),
  newsletterViewMode: z.enum(["list", "grid"]).optional(),
  locale: z.enum(["en", "pt", "es"]).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: strongPasswordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
