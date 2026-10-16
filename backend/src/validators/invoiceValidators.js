import { z } from "zod";

const paymentMethodSchema = z.enum([
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "UPI",
  "RAZORPAY",
  "STRIPE",
  "PAYPAL",
  "CASHFREE",
  "OTHER",
]);

const optionalText = (max, label) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .nullable();

const dateString = z
  .string()
  .min(1, "Date is required.")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date.")
  .transform((str) => new Date(str));

const invoiceItemSchema = z.object({
  itemType: z.enum(["PRODUCT", "SERVICE"]),
  itemId: z.string().uuid("Invalid product or service reference.").optional().nullable(),
  description: z.string().trim().min(1, "Description is required"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unitPrice: z.coerce.number().nonnegative("Unit price cannot be negative"),
  // Left optional on purpose: when omitted, the company default tax from
  // Settings is applied instead of silently defaulting to zero.
  taxRate: z.coerce.number().min(0, "Tax rate cannot be negative.").max(100, "Tax rate cannot exceed 100%.").optional().nullable(),
  discount: z.coerce.number().nonnegative("Discount cannot be negative.").default(0),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID"),
  invoiceDate: dateString.optional(),
  dueDate: dateString.optional(),
  notes: optionalText(2000, "Notes"),
  termsAndConditions: optionalText(2000, "Terms and conditions"),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  status: z.enum(["DRAFT", "SENT"]).default("DRAFT"),
});

/**
 * Update accepts everything create does except `status`: an invoice's status is
 * owned by handleStatusAction (PATCH /:id/status), so the update route must never
 * be able to change it. Omitting the key also strips it when a client sends one.
 */
export const updateInvoiceSchema = createInvoiceSchema.partial().omit({ status: true });

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  method: paymentMethodSchema,
  reference: optionalText(120, "Reference"),
  note: optionalText(500, "Note"),
  paymentDate: dateString,
});

export const invoiceStatusActionSchema = z.object({
  action: z.enum(["send", "cancel", "mark_paid", "void"]),
});

export const listInvoicesQuerySchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  customerId: z.string().uuid("Invalid customer ID.").optional(),
  search: z.string().trim().max(120, "Search term is too long.").optional(),
  from: z
    .string()
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid from date.")
    .optional(),
  to: z
    .string()
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid to date.")
    .optional(),
  overdue: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int("Page must be a whole number.").min(1).default(1),
  pageSize: z.coerce.number().int("Page size must be a whole number.").min(1).max(100).default(20),
});

export { paymentMethodSchema, dateString };
