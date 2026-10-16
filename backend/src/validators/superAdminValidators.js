import { z } from "zod";

/**
 * Query parameters for the Super Admin companies list.
 *
 * Pagination is deliberately forgiving: an empty or non-numeric value falls
 * back to the default instead of failing the request, while a numeric value
 * outside the allowed range is rejected (same contract as the other list
 * endpoints in the app).
 */
function numericParam({ fallback, min, max, label }) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined; // non-numeric -> default
    },
    z
      .number(`${label} must be a number.`)
      .int(`${label} must be a whole number.`)
      .min(min, `${label} must be at least ${min}.`)
      .max(max, `${label} must be at most ${max}.`)
      .default(fallback)
  );
}

export const listSuperAdminCompaniesQuerySchema = z.object({
  search: z.string().trim().max(120, "Search term is too long.").optional(),
  // PENDING_PAYMENT is a real CompanyStatus, so it has to be filterable here;
  // the Super Admin Companies screen offers it. Every value here is also a
  // member of COMPANY_STATUSES in superAdminService.js.
  status: z
    .enum(["ACTIVE", "SUSPENDED", "CANCELLED", "PENDING_PAYMENT"], {
      errorMap: () => ({
        message: "Status must be ACTIVE, SUSPENDED, CANCELLED or PENDING_PAYMENT.",
      }),
    })
    .optional(),
  // Whitelisted here so the service never interpolates a caller-supplied
  // column name into Prisma's orderBy.
  sortBy: z
    .enum(["name", "createdAt", "email"], {
      errorMap: () => ({ message: "Sort must be by name, createdAt or email." }),
    })
    .default("createdAt"),
  sortOrder: z
    .enum(["asc", "desc"], {
      errorMap: () => ({ message: "Sort order must be asc or desc." }),
    })
    .default("desc"),
  subscriptionState: z
    .enum(["VALID", "EXPIRED", "NO_SUBSCRIPTION"], {
      errorMap: () => ({
        message: "Subscription state must be VALID, EXPIRED or NO_SUBSCRIPTION.",
      }),
    })
    .optional(),
  page: numericParam({ fallback: 1, min: 1, max: 100000, label: "Page" }),
  pageSize: numericParam({ fallback: 20, min: 1, max: 100, label: "Page size" }),
});
