import { z } from "zod";

/**
 * Query/body schemas for subscription payments and company subscriptions.
 *
 * The public payment routes take a payment id in the path, validated the same
 * way other id params are (see itemSchemas/billValidators: `z.string().uuid(...)`).
 */
export const paymentIdParamSchema = z.object({
  paymentId: z.string().uuid("Invalid payment ID."),
});

/**
 * Page/pageSize that falls back to a default when the value is empty or
 * non-numeric, and is rejected when it is numeric but out of range.
 */
function pageParam({ fallback, min, max, label }) {
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

export const purchasePlanSchema = z.object({
  planId: z.string().trim().min(1, "Select a plan."),
});

export const startFreeSchema = z.object({
  // Must be sent as a real boolean; anything else means "not confirmed".
  confirm: z.boolean().optional(),
});

export const subscriptionHistoryQuerySchema = z.object({
  page: pageParam({ fallback: 1, min: 1, max: 100000, label: "Page" }),
  pageSize: pageParam({ fallback: 10, min: 1, max: 50, label: "Page size" }),
});