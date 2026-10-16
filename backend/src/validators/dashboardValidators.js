import { z } from "zod";
import { stripEmptyFilters } from "./reportValidators.js";

/**
 * Query validators for the Company Admin dashboard endpoints.
 *
 * STRICTLY READ-ONLY and tolerant, on purpose:
 *   - the company never arrives here (the route takes it from the verified token,
 *     and `validateQuery` already rejects a company key in the query before this
 *     schema ever runs);
 *   - `range`, `from`, `to` and `months` are the only known keys; anything else
 *     is stripped by `stripEmptyFilters` and thrown away, never rejected;
 *   - an empty string, null and the literal "all" all mean "use the default";
 *   - `range` and `months` normalise an unexpected value to their default rather
 *     than failing, so a typo can never turn a dashboard load into an error page;
 *   - a real problem (an unparseable date, or a "from" after a "to") still fails
 *     with a named field and a specific message, never a bare "Validation failed.".
 */

const NO_FILTER = ["", "all"];

const RANGE_PRESETS = ["today", "week", "month", "year", "custom"];

/** Optional ISO date. A blank / "all" value means "no explicit date". */
const optionalIsoDate = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    if (NO_FILTER.includes(text.toLowerCase())) return undefined;
    return text;
  },
  z
    .string({ error: "A date must be text in ISO format (YYYY-MM-DD)." })
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date. Use an ISO date (YYYY-MM-DD).")
    .transform((value) => new Date(value))
    .optional()
);

/** The ordering check shared by both endpoints, reported against the range. */
function withDateOrder(schema) {
  return schema.refine(
    (data) => data.from === undefined || data.to === undefined || data.from <= data.to,
    { message: "The 'from' date must be on or before the 'to' date.", path: ["range"] }
  );
}

/** The selected period. Anything unrecognised falls back to the month default. */
const rangePreset = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return "month";
    const text = String(value).trim().toLowerCase();
    if (NO_FILTER.includes(text)) return "month";
    return RANGE_PRESETS.includes(text) ? text : "month";
  },
  z.enum(RANGE_PRESETS, { error: `Range must be one of: ${RANGE_PRESETS.join(", ")}.` })
);

/** Number of months for the monthly charts. Anything other than 12 becomes 6. */
const monthCount = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return 6;
    return String(value).trim() === "12" ? 12 : 6;
  },
  z.union([z.literal(6), z.literal(12)], { error: "Months must be 6 or 12." })
);

/** GET /admin/dashboard/summary - the six summary cards and four count cards. */
export const dashboardSummaryQuerySchema = withDateOrder(
  stripEmptyFilters(
    z.object({
      range: rangePreset,
      from: optionalIsoDate,
      to: optionalIsoDate,
    })
  )
);

/** GET /admin/dashboard/charts - the four charts. */
export const dashboardChartsQuerySchema = withDateOrder(
  stripEmptyFilters(
    z.object({
      range: rangePreset,
      from: optionalIsoDate,
      to: optionalIsoDate,
      months: monthCount,
    })
  )
);
