/**
 * Service catalogue constants for the Services page.
 *
 * Kept beside the other cross-cutting helpers (`format`, `phone`) and separate
 * from `productConstants.js` so the two catalogues can never drift apart. The
 * status labels are presentation only: the stored value is always `ACTIVE` /
 * `INACTIVE`, and only the words shown to the admin differ.
 */

/** `type` value sent with every service request, which routes it to the service rules. */
export const SERVICE_TYPE = "SERVICE";

/** Backend `sellingPriceTaxMode` values. */
export const TAX_MODES = {
  INCLUSIVE: "INCLUSIVE",
  EXCLUSIVE: "EXCLUSIVE",
  NONE: "NONE",
};

/** Short labels shown next to a selling price in the services table. */
export const TAX_MODE_LABELS = {
  INCLUSIVE: "incl. tax",
  EXCLUSIVE: "excl. tax",
  NONE: "no tax",
};

/** Longer labels for the tax-mode selector in the form. */
export const TAX_MODE_OPTIONS = [
  { value: "INCLUSIVE", label: "Tax included" },
  { value: "EXCLUSIVE", label: "Tax excluded" },
  { value: "NONE", label: "Without tax" },
];

/**
 * Services are stored ACTIVE / INACTIVE and labelled for humans everywhere on
 * the page: badges, action labels, toasts and the confirmation dialog.
 */
export const SERVICE_STATUS_LABELS = {
  ACTIVE: "Available",
  INACTIVE: "Not available",
};

/** Status options for the form (the friendly wording; the API value stays ACTIVE/INACTIVE). */
export const SERVICE_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Available" },
  { value: "INACTIVE", label: "Not available" },
];

/** Status filter options for the filters bar. */
export const SERVICE_STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "notavailable", label: "Not available" },
];

/** Sort options in the order they appear in the dropdown. */
export const SERVICE_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "Name (A-Z)" },
  { value: "za", label: "Name (Z-A)" },
  { value: "priceHigh", label: "Price: high to low" },
  { value: "priceLow", label: "Price: low to high" },
];
