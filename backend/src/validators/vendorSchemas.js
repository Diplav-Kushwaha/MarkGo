import { z } from "zod";

const phoneRegex = /^\d{10}$/;

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * Optional string field that also accepts "" and null so a client can
 * explicitly clear a value. Format and length checks only run when an
 * actual string is provided. Services normalize "" to null before
 * writing, so blank values never reach the database as "".
 */
const optionalString = (schema) =>
  schema.optional().or(z.literal("")).or(z.literal(null));

const addressSchema = z.object({
  line1: optionalString(
    z
      .string()
      .trim()
      .max(200, "Address line 1 must be 200 characters or fewer.")
  ),
  line2: optionalString(
    z
      .string()
      .trim()
      .max(200, "Address line 2 must be 200 characters or fewer.")
  ),
  city: optionalString(z.string().trim().max(100, "City must be 100 characters or fewer.")),
  state: optionalString(z.string().trim().max(100, "State must be 100 characters or fewer.")),
  country: optionalString(
    z.string().trim().max(100, "Country must be 100 characters or fewer.")
  ),
  postalCode: optionalString(
    z.string().trim().max(20, "Postal code must be 20 characters or fewer.")
  ),
});

// Field definitions shared by create and update. Defaults are
// deliberately NOT declared here: `updateVendorSchema` is a
// partial of this object, and a default here would be
// re-injected on every edit, overwriting stored values.
const vendorInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Vendor name must be at least 2 characters.")
    .max(120, "Vendor name must be 120 characters or fewer."),
  companyName: optionalString(
    z.string().trim().max(150, "Company name must be 150 characters or fewer.")
  ),
  contactPerson: optionalString(
    z.string().trim().max(120, "Contact person name must be 120 characters or fewer.")
  ),
  vendorType: z.enum(["INDIVIDUAL", "BUSINESS", "SERVICE_PROVIDER"]),
  category: optionalString(z.string().trim().max(100, "Category must be 100 characters or fewer.")),
  email: optionalString(
    z.string().trim().toLowerCase().email("Enter a valid email address.").max(254)
  ),
  phoneNumber: z
    .string()
    .trim()
    .regex(phoneRegex, "Phone number must be exactly 10 digits."),
  alternatePhone: optionalString(
    z
      .string()
      .trim()
      .regex(phoneRegex, "Enter a valid alternate phone number (10 digits).")
  ),

  taxNumber: optionalString(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(gstinRegex, "Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).")
  ),
  panNumber: optionalString(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(panRegex, "Enter a valid 10-character PAN (e.g. ABCDE1234F).")
  ),
  currency: z.string().trim().max(10),
  paymentTerms: z.string().trim().max(50),
  creditLimit: z
    .number({ error: "Credit limit is required." })
    .nonnegative("Credit limit cannot be negative."),
  openingBalance: z.number().optional(),

  bankAccountNumber: optionalString(
    z.string().trim().max(50, "Bank account number must be 50 characters or fewer.")
  ),
  bankIfsc: optionalString(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(ifscRegex, "Enter a valid 11-character IFSC code (e.g. SBIN0001234).")
  ),
  bankName: optionalString(z.string().trim().max(100, "Bank name must be 100 characters or fewer.")),
  bankBranch: optionalString(
    z.string().trim().max(100, "Bank branch must be 100 characters or fewer.")
  ),

  notes: optionalString(z.string().trim().max(2000)),

  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  sameAsBilling: z.boolean().optional(),
});

// Create keeps the defaults the service also applies, so clients
// (including the add form, which only sends name/phone/credit
// limit/address) still work.
export const createVendorSchema = vendorInputSchema.extend({
  vendorType: z.enum(["INDIVIDUAL", "BUSINESS", "SERVICE_PROVIDER"]).default("BUSINESS"),
  currency: z.string().trim().max(10).default("INR"),
  paymentTerms: z.string().trim().max(50).default("DUE_ON_RECEIPT"),
  openingBalance: z.number().optional().default(0),
  sameAsBilling: z.boolean().optional().default(true),
});

// Every field is optional on update; each is validated only when a
// value is provided, so a partial edit never resets omitted fields.
export const updateVendorSchema = vendorInputSchema.partial();

export const updateVendorStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"], {
    errorMap: () => ({ message: "Status must be ACTIVE or INACTIVE." }),
  }),
});

export const bulkActionVendorSchema = z.object({
  vendorIds: z.array(z.string().min(1)).min(1, "Select at least one vendor."),
  action: z.enum(["ACTIVATE", "DEACTIVATE", "DELETE"]),
});
