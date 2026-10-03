import { z } from "zod";

const phoneRegex = /^\+?[1-9]\d{7,14}$/;

export const createAccountantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Accountant name must be at least 2 characters.")
    .max(120, "Accountant name must be 120 characters or fewer."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  phoneNumber: z
    .string()
    .trim()
    .regex(phoneRegex, "Enter a valid phone number, digits only (with optional country code).")
    .optional()
    .or(z.literal("")),
  licenseNumber: z
    .string()
    .trim()
    .max(50, "License / Registration number must be 50 characters or fewer.")
    .optional()
    .or(z.literal("")),
  experience: z
    .string()
    .trim()
    .max(50, "Experience must be 50 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export const updateAccountantSchema = createAccountantSchema.partial();

export const updateAccountantStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"], {
    errorMap: () => ({ message: "Status must be ACTIVE or INACTIVE." }),
  }),
});
