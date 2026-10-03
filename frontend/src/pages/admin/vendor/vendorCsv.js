import { vendorTypeLabel, paymentTermsLabel } from "./vendorConstants";
import { findAddress, formatDate, isFilled, toNumber } from "./vendorFormatters";
import { validateVendorDraft } from "./vendorValidation";

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

// `draftPath` is where the value is written on import (matching the form
// draft shape in vendorConstants.js). `read` pulls the value back out of a
// vendor record for export. `readOnly` columns are exported for reporting but
// ignored on import because the backend computes them.
export const VENDOR_CSV_COLUMNS = [
  { header: "Vendor Name", draftPath: "name", read: (v) => v.name },
  { header: "Company Name", draftPath: "companyName", read: (v) => v.companyName },
  { header: "Contact Person", draftPath: "contactPerson", read: (v) => v.contactPerson },
  {
    header: "Type",
    draftPath: "vendorType",
    read: (v) => vendorTypeLabel(v.vendorType),
  },
  { header: "Category", draftPath: "category", read: (v) => v.category },
  { header: "Email", draftPath: "email", read: (v) => v.email },
  { header: "Phone", draftPath: "phoneNumber", read: (v) => v.phoneNumber },
  { header: "Alternate Phone", draftPath: "alternatePhone", read: (v) => v.alternatePhone },
  { header: "GSTIN", draftPath: "taxNumber", read: (v) => v.taxNumber },
  { header: "PAN", draftPath: "panNumber", read: (v) => v.panNumber },
  { header: "Currency", draftPath: "currency", read: (v) => v.currency },
  {
    header: "Payment Terms",
    draftPath: "paymentTerms",
    read: (v) => paymentTermsLabel(v.paymentTerms),
  },
  { header: "Credit Limit", draftPath: "creditLimit", read: (v) => toNumber(v.creditLimit) },
  {
    header: "Opening Balance",
    draftPath: "openingBalance",
    read: (v) => toNumber(v.openingBalance),
  },
  {
    header: "Bank Account Number",
    draftPath: "bankAccountNumber",
    read: (v) => v.bankAccountNumber,
  },
  { header: "Bank IFSC", draftPath: "bankIfsc", read: (v) => v.bankIfsc },
  { header: "Bank Name", draftPath: "bankName", read: (v) => v.bankName },
  { header: "Bank Branch", draftPath: "bankBranch", read: (v) => v.bankBranch },
  { header: "Notes", draftPath: "notes", read: (v) => v.notes },
  {
    header: "Billing Line 1",
    draftPath: "billingAddress.line1",
    read: (v) => findAddress(v, "BILLING")?.line1,
  },
  {
    header: "Billing Line 2",
    draftPath: "billingAddress.line2",
    read: (v) => findAddress(v, "BILLING")?.line2,
  },
  {
    header: "Billing City",
    draftPath: "billingAddress.city",
    read: (v) => findAddress(v, "BILLING")?.city,
  },
  {
    header: "Billing State",
    draftPath: "billingAddress.state",
    read: (v) => findAddress(v, "BILLING")?.state,
  },
  {
    header: "Billing Country",
    draftPath: "billingAddress.country",
    read: (v) => findAddress(v, "BILLING")?.country,
  },
  {
    header: "Billing Postal Code",
    draftPath: "billingAddress.postalCode",
    read: (v) => findAddress(v, "BILLING")?.postalCode,
  },
  {
    header: "Shipping Line 1",
    draftPath: "shippingAddress.line1",
    read: (v) => findAddress(v, "SHIPPING")?.line1,
  },
  {
    header: "Shipping City",
    draftPath: "shippingAddress.city",
    read: (v) => findAddress(v, "SHIPPING")?.city,
  },
  {
    header: "Shipping State",
    draftPath: "shippingAddress.state",
    read: (v) => findAddress(v, "SHIPPING")?.state,
  },
  {
    header: "Shipping Country",
    draftPath: "shippingAddress.country",
    read: (v) => findAddress(v, "SHIPPING")?.country,
  },
  {
    header: "Shipping Postal Code",
    draftPath: "shippingAddress.postalCode",
    read: (v) => findAddress(v, "SHIPPING")?.postalCode,
  },
  // Read-only reporting columns.
  { header: "Status", read: (v) => v.status, readOnly: true },
  {
    header: "Outstanding Payable",
    read: (v) => toNumber(v.outstandingPayable),
    readOnly: true,
  },
  { header: "Total Purchased", read: (v) => toNumber(v.totalPurchased), readOnly: true },
  { header: "Total Paid", read: (v) => toNumber(v.totalPaid), readOnly: true },
  { header: "Created", read: (v) => formatDate(v.createdAt), readOnly: true },
];

