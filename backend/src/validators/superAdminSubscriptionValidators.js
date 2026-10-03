import { z } from "zod";
import { registerSchema } from "./authSchemas.js";

/**
 * Super Admin subscription validators: plan management, company status and the
 * subscription list/summary queries.
 *
 * Bodies are plain zod objects, so unknown keys are stripped rather than passed
 * through to Prisma.
 */

const MAX_PRICE = 10_000_000;

const limitFields = {
  maxUsers: z.number().int("Max users must be a whole number.").min(0).nullable().optional(),
  maxStaff: z.number().int("Max staff must be a whole number.").min(0).nullable().optional(),
  maxCustomers: z.number().int("Max customers must be a whole number.").min(0).nullable().optional(),
  maxVendors: z.number().int("Max vendors must be a whole number.").min(0).nullable().optional(),
  maxInvoices: z.number().int("Max invoices must be a whole number.").min(0).nullable().optional(),
};

/** Non-negative whole number, or null for "unlimited". */
const optionalCount = (label) =>
  z
    .union([
      z.number().int(`${label} must be a whole number.`).min(0, `${label} cannot be negative.`),
      z.null(),
    ])
    .optional();

export const planIdParamSchema = z.object({
  id: z.string().uuid("Invalid plan ID."),
});

export const companyIdParamSchema = z.object({
  id: z.string().uuid("Invalid company ID."),
});

export const createPlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Plan name must be at least 2 characters.")
    .max(60, "Plan name must be 60 characters or fewer."),
  billingCycle: z.enum(["FREE", "MONTHLY", "YEARLY"], {
    errorMap: () => ({ message: "Billing cycle must be FREE, MONTHLY or YEARLY." }),
  }),
  price: z.coerce
    .number("Price must be a number.")
    .min(0, "Price cannot be negative.")
    .max(MAX_PRICE, `Price must be at most ${MAX_PRICE.toLocaleString("en-IN")}.`),
  durationMonths: optionalCount("Duration"),
  description: z.string().trim().max(500, "Description must be 500 characters or fewer.").optional(),
  ...limitFields,
  isActive: z.boolean().optional(),
  sortOrder: z.number().int("Sort order must be a whole number.").min(0).optional(),
});

export const updatePlanSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Plan name must be at least 2 characters.")
      .max(60, "Plan name must be 60 characters or fewer.")
      .optional(),
    price: z.coerce
      .number("Price must be a number.")
      .min(0, "Price cannot be negative.")
      .max(MAX_PRICE, `Price must be at most ${MAX_PRICE.toLocaleString("en-IN")}.`)
      .optional(),
    durationMonths: optionalCount("Duration"),
    description: z.string().trim().max(500, "Description must be 500 characters or fewer.").optional(),
    ...limitFields,
    isActive: z.boolean().optional(),
    sortOrder: z.number().int("Sort order must be a whole number.").min(0).optional(),
  })
  // billingCycle is intentionally absent: it can never be changed.
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one field to update.",
  });

export const companyStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"], {
    errorMap: () => ({ message: "Status must be ACTIVE or SUSPENDED." }),
  }),
});

/**
 * Pagination is forgiving: an empty or non-numeric value falls back to the
 * default, while a numeric value outside the range is rejected.
 */
function numericParam({ fallback, min, max, label }) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    },
    z
      .number(`${label} must be a number.`)
      .int(`${label} must be a whole number.`)
      .min(min, `${label} must be at least ${min}.`)
      .max(max, `${label} must be at most ${max}.`)
      .default(fallback)
  );
}

export const listSubscriptionsQuerySchema = z.object({
  state: z
    .enum(["ACTIVE", "EXPIRED", "PENDING", "CANCELLED", "EXPIRING"], {
      errorMap: () => ({
        message: "State must be ACTIVE, EXPIRED, PENDING, CANCELLED or EXPIRING.",
      }),
    })
    .optional(),
  planId: z.string().uuid("Invalid plan ID.").optional(),
  companyId: z.string().uuid("Invalid company ID.").optional(),
  search: z.string().trim().max(120, "Search term is too long.").optional(),
  days: numericParam({ fallback: 7, min: 1, max: 90, label: "Days" }),
  page: numericParam({ fallback: 1, min: 1, max: 100000, label: "Page" }),
  pageSize: numericParam({ fallback: 20, min: 1, max: 100, label: "Page size" }),
});

/**
 * Super Admin create-company body.
 *
 * The company and admin fields are lifted straight from the public
 * registerSchema, so name/email/GST/phone/password rules can never drift
 * between the two paths. Only planId differs: it is required here, and it
 * replaces the public route's optional version.
 */
export const superAdminCreateCompanySchema = registerSchema
  .omit({ planId: true })
  .extend({
    planId: z.string().uuid("Select a plan."),
    // MANUAL records the payment by hand; ONLINE sends the company to the
    // public dummy payment page.
    payment: z
      .enum(["MANUAL", "ONLINE"], {
        errorMap: () => ({ message: "Payment must be MANUAL or ONLINE." }),
      })
      .default("MANUAL"),
    paymentNote: z
      .string()
      .trim()
      .max(200, "Payment note must be 200 characters or fewer.")
      .optional(),
  });

export const assignSubscriptionSchema = z.object({
  planId: z.string().uuid("Select a plan."),
  // NONE is a complimentary grant on a paid plan: no payment row.
  payment: z
    .enum(["MANUAL", "NONE"], {
      errorMap: () => ({ message: "Payment must be MANUAL or NONE." }),
    })
    .default("MANUAL"),
  paymentNote: z
    .string()
    .trim()
    .max(200, "Payment note must be 200 characters or fewer.")
    .optional(),
});