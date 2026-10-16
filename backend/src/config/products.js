/**
 * Product catalogue settings.
 *
 * Single source of truth for the low-stock threshold so the product list filter,
 * the product summary counts and the stock helpers can never disagree about what
 * "low stock" means. Change it here and every product code path follows.
 */

/** A product whose quantity is above 0 and at or below this value is low stock. */
export const LOW_STOCK_THRESHOLD = 5;

/** Default page size for the product list endpoint. */
export const PRODUCTS_DEFAULT_PAGE_SIZE = 10;

/** Hard cap for the product list page size. */
export const PRODUCTS_MAX_PAGE_SIZE = 100;