// ---------------------------------------------------------------------------
// Minimal RFC 4180 CSV codec
// ---------------------------------------------------------------------------

function escapeCsvValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowToCsvLine(cells) {
  return cells.map(escapeCsvValue).join(",");
}

/**
 * Splits CSV text into a grid of cells. Handles quoted fields, escaped quotes
 * ("") and CRLF line endings. Returns [] for blank input.
 */
export function parseCsvGrid(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  if (!source.trim()) return [];

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  // Final cell/row when the file has no trailing newline.
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => String(value).trim() !== ""));
}

export function buildVendorsCsv(vendors) {
  const header = rowToCsvLine(VENDOR_CSV_COLUMNS.map((column) => column.header));
  const lines = vendors.map((vendor) =>
    rowToCsvLine(
      VENDOR_CSV_COLUMNS.map((column) => {
        const raw = column.read(vendor);
        return isFilled(raw) ? raw : "";
      })
    )
  );
  return [header, ...lines].join("\r\n");
}

export function buildVendorExportFilename(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `vendors-${stamp}.csv`;
}

export function downloadCsv(filename, csvText) {
  // The BOM keeps Excel from mangling non-ASCII characters.
  const blob = new Blob([`\uFEFF${csvText}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import: header mapping and row -> draft conversion
// ---------------------------------------------------------------------------

function normaliseKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Maps a normalised header to a draft path. Aliases cover the names people
// actually use in supplier spreadsheets, not just this app's own export.
const HEADER_ALIASES = {
  vendorname: "name",
  name: "name",
  vendornamesuppliername: "name",
  companyname: "companyName",
  organization: "companyName",
  organisation: "companyName",
  tradname: "companyName",
  contactperson: "contactPerson",
  contact: "contactPerson",
  type: "vendorType",
  vendortype: "vendorType",
  category: "category",
  email: "email",
  emailaddress: "email",
  phone: "phoneNumber",
  phonenumber: "phoneNumber",
  mobile: "phoneNumber",
  contactnumber: "phoneNumber",
  alternatephone: "alternatePhone",
  phone2: "alternatePhone",
  gstin: "taxNumber",
  gst: "taxNumber",
  gstnumber: "taxNumber",
  taxnumber: "taxNumber",
  taxid: "taxNumber",
  pan: "panNumber",
  pannumber: "panNumber",
  currency: "currency",
  paymentterms: "paymentTerms",
  terms: "paymentTerms",
  creditlimit: "creditLimit",
  openingbalance: "openingBalance",
  bankaccountnumber: "bankAccountNumber",
  accountnumber: "bankAccountNumber",
  bankifsc: "bankIfsc",
  ifsc: "bankIfsc",
  bankname: "bankName",
  bankbranch: "bankBranch",
  notes: "notes",
  note: "notes",
  billingline1: "billingAddress.line1",
  billingaddressline1: "billingAddress.line1",
  address: "billingAddress.line1",
  addressline1: "billingAddress.line1",
  billingline2: "billingAddress.line2",
  addressline2: "billingAddress.line2",
  billingcity: "billingAddress.city",
  city: "billingAddress.city",
  billingstate: "billingAddress.state",
  state: "billingAddress.state",
  billingcountry: "billingAddress.country",
  country: "billingAddress.country",
  billingpostalcode: "billingAddress.postalCode",
  billingzip: "billingAddress.postalCode",
  postalcode: "billingAddress.postalCode",
  pincode: "billingAddress.postalCode",
  zip: "billingAddress.postalCode",
  shippingline1: "shippingAddress.line1",
  shippingaddressline1: "shippingAddress.line1",
  shippingcity: "shippingAddress.city",
  shippingstate: "shippingAddress.state",
  shippingcountry: "shippingAddress.country",
  shippingpostalcode: "shippingAddress.postalCode",
  shippingzip: "shippingAddress.postalCode",
};

function setDraftPath(draft, path, value) {
  const segments = path.split(".");
  let cursor = draft;
  for (let index = 0; index < segments.length - 1; index += 1) {
    cursor = cursor[segments[index]];
  }
  cursor[segments[segments.length - 1]] = value;
}

function normaliseEnum(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

const TYPE_VALUES = ["INDIVIDUAL", "BUSINESS", "SERVICE_PROVIDER"];
const TERM_VALUES = ["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_45", "NET_60"];

function addRowError(errors, field, message) {
  if (!errors[field]) errors[field] = message;
}

/**
 * Turns raw CSV text into per-row drafts plus validation results.
 * Returns { rows, headerError }. Each row is { lineNumber, draft, errors }.
 * Rows that fail validation are still returned so the user can see exactly
 * what is wrong rather than getting a silent skip.
 */
export function parseVendorsCsv(text) {
  const grid = parseCsvGrid(text);
  if (!grid.length) {
    return { rows: [], headerError: "The file appears to be empty." };
  }

  const [headerCells, ...dataRows] = grid;
  const columnMap = headerCells.map((cell) => HEADER_ALIASES[normaliseKey(cell)] ?? null);

  if (!columnMap.some((path) => path === "name") || !columnMap.some((path) => path === "email")) {
    return {
      rows: [],
      headerError:
        'Could not find the required columns. The file needs at least "Vendor Name" and "Email" headers.',
    };
  }

  const rows = dataRows.map((cells, index) => {
    const draft = {
      vendorType: "BUSINESS",
      currency: "INR",
      paymentTerms: "DUE_ON_RECEIPT",
      billingAddress: {},
      shippingAddress: {},
      sameAsBilling: true,
    };
    const errors = {};

    cells.forEach((rawValue, columnIndex) => {
      const path = columnMap[columnIndex];
      if (!path) return;
      const value = String(rawValue ?? "").trim();
      if (!isFilled(value)) return;

      if (path === "vendorType") {
        const normalised = normaliseEnum(value);
        if (!TYPE_VALUES.includes(normalised)) {
          addRowError(errors, "vendorType", `Unknown vendor type "${value}".`);
          return;
        }
        setDraftPath(draft, path, normalised);
        return;
      }

      if (path === "paymentTerms") {
        const normalised = normaliseEnum(value);
        if (!TERM_VALUES.includes(normalised)) {
          addRowError(errors, "paymentTerms", `Unknown payment terms "${value}".`);
          return;
        }
        setDraftPath(draft, path, normalised);
        return;
      }

      setDraftPath(draft, path, value);
    });

    // The backend creates a SHIPPING address either from sameAsBilling or from
    // an explicit shipping address, so derive the flag here.
    const billingLine1 = draft.billingAddress?.line1 ?? "";
    const shippingLine1 = draft.shippingAddress?.line1 ?? "";
    draft.sameAsBilling = !shippingLine1 || shippingLine1 === billingLine1;

    Object.assign(errors, validateVendorDraft(draft));

    return { lineNumber: index + 2, draft, errors };
  });

  return { rows, headerError: "" };
}

export function summariseParsedRows(rows) {
  const valid = rows.filter((row) => Object.keys(row.errors).length === 0);
  return { valid, invalid: rows.filter((row) => Object.keys(row.errors).length > 0) };
}
