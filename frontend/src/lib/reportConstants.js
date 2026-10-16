/**
 * Shared constants and helpers for the Reports section.
 *
 * Kept in `lib/` beside the other cross-cutting helpers, and separate from
 * the report components, so the ten report pages agree on their filter
 * vocabularies without importing from each other. The values are exactly the
 * ones the API accepts — a sort name a page puts in a `sort` param must be in
 * the matching list below, because an unknown sort is what the backend rejects
 * with a specific 400.
 */

/**
 * The ten reports, in the order they are listed.
 *
 * The Company Admin sidebar keeps a single "Reports" item, so this catalogue is
 * what the Reports page renders its cards from, and what the report switcher
 * links through. Keeping it here (rather than in a component file) means the
 * page and the switcher can never disagree about which reports exist, and no
 * component file needs to export data alongside a component.
 */

// The icons are imported here rather than in the component so the catalogue
// stays a plain data module a component can import.
import {
  ArrowLeftRight,
  BarChart3,
  FileSpreadsheet,
  Package,
  Receipt,
  Store,
  Users,
  Wrench,
} from "lucide-react";

export const REPORT_CATALOGUE = [
  {
    group: "Transactions",
    items: [
      {
        key: "sales",
        label: "Sales",
        to: "/admin/reports/sales",
        icon: FileSpreadsheet,
        description: "Invoices issued in a period, with tax, discount, what is received and what is due.",
      },
      {
        key: "purchases",
        label: "Purchases",
        to: "/admin/reports/purchases",
        icon: Receipt,
        description: "Bills recorded in a period, with what is paid and what is still owed.",
      },
      {
        key: "transactions",
        label: "All Transactions",
        to: "/admin/reports/transactions",
        icon: ArrowLeftRight,
        description: "Every money movement - payments received against invoices and made against bills.",
      },
    ],
  },
  {
    group: "Profit & Loss",
    items: [
      {
        key: "profit-loss",
        label: "Profit & Loss",
        to: "/admin/reports/profit-loss",
        icon: BarChart3,
        description: "Revenue against cost, overall or split by date, month or year.",
      },
      {
        key: "product-profit",
        label: "Product-wise Profit & Loss",
        to: "/admin/reports/product-profit",
        icon: Package,
        description: "Profit for one sold product, or every sold product ranked.",
      },
      {
        key: "service-profit",
        label: "Service-wise Profit & Loss",
        to: "/admin/reports/service-profit",
        icon: Wrench,
        description: "Revenue and tax for one sold service, or every sold service ranked.",
      },
    ],
  },
  {
    group: "Lists",
    items: [
      {
        key: "customers",
        label: "All Customers",
        to: "/admin/reports/customers",
        icon: Users,
        description: "Who was billed, what was received and what is still due.",
      },
      {
        key: "vendors",
        label: "All Vendors",
        to: "/admin/reports/vendors",
        icon: Store,
        description: "Who billed you, what was paid and what is still owed.",
      },
      {
        key: "products",
        label: "All Products",
        to: "/admin/reports/products",
        icon: Package,
        description: "Stock and value: selling price, purchase price and quantity on hand.",
      },
      {
        key: "services",
        label: "All Services",
        to: "/admin/reports/services",
        icon: Wrench,
        description: "The service catalogue as price and availability.",
      },
    ],
  },
];

/** Flat list of every report, used for the switcher and for active-state matching. */
export const REPORT_LINKS = REPORT_CATALOGUE.flatMap((section) => section.items);

/**
 * The quick date presets offered above every report's date inputs. "Custom"
 * simply means the caller typed one of the two dates itself.
 */
export const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom" },
];

/** YYYY-MM-DD in the viewer's own timezone, which is what a date input wants. */
export function toDateInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Monday-based start of the week, matching the rest of the app's date inputs. */
function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

/**
 * The from/to pair a preset stands for, or null for "Custom" (which leaves the
 * typed dates alone).
 */
export function presetRange(preset) {
  const now = new Date();

  switch (preset) {
    case "today":
      return { from: toDateInput(now), to: toDateInput(now) };
    case "week":
      return { from: toDateInput(startOfWeek(now)), to: toDateInput(now) };
    case "month":
      return { from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInput(now) };
    case "year":
      return { from: toDateInput(new Date(now.getFullYear(), 0, 1)), to: toDateInput(now) };
    default:
      return null;
  }
}

