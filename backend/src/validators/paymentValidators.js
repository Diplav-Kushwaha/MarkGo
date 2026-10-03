import { z } from "zod";

export const paymentMethodSchema = z.enum(
  ["CASH", "BANK_TRANSFER", "CARD", "UPI", "RAZORPAY", "STRIPE", "PAYPAL", "CASHFREE", "OTHER"],
  { errorMap: () => ({ message: "Invalid payment method." }) }
);

export const dateStringSchema = z
  .string()
  .min(1, "Date is required.")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date.")
  .transform((value) => new Date(value));

const optionalDateString = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date.")
  .optional()
  .nullable();

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive."),
  method: paymentMethodSchema,
  reference: z.string().trim().max(100, "Reference must be 100 characters or fewer.").optional().nullable(),
  note: z.string().trim().max(500, "Note must be 500 characters or fewer.").optional().nullable(),
  paymentDate: dateStringSchema,
});

export const listPaymentsQuerySchema = z.object({
  search: z.string().trim().max(120, "Search term is too long.").optional(),
  direction: z
    .enum(["IN", "OUT"], { errorMap: () => ({ message: "Direction must be IN or OUT." }) })
    .optional(),
  from: optionalDateString,
  to: optionalDateString,
  page: z.coerce.number().int("Page must be a whole number.").min(1).default(1),
  pageSize: z.coerce.number().int("Page size must be a whole number.").min(1).max(100).default(20),
});

export const paymentSummaryQuerySchema = z.object({
  from: optionalDateString,
  to: optionalDateString,
});
