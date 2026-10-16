import { z } from "zod";
import { PRODUCTS_DEFAULT_PAGE_SIZE, PRODUCTS_MAX_PAGE_SIZE } from "../config/products.js";

/**
 * Product validation.
 *
 * Products and Services share one Prisma model, but only products use this
 * schema: the shared item routes pick it when the request declares
 * `type: "PRODUCT"`, and leave the Services path on the existing item schema.
 *
 * Shape and ranges are enforced here; the cross-field business rules (tax mode
 * coherence, duplicate product codes, and unit/category existence) live in
 * productService so create and update share one implementation.
 *
 * Optional fields are optional in the real sense: an absent key, an explicit
 * `null` and an empty string (what an HTML form sends for an untouched input)
 * all mean "not provided", so a partial update never trips a required check.
 */

const PRICE_TAX_MODES = ["INCLUSIVE", "EXCLUSIVE", "NONE"];

/**
 * Status is stored as ACTIVE / INACTIVE (shown to users as Available / Not
 * available). Only the list query uses the friendly `available` / `notavailable`
 * spellings, exactly as the product contract specifies; writes keep the stored
 * ACTIVE / INACTIVE values the Services path already accepts.
 */
const STATUS_VALUES = ["ACTIVE", "INACTIVE"];

/** `""` (blank form input) and an absent key both mean "not provided". */
const blankToUndefined = (value) => (value === "" || value === null ? undefined : value);

/**
 * `null` is NOT folded into undefined: an explicit null is how a client clears
 * an optional field, while `""` and an absent key leave the stored value alone.
 */
const blankToUndefinedKeepNull = (value) => (value === "" ? undefined : value);

const optionalEnum = (values, label) =>
  z.preprocess(
    blankToUndefined,
    z.enum(values, { error: `${label} must be one of: ${values.join(", ")}.` }).optional()
  );

/** Optional text: `""` and an absent key mean "not provided". */
const optionalText = (max, label) =>
  z.preprocess(
    blankToUndefined,
    z
      .string({ error: `${label} must be text.` })
      .trim()
      .max(max, `${label} must be ${max} characters or fewer.`)
      .optional()
  );

/** Optional nullable text: also accepts an explicit `null` to clear the field. */
const clearableText = (max, label) =>
  z.preprocess(
    blankToUndefinedKeepNull,
    z
      .string({ error: `${label} must be text.` })
      .trim()
      .max(max, `${label} must be ${max} characters or fewer.`)
      .nullable()
      .optional()
  );

/**
 * Numbers arrive as JSON numbers or as form strings. Anything that is not a
 * finite number (including a blank field) becomes NaN so every failure produces
 * the same readable "must be a valid number" message.
 */
function numberSchema({ label, min, max, integer = false }) {
  let inner = z.number({ error: `${label} must be a valid number.` });
  if (integer) inner = inner.int(`${label} must be a whole number.`);
  if (min !== undefined) inner = inner.min(min, `${label} must be ${min} or greater.`);
  if (max !== undefined) inner = inner.max(max, `${label} must be ${max} or less.`);

  return z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return NaN;
    const n = typeof value === "number" ? value : Number(String(value).trim());
    return Number.isNaN(n) ? NaN : n;
  }, inner);
}

/** Optional number: `""` and an absent key mean "not provided". */
const optionalNumber = (opts) => z.preprocess(blankToUndefined, numberSchema(opts).optional());

/** Optional nullable number: also accepts an explicit `null` to clear the field. */
const clearableNumber = (opts) => z.preprocess(blankToUndefinedKeepNull, numberSchema(opts).nullish());

const clearableEnum = (values, label) =>
  z.preprocess(
    blankToUndefinedKeepNull,
    z.enum(values, { error: `${label} must be one of: ${values.join(", ")}.` }).nullish()
  );

// ---------------------------------------------------------------------------
// Create — every mandatory field of the product contract is required here.
// ---------------------------------------------------------------------------

export const createProductSchema = z.object({
  // Accepted so the shared route can select this schema; the product path always
  // stores type = PRODUCT regardless of the value sent.
  type: z.literal("PRODUCT").optional(),

  name: z
    .string({ error: "Name must be text." })
    .trim()
    .min(1, "Name is required.")
    .max(200, "Name must be 200 characters or fewer."),
  productCode: z
    .string({ error: "Product code must be text." })
    .trim()
    .min(1, "Product code is required.")
    .max(60, "Product code must be 60 characters or fewer."),

  unitId: z.preprocess(
    blankToUndefined,
    z.string({ error: "Unit is required." }).uuid("Unit is invalid.")
  ),
  categoryId: z.preprocess(
    blankToUndefined,
    z.string({ error: "Category is required." }).uuid("Category is invalid.")
  ),

  sellingPrice: numberSchema({ label: "Selling price", min: 0 }),
  sellingPriceTaxMode: z.enum(PRICE_TAX_MODES, {
    error: `Selling price tax mode must be one of: ${PRICE_TAX_MODES.join(", ")}.`,
  }),

  purchasePrice: clearableNumber({ label: "Purchase price", min: 0 }),
  purchasePriceTaxMode: clearableEnum(PRICE_TAX_MODES, "Purchase price tax mode"),

  taxRate: optionalNumber({ label: "Tax rate", min: 0, max: 100 }),

  quantity: z.preprocess(
    blankToUndefined,
    numberSchema({ label: "Quantity", min: 0, integer: true }).default(0)
  ),
  discountPercent: optionalNumber({ label: "Discount percent", min: 0, max: 100 }),

  hsnSacCode: optionalText(20, "HSN / SAC code"),
  brand: optionalText(100, "Brand"),
  description: optionalText(2000, "Description"),
  status: optionalEnum(STATUS_VALUES, "Status"),
});

