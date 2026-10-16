/**
 * Service catalogue settings.
 *
 * Single source of truth for the service list pagination, mirroring
 * `config/products.js` for the product path. The service list keeps the
 * pagination contract the item list already used: `{ total, page, pageSize,
 * totalPages }` around the current page of services.
 */

/** Default page size for the service list endpoint. */
export const SERVICES_DEFAULT_PAGE_SIZE = 10;

/** Hard cap for the service list page size. */
export const SERVICES_MAX_PAGE_SIZE = 100;
