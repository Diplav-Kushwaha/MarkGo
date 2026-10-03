import { z } from "zod";

const phoneRegex = /^\+?[1-9]\d{7,14}$/;

// GSTIN: 15 alphanumeric characters: 2 digits state code, 10 char PAN, 1 entity digit, 1 Z, 1 checksum
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// PAN: 10 alphanumeric characters (5 letters, 4 digits, 1 letter)
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// IFSC: 4 letters, 0, 6 alphanumeric
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

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

export const createVendorSchema = z.object({
  // Basic Info
  name: z
    .string()
    .trim()
    .min(2, "Vendor name must be at least 2 characters.")
    .max(120, "Vendor name must be 120 characters or fewer."),
  companyName: z
    .string()
    .trim()
    .max(150, "Company name must be 150 characters or fewer.")
    .optional()
    .or(z.literal("")),
  contactPerson: z
    .string()
    .trim()
    .max(120, "Contact person name must be 120 characters or fewer.")
    .optional()
    .or(z.literal("")),
  vendorType: z
    .enum(["INDIVIDUAL", "BUSINESS", "SERVICE_PROVIDER"])
    .default("BUSINESS"),
  category: z
    .string()
    .trim()
    .max(100, "Category must be 100 characters or fewer.")
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

  // Bank Account Details
  bankAccountNumber: z
    .string()
    .trim()
    .max(50, "Bank account number must be 50 characters or fewer.")
    .optional()
    .or(z.literal("")),
  bankIfsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ifscRegex, "Enter a valid 11-character IFSC code (e.g. SBIN0001234).")
    .optional()
    .or(z.literal("")),
  bankName: z
    .string()
    .trim()
    .max(100, "Bank name must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  bankBranch: z
    .string()
    .trim()
    .max(100, "Bank branch must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),

  notes: z.string().trim().max(2000).optional().or(z.literal("")),

  // Address
  billingAddress: addressSchema,
  shippingAddress: addressSchema.optional(),
  sameAsBilling: z.boolean().optional().default(true),
});

export const updateVendorSchema = createVendorSchema.partial();

export const updateVendorStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"], {
    errorMap: () => ({ message: "Status must be ACTIVE or INACTIVE." }),
  }),
});

export const bulkActionVendorSchema = z.object({
  vendorIds: z.array(z.string().min(1)).min(1, "Select at least one vendor."),
  action: z.enum(["ACTIVATE", "DEACTIVATE", "DELETE"]),
});