/** Every report's sort offers, as the backend spells them. */
export const SALES_SORT_OPTIONS = [
  { value: "dateDesc", label: "Newest first" },
  { value: "dateAsc", label: "Oldest first" },
  { value: "totalDesc", label: "Total: high to low" },
  { value: "totalAsc", label: "Total: low to high" },
  { value: "dueDesc", label: "Due: high to low" },
  { value: "invoiceAsc", label: "Invoice number (A-Z)" },
];

export const PURCHASE_SORT_OPTIONS = [
  { value: "dateDesc", label: "Newest first" },
  { value: "dateAsc", label: "Oldest first" },
  { value: "totalDesc", label: "Total: high to low" },
  { value: "totalAsc", label: "Total: low to high" },
  { value: "dueDesc", label: "Due: high to low" },
  { value: "billAsc", label: "Bill number (A-Z)" },
];

export const TRANSACTION_SORT_OPTIONS = [
  { value: "dateDesc", label: "Newest first" },
  { value: "dateAsc", label: "Oldest first" },
  { value: "amountDesc", label: "Amount: high to low" },
  { value: "amountAsc", label: "Amount: low to high" },
];

export const TRANSACTION_TYPE_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "INCOMING", label: "Incoming" },
  { value: "OUTGOING", label: "Outgoing" },
];

export const TRANSACTION_STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "SUCCESSFUL", label: "Successful" },
];

export const TRANSACTION_MODE_OPTIONS = [
  { value: "ALL", label: "All modes" },
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
  { value: "RAZORPAY", label: "Razorpay" },
  { value: "STRIPE", label: "Stripe" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "CASHFREE", label: "Cashfree" },
  { value: "OTHER", label: "Other" },
];

export const PROFIT_LOSS_VIEW_OPTIONS = [
  { value: "overall", label: "Overall" },
  { value: "day", label: "By date" },
  { value: "month", label: "By month" },
  { value: "year", label: "By year" },
];

export const ITEM_PROFIT_SORT_OPTIONS = [
  { value: "profitDesc", label: "Profit: high to low" },
  { value: "profitAsc", label: "Profit: low to high" },
  { value: "revenueDesc", label: "Revenue: high to low" },
  { value: "revenueAsc", label: "Revenue: low to high" },
  { value: "marginDesc", label: "Margin %: high to low" },
  { value: "quantityDesc", label: "Units sold: high to low" },
  { value: "nameAsc", label: "Name (A-Z)" },
];

export const PARTY_SORT_FIELD_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "billed", label: "Total billed" },
  { value: "received", label: "Total received" },
  { value: "due", label: "Total due" },
  { value: "count", label: "Invoices / bills" },
  { value: "lastDate", label: "Last document date" },
];

export const PARTY_SORT_DIRECTION_OPTIONS = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

export const CATALOGUE_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "Name (A-Z)" },
  { value: "za", label: "Name (Z-A)" },
  { value: "priceHigh", label: "Selling price: high to low" },
  { value: "priceLow", label: "Selling price: low to high" },
  { value: "stockHigh", label: "Quantity: high to low" },
  { value: "stockLow", label: "Quantity: low to high" },
];

export const CATALOGUE_STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "notavailable", label: "Not available" },
];

export const STOCK_FILTERS = [
  { value: "", label: "All stock levels" },
  { value: "instock", label: "In stock" },
  { value: "lowstock", label: "Low stock" },
  { value: "outofstock", label: "Out of stock" },
];

export const DUES_FILTERS = [
  { value: "", label: "All" },
  { value: "yes", label: "With dues" },
  { value: "no", label: "Without dues" },
];

/**
 * Short labels shown next to a selling price. Mirrors `productConstants.js` /
 * `serviceConstants.js` so a report and its catalogue page can never disagree
 * about what a tax mode is called.
 */
export const TAX_MODE_LABELS = {
  INCLUSIVE: "incl. tax",
  EXCLUSIVE: "excl. tax",
  NONE: "no tax",
};

/** The stored ACTIVE / INACTIVE status, always shown in human words. */
export const AVAILABILITY_LABELS = {
  ACTIVE: "Available",
  INACTIVE: "Not available",
};

/** Payment status filter wording. "Unpaid" maps to SENT/OVERDUE server-side. */
export const PAYMENT_STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "PAID", label: "Paid" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "OVERDUE", label: "Overdue" },
];
