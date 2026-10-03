import { z } from "zod";

const dateStringSchema = z
  .string()
  .min(1, "Date is required.")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date.")
  .transform((value) => new Date(value));

// An optional date field that always yields a real Date, because Prisma rejects
// a bare "YYYY-MM-DD" string for a DateTime column ("premature end of input").
//   undefined -> not supplied, leave the column alone
//   "" or null -> explicitly cleared, store null
//   anything else -> a Date instance
// A cleared <input type="date"> posts an empty string, which is treated as
// "cleared" rather than as an invalid date.
const optionalDateString = z
  .string()
  .refine(
    (value) => value.trim() === "" || !Number.isNaN(new Date(value).getTime()),
    "Invalid date."
  )
  .optional()
  .nullable()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value.trim() === "") return null;
    return new Date(value);
  });

const optionalNote = z
  .string()
  .trim()
  .max(2000, "Notes must be 2000 characters or fewer.")
  .optional()
  .nullable();

// A bill may be created either from a single lump amount or from line items,
// but not both. Supplying both is rejected outright rather than silently
// preferring one, so the caller always knows which value was used.
const billItemSchema = z.object({
  itemId: z.string().uuid("Invalid item ID.").optional().nullable(),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(2000, "Description must be 2000 characters or fewer."),
  quantity: z.coerce.number().positive("Quantity must be positive.").default(1),
  unitPrice: z.coerce.number().nonnegative("Unit price cannot be negative."),
});

const billFields = {
  vendorId: z.string().uuid("Invalid vendor ID."),
  billDate: dateStringSchema,
  dueDate: optionalDateString,
  category: z
    .string()
    .trim()
    .max(100, "Category must be 100 characters or fewer.")
    .optional()
    .nullable(),
  notes: optionalNote,
  attachmentUrl: z
    .string()
    .trim()
    .max(1000, "Attachment URL must be 1000 characters or fewer.")
    .optional()
    .nullable(),
};

const billTotals = {
  amount: z.coerce.number().min(0, "Amount cannot be negative.").optional(),
  items: z.array(billItemSchema).min(1, "At least one item is required.").optional(),
};

export const createBillSchema = z
  .object({ ...billFields, ...billTotals })
  .refine((data) => data.amount !== undefined || (data.items && data.items.length > 0), {
    message: "Either a lump amount or at least one line item must be provided.",
    path: ["amount"],
  })
  .refine((data) => !(data.amount !== undefined && data.items && data.items.length > 0), {
    message: "Provide either a lump amount OR line items, not both.",
    path: ["items"],
  });

// On update the caller may legitimately change only metadata, so create's
// "at least one of amount/items" requirement deliberately does not apply.
export const updateBillSchema = z
  .object({
    vendorId: z.string().uuid("Invalid vendor ID.").optional(),
    billDate: dateStringSchema.optional(),
    dueDate: optionalDateString,
    category: z
      .string()
      .trim()
      .max(100, "Category must be 100 characters or fewer.")
      .optional()
      .nullable(),
    notes: optionalNote,
    attachmentUrl: z
      .string()
      .trim()
      .max(1000, "Attachment URL must be 1000 characters or fewer.")
      .optional()
      .nullable(),
    ...billTotals,
  })
  .refine((data) => !(data.amount !== undefined && data.items && data.items.length > 0), {
    message: "Provide either a lump amount OR line items, not both.",
    path: ["items"],
  });

export { recordPaymentSchema as recordBillPaymentSchema } from "./paymentValidators.js";

export const listBillsQuerySchema = z.object({
  search: z.string().trim().max(120, "Search term is too long.").optional(),
  status: z
    .enum(["UNPAID", "PARTIALLY_PAID", "PAID"], {
      errorMap: () => ({ message: "Status must be UNPAID, PARTIALLY_PAID or PAID." }),
    })
    .optional(),
  vendorId: z.string().uuid("Invalid vendor ID.").optional(),
  category: z.string().trim().max(100).optional(),
  from: optionalDateString,
  to: optionalDateString,
  page: z.coerce.number().int("Page must be a whole number.").min(1).default(1),
  pageSize: z.coerce.number().int("Page size must be a whole number.").min(1).max(100).default(20),
});
