/**
 * Product catalogue constants shared by the Products page and form.
 *
 * Kept in `lib/` alongside the other cross-cutting helpers (`format`, `phone`)
 * so the Products page, its stock indicators and any future product component
 * agree on what "low stock" means without duplicating the number.
 */

/**
 * A product whose quantity is above 0 and at or below this value is low stock.
 * Mirrors the backend's `LOW_STOCK_THRESHOLD` so the UI and the summary
 * endpoint can never disagree.
 */
export const LOW_STOCK_THRESHOLD = 5;

/** Backend `sellingPriceTaxMode` / `purchasePriceTaxMode` values. */
export const TAX_MODES = {
  INCLUSIVE: "INCLUSIVE",
  EXCLUSIVE: "EXCLUSIVE",
  NONE: "NONE",
};

/** Short labels shown next to a selling price in the products table. */
export const TAX_MODE_LABELS = {
  INCLUSIVE: "incl. tax",
  EXCLUSIVE: "excl. tax",
  NONE: "no tax",
};

/** Products are stored ACTIVE/INACTIVE and labelled for humans everywhere. */
export const PRODUCT_STATUS_LABELS = {
  ACTIVE: "Available",
  INACTIVE: "Not available",
};
