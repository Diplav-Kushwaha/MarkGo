import { z } from "zod";

const phoneRegex = /^\+?[1-9]\d{7,14}$/;

export const createStaffSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Staff member name must be at least 2 characters.")
    .max(120, "Staff member name must be 120 characters or fewer."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  phoneNumber: z
    .string()
    .trim()
    .regex(phoneRegex, "Enter a valid phone number, digits only (with optional country code).")
    .optional()
    .or(z.literal("")),
  designation: z
    .string()
    .trim()
    .max(100, "Designation must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  department: z
    .string()
    .trim()
    .max(100, "Department must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export const updateStaffSchema = createStaffSchema.partial();

export const updateStaffStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"], {
    errorMap: () => ({ message: "Status must be ACTIVE or INACTIVE." }),
  }),
});
