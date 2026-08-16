import { z } from "zod";
import { strongPasswordSchema } from "../auth/auth.schema.js";

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address.")
    .trim()
    .nonempty()
    .toLowerCase(),
  role: z.enum(["admin", "member"]),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export const acceptInviteSchema = z.object({
  name: z.string().trim().nonempty(),
  lastname: z.string().trim().nonempty(),
  password: strongPasswordSchema,
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required.").max(255),
});
