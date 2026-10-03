import { z } from "zod";

const prefixSchema = z
  .string()
  .trim()
  .min(1, "Prefix is required.")
  .max(10, "Prefix must be 10 characters or fewer.")
  .regex(/^[A-Za-z0-9_-]+$/, "Prefix may only contain letters, numbers, hyphens and underscores.");

export const updateSettingsSchema = z.object({
  invoicePrefix: prefixSchema.optional(),
  billPrefix: prefixSchema.optional(),
  defaultTaxPercent: z
    .number()
    .min(0, "Default tax percent cannot be negative.")
    .max(100, "Default tax percent cannot exceed 100.")
    .optional(),
  currency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter code such as INR.")
    .toUpperCase()
    .optional(),
  decimalPlaces: z
    .number()
    .int("Decimal places must be a whole number.")
    .min(0, "Decimal places cannot be negative.")
    .max(4, "Decimal places cannot exceed 4.")
    .optional(),
  defaultPaymentTermsDays: z
    .number()
    .int("Payment terms must be a whole number of days.")
    .min(0, "Payment terms cannot be negative.")
    .max(365, "Payment terms cannot exceed 365 days.")
    .optional(),
  invoiceNotes: z.string().trim().max(2000, "Invoice notes must be 2000 characters or fewer.").optional().nullable(),
  billNotes: z.string().trim().max(2000, "Bill notes must be 2000 characters or fewer.").optional().nullable(),
});

export const settingsDefaults = {
  invoicePrefix: "INV",
  billPrefix: "BILL",
  defaultTaxPercent: 18,
  currency: "INR",
  decimalPlaces: 2,
  defaultPaymentTermsDays: 15,
};
