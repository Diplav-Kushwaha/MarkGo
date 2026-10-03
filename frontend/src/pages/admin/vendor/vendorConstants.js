// Shared vocabulary for the Vendor Management page. Every value here mirrors
// something the backend actually accepts or returns — see
// backend/src/validators/vendorSchemas.js and backend/prisma/schema.prisma
// (enums VendorType / VendorStatus).

export const VENDOR_TYPES = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "BUSINESS", label: "Business" },
  { value: "SERVICE_PROVIDER", label: "Service Provider" },
];

export const VENDOR_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

// Matches the examples in the schema comment for Vendor.paymentTerms.
export const PAYMENT_TERMS = [
  { value: "DUE_ON_RECEIPT", label: "Due on Receipt" },
  { value: "NET_15", label: "Net 15 days" },
  { value: "NET_30", label: "Net 30 days" },
  { value: "NET_45", label: "Net 45 days" },
  { value: "NET_60", label: "Net 60 days" },
];

export const DEFAULT_CURRENCY = "INR";

export const DEFAULT_PAGE_SIZE = 10;

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Columns the backend accepts in `sortBy` — anything else silently falls back
// to createdAt server-side, so the UI only offers these.
export const SORTABLE_COLUMNS = {
  name: "Vendor",
  vendorType: "Type",
  outstandingPayable: "Outstanding",
  totalPurchased: "Total Purchased",
  creditLimit: "Credit Limit",
  createdAt: "Created",
};

export const EMPTY_ADDRESS = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  country: "India",
  postalCode: "",
};

// Mirrors createVendorSchema's shape so the form and the API agree on field
// names. Numeric fields stay as strings here and are converted on submit.
export const EMPTY_VENDOR_FORM = {
  name: "",
  companyName: "",
  contactPerson: "",
  vendorType: "BUSINESS",
  category: "",
  email: "",
  phoneNumber: "",
  alternatePhone: "",
  taxNumber: "",
  panNumber: "",
  currency: DEFAULT_CURRENCY,
  paymentTerms: "DUE_ON_RECEIPT",
  creditLimit: "",
  openingBalance: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankName: "",
  bankBranch: "",
  notes: "",
  billingAddress: { ...EMPTY_ADDRESS },
  shippingAddress: { ...EMPTY_ADDRESS },
  sameAsBilling: true,
};

// The backend's phone rule (vendorSchemas.js phoneRegex).
export const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function vendorTypeLabel(value) {
  return VENDOR_TYPES.find((t) => t.value === value)?.label ?? value ?? "—";
}

export function paymentTermsLabel(value) {
  return PAYMENT_TERMS.find((t) => t.value === value)?.label ?? value ?? "—";
}
