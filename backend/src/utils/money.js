import { Decimal } from "@prisma/client/runtime/library";

/**
 * Converts a Prisma Decimal (or numeric string) to a plain JS number for JSON
 * responses. All money is stored as Decimal(12,2) in the database; the API
 * contract exposes numbers so the frontend can format them directly.
 */
export function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(new Decimal(value).toFixed(2));
}

/**
 * Maps every key in `keys` through toNumber. Non-Decimal columns are untouched,
 * so it is safe to run over a whole row.
 */
export function mapMoney(row, keys) {
  if (!row || typeof row !== "object") return row;
  const result = { ...row };
  for (const key of keys) {
    if (key in result) {
      result[key] = toNumber(result[key]);
    }
  }
  return result;
}

export const INVOICE_MONEY_FIELDS = [
  "subtotal",
  "discountTotal",
  "taxTotal",
  "grandTotal",
  "amountPaid",
  "amountDue",
];

export const BILL_MONEY_FIELDS = ["total", "amountPaid", "amountDue"];

export const INVOICE_ITEM_MONEY_FIELDS = ["quantity", "unitPrice", "taxRate", "discount", "lineTotal"];

export const BILL_ITEM_MONEY_FIELDS = ["quantity", "unitPrice", "amount"];

export { Decimal };
