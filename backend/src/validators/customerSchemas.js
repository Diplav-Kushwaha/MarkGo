import { z } from "zod";

// Same E.164-ish pattern used in authSchemas.js: optional "+", 8-15 digits, doesn't start with 0.
const phoneRegex = /^\+?[1-9]\d{7,14}$/;

// GSTIN: 15 alphanumeric characters: 2 digits, 10 alphanumeric (PAN), 1 entity digit, 1 Z, 1 checksum
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// PAN: 10 alphanumeric characters (5 letters, 4 digits, 1 letter)
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const addressSchema = z.object({
  line1: z
    .string()
    .trim()
    .min(1, "Address line 1 is required.")
    .max(200, "Address line 1 must be 200 characters or fewer."),
  line2: z
    .string()
    .trim()
    .max(200, "Address line 2 must be 200 characters or fewer.")
    .optional()
    .or(z.literal("")),
  city: z
    .string()
    .trim()
    .max(100, "City must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  state: z
    .string()
    .trim()
    .max(100, "State must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  country: z
    .string()
    .trim()
    .max(100, "Country must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  postalCode: z
    .string()
    .trim()
    .max(20, "Postal code must be 20 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export const createCustomerSchema = z.object({
  customerType: z.enum(["INDIVIDUAL", "BUSINESS"]).default("BUSINESS"),
  name: z
    .string()
    .trim()
    .min(2, "Customer name must be at least 2 characters.")
    .max(120, "Customer name must be 120 characters or fewer."),
  companyName: z
    .string()
    .trim()
    .max(150, "Company name must be 150 characters or fewer.")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  phoneNumber: z
    .string()
    .trim()
    .regex(phoneRegex, "Enter a valid phone number (8-15 digits).")
    .optional()
    .or(z.literal("")),
  alternatePhone: z
    .string()
    .trim()
    .regex(phoneRegex, "Enter a valid alternate phone number.")
    .optional()
    .or(z.literal("")),

  // Tax & Legal
  taxNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstinRegex, "Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).")
    .optional()
    .or(z.literal("")),
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(panRegex, "Enter a valid 10-character PAN (e.g. ABCDE1234F).")
    .optional()
    .or(z.literal("")),
  currency: z.string().trim().max(10).default("INR"),
  paymentTerms: z.string().trim().max(50).default("DUE_ON_RECEIPT"),
  creditLimit: z.number().nonnegative("Credit limit cannot be negative.").optional(),
  openingBalance: z.number().optional().default(0),

  notes: z.string().trim().max(2000).optional().or(z.literal("")),

  // Addresses
  billingAddress: addressSchema,
  shippingAddress: addressSchema.optional(),
  sameAsBilling: z.boolean().optional().default(true),
});

// Partial: every field optional, for PATCH-style edits.
export const updateCustomerSchema = createCustomerSchema.partial();

export const updateCustomerStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"], {
    errorMap: () => ({ message: "Status must be ACTIVE or INACTIVE." }),
  }),
});

export const bulkActionCustomerSchema = z.object({
  customerIds: z.array(z.string().min(1)).min(1, "Select at least one customer."),
  action: z.enum(["ACTIVATE", "DEACTIVATE", "DELETE"]),
});
