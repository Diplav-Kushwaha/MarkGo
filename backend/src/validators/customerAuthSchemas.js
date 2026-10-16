import { z } from "zod";

const phoneRegex = /^\d{10}$/;

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/\d/, "Password must include a digit.")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character.");

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(1, "Invite token is required."),
  password: passwordSchema,
});

export const customerLoginSchema = z.object({
  companySlug: z.string().trim().toLowerCase().min(1, "Company is required."),
  phoneNumber: z.string().trim().regex(phoneRegex, "Phone number must be exactly 10 digits."),
  password: z.string().min(1, "Password is required.").max(128),
});

export const verifyInviteSchema = z.object({
  token: z.string().trim().min(1, "Invite token is required."),
});