// ---------------------------------------------------------------------------
// Update — every field is optional.
//
// Deliberately written out instead of `createProductSchema.partial()`: zod's
// `.partial()` keeps `.default()` values, so a reused `quantity` default would
// silently reset the stock of every product that is edited. Each field keeps its
// own rule, so a PATCH that sends only `quantity` never trips the required
// checks of the fields it does not mention.
// ---------------------------------------------------------------------------

export const updateProductSchema = z.object({
  type: z.literal("PRODUCT").optional(),

  name: optionalText(200, "Name"),
  productCode: optionalText(60, "Product code"),

  // `""` / absent means "not provided"; an explicit null is rejected, because a
  // product must always keep a unit and a category.
  unitId: z.preprocess(
    blankToUndefined,
    z.string({ error: "Unit is required." }).uuid("Unit is invalid.").optional()
  ),
  categoryId: z.preprocess(
    blankToUndefined,
    z.string({ error: "Category is required." }).uuid("Category is invalid.").optional()
  ),

  sellingPrice: optionalNumber({ label: "Selling price", min: 0 }),
  sellingPriceTaxMode: optionalEnum(PRICE_TAX_MODES, "Selling price tax mode"),

  purchasePrice: clearableNumber({ label: "Purchase price", min: 0 }),
  purchasePriceTaxMode: clearableEnum(PRICE_TAX_MODES, "Purchase price tax mode"),

  taxRate: optionalNumber({ label: "Tax rate", min: 0, max: 100 }),

  quantity: optionalNumber({ label: "Quantity", min: 0, integer: true }),
  discountPercent: clearableNumber({ label: "Discount percent", min: 0, max: 100 }),

  hsnSacCode: clearableText(20, "HSN / SAC code"),
  brand: clearableText(100, "Brand"),
  description: clearableText(2000, "Description"),
  status: optionalEnum(STATUS_VALUES, "Status"),
});

// ---------------------------------------------------------------------------
// Status toggle (same ACTIVE / INACTIVE contract as the Services path)
//
// The shared `PATCH /items/:id/status` route validates with the item schema, so
// the Services contract is untouched. The product service re-parses the value
// through this schema, which is what actually decides the product's own status
// vocabulary — hence it is exported and used there, not only here.
// ---------------------------------------------------------------------------

export const productStatusSchema = z.object({
  status: z.enum(STATUS_VALUES, {
    error: "Status must be ACTIVE or INACTIVE.",
  }),
});

// ---------------------------------------------------------------------------
// List query
//
// The new vocabulary is `status=available|notavailable`, `stock=instock|
// lowstock|outofstock` and `sort=newest|oldest|az|za|priceHigh|priceLow`.
//
// The values the existing catalogue pages still send (`ACTIVE`/`INACTIVE`,
// `stockLevel=OUT_OF_STOCK`, `sortBy`+`sortOrder`) are accepted as well and
// normalised by the service, so the current frontend keeps working unchanged
// while a new client can use the new names. `type`, `category` and any other
// old filter are stripped and ignored, as required for the product path.
// `validateQuery` publishes the parsed result on `req.validatedQuery`.
// ---------------------------------------------------------------------------

const STATUS_FILTERS = ["available", "notavailable", "ACTIVE", "INACTIVE"];
const STOCK_FILTERS = [
  "instock",
  "lowstock",
  "outofstock",
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
];
const SORTS = ["newest", "oldest", "az", "za", "priceHigh", "priceLow"];

export const productListQuerySchema = z.object({
  search: z.preprocess(
    blankToUndefined,
    z.string({ error: "Search must be text." }).trim().max(120, "Search term is too long.").optional()
  ),
  status: optionalEnum(STATUS_FILTERS, "Status filter"),
  stock: optionalEnum(STOCK_FILTERS, "Stock filter"),
  sort: optionalEnum(SORTS, "Sort"),
  // Legacy aliases still sent by the current catalogue pages.
  stockLevel: optionalEnum(STOCK_FILTERS, "Stock filter"),
  sortBy: z.preprocess(
    blankToUndefined,
    z.string({ error: "Sort field must be text." }).trim().max(40).optional()
  ),
  sortOrder: z.preprocess(
    blankToUndefined,
    z.string({ error: "Sort order must be text." }).trim().max(10).optional()
  ),
  page: z.preprocess(
    blankToUndefined,
    numberSchema({ label: "Page", min: 1, integer: true }).default(1)
  ),
  pageSize: z.preprocess(
    blankToUndefined,
    numberSchema({
      label: "Page size",
      min: 1,
      max: PRODUCTS_MAX_PAGE_SIZE,
      integer: true,
    }).default(PRODUCTS_DEFAULT_PAGE_SIZE)
  ),
});
