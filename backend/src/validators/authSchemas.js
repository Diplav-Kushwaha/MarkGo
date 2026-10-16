import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/\d/, "Password must include a digit.")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character.");

const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const phoneRegex = /^\d{10}$/;

export const registerSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters.")
    .max(120, "Company name must be 120 characters or fewer."),
  companyAddress: z
    .string()
    .trim()
    .min(5, "Company address is too short.")
    .max(300, "Company address must be 300 characters or fewer."),
  state: z
    .string()
    .trim()
    .min(2, "State must be at least 2 characters.")
    .max(100, "State must be 100 characters or fewer."),
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(120, "Full name must be 120 characters or fewer."),
  phoneNumber: z
    .string()
    .trim()
    .regex(phoneRegex, "Phone number must be exactly 10 digits."),
  password: passwordSchema,
  planId: z.string().uuid("Invalid plan ID.").optional().or(z.literal("")),
  companyEmail: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254).optional().or(z.literal("")),
  gstNumber: z.string().trim().toUpperCase().regex(gstRegex, "Enter a valid 15-character GST number.").optional().or(z.literal("")),
  city: z.string().trim().min(2, "City must be at least 2 characters.").max(100, "City must be 100 characters or fewer.").optional().or(z.literal("")),
  country: z.string().trim().min(2, "Country must be at least 2 characters.").max(100, "Country must be 100 characters or fewer.").optional().or(z.literal("")),
});

export const loginSchema = z.object({
  phoneNumber: z.string().trim().regex(phoneRegex, "Phone number must be exactly 10 digits."),
  password: z.string().min(1, "Password is required.").max(128),
});

// Super Admin login stays email-based (unchanged by the phone migration).
export const superAdminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Password is required.").max(128),
});
