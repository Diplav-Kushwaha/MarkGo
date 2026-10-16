import prisma from "../prisma.js";
import { toNumber, mapMoney, INVOICE_MONEY_FIELDS, INVOICE_ITEM_MONEY_FIELDS } from "../utils/money.js";

/**
 * Customer dashboard service — strictly READ-ONLY.
 *
 * Every function below only READS data (Prisma findMany / findFirst / count /
 * aggregate). Identity and company are passed in by the controller, which takes
 * them from the verified token (`req.customer`), never from the request. No
 * function here creates, updates or deletes anything, and none of them ever
 * exposes another customer's data, vendor data, purchase price, cost, profit or
 * exact stock quantity to a customer.
 */

function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function appError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ---------------------------------------------------------------------------
// Profile (6)
// ---------------------------------------------------------------------------

/**
 * The logged-in customer's own record, with their company's stored details.
 * Financial balances (credit limit, opening balance, outstanding) and internal
 * fields (password, login attempts, lock) are deliberately NOT returned.
 */
export async function getCustomerProfile({ customerId }) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      companyName: true,
      email: true,
      phoneNumber: true,
      alternatePhone: true,
      taxNumber: true,
      panNumber: true,
      customerType: true,
      currency: true,
      createdAt: true,
      company: { select: { name: true, address: true, city: true, country: true, gstNumber: true, currency: true } },
      addresses: {
        select: { id: true, type: true, line1: true, line2: true, city: true, state: true, country: true, postalCode: true },
        orderBy: { type: "asc" },
      },
    },
  });

  if (!customer) throw appError("Customer not found.", 404);
  return customer;
}

// ---------------------------------------------------------------------------
// Sort vocabularies
// ---------------------------------------------------------------------------

const PURCHASED_SORTS = {
  recent: (a, b) => new Date(b.lastPurchaseDate || 0) - new Date(a.lastPurchaseDate || 0),
  az: (a, b) => String(a.name || "").localeCompare(String(b.name || "")),
  quantity: (a, b) => b.totalQuantity - a.totalQuantity,
};

const INVOICE_SORTS = {
  newest: { invoiceDate: "desc" },
  oldest: { invoiceDate: "asc" },
  amountHigh: { grandTotal: "desc" },
  amountLow: { grandTotal: "asc" },
};

const CATALOG_SORTS = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  az: { name: "asc" },
  za: { name: "desc" },
  priceHigh: { salesPrice: "desc" },
  priceLow: { salesPrice: "asc" },
};

// ---------------------------------------------------------------------------
// Purchased products (1) — derived from the customer's own invoice line items
// ---------------------------------------------------------------------------

/**
 * Groups the customer's invoice line items into one row per thing purchased.
 *
 * The row's product code / name / unit come from the linked `Item` when the line
 * carries an `itemId`; otherwise the line's own stored `description` is used,
 * because invoice items are allowed to exist without a catalogue link.
 */
export async function listCustomerPurchasedProducts({
  customerId,
  companyId,
  search,
  sort,
  page = 1,
  limit = 10,
}) {
  const lines = await prisma.invoiceItem.findMany({
    where: { invoice: { customerId, companyId } },
    orderBy: { invoice: { invoiceDate: "asc" } },
    select: {
      id: true,
      itemType: true,
      itemId: true,
      description: true,
      quantity: true,
      unitPrice: true,
      invoice: { select: { id: true, invoiceNumber: true, invoiceDate: true } },
      item: {
        select: {
          id: true,
          name: true,
          productCode: true,
          type: true,
          unit: true,
          unitRel: { select: { fullName: true, shortName: true } },
        },
      },
    },
  });

  const grouped = new Map();
  for (const line of lines) {
    const key = line.itemId ? `item:${line.itemId}` : `desc:${String(line.description || "").trim().toLowerCase()}`;
    const quantity = toNumber(line.quantity);
    const unitPrice = toNumber(line.unitPrice);
    const invoiceDate = line.invoice?.invoiceDate || null;

    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        key,
        itemId: line.itemId || null,
        type: line.item?.type || line.itemType,
        name: line.item?.name || line.description,
        productCode: line.item?.productCode || null,
        unit: line.item?.unitRel?.shortName || line.item?.unitRel?.fullName || line.item?.unit || null,
        totalQuantity: 0,
        totalValue: 0,
        invoiceIds: new Set(),
        lastPurchaseDate: invoiceDate,
        lastUnitPrice: unitPrice,
        lastInvoiceNumber: line.invoice?.invoiceNumber || null,
        firstPurchaseDate: invoiceDate,
      };
      grouped.set(key, entry);
    }

    entry.totalQuantity += quantity;
    entry.totalValue += quantity * unitPrice;
    if (line.invoice?.id) entry.invoiceIds.add(line.invoice.id);

    if (invoiceDate) {
      if (!entry.firstPurchaseDate || new Date(invoiceDate) < new Date(entry.firstPurchaseDate)) {
        entry.firstPurchaseDate = invoiceDate;
      }
      if (!entry.lastPurchaseDate || new Date(invoiceDate) >= new Date(entry.lastPurchaseDate)) {
        entry.lastPurchaseDate = invoiceDate;
        entry.lastUnitPrice = unitPrice;
        entry.lastInvoiceNumber = line.invoice?.invoiceNumber || null;
      }
    }
  }

  let rows = [...grouped.values()].map((entry) => ({
    id: entry.key,
    itemId: entry.itemId,
    type: entry.type,
    name: entry.name,
    productCode: entry.productCode,
    unit: entry.unit,
    totalQuantity: round2(entry.totalQuantity),
    invoiceCount: entry.invoiceIds.size,
    firstPurchaseDate: entry.firstPurchaseDate,
    lastPurchaseDate: entry.lastPurchaseDate,
    lastInvoiceNumber: entry.lastInvoiceNumber,
    lastUnitPrice: round2(entry.lastUnitPrice),
    averageUnitPrice: entry.totalQuantity > 0 ? round2(entry.totalValue / entry.totalQuantity) : 0,
  }));

  const term = (search || "").trim().toLowerCase();
  if (term) {
    rows = rows.filter(
      (row) =>
        String(row.name || "").toLowerCase().includes(term) ||
        String(row.productCode || "").toLowerCase().includes(term)
    );
  }

  rows.sort(PURCHASED_SORTS[sort] || PURCHASED_SORTS.recent);

  const take = Math.min(Number(limit) || 10, 100);
  const currentPage = Number(page) || 1;
  const total = rows.length;
  const totalPages = Math.ceil(total / take) || 1;
  const pageRows = rows.slice((currentPage - 1) * take, currentPage * take);

  return {
    items: pageRows,
    pagination: { total, page: currentPage, pageSize: take, totalPages },
  };
}

// ---------------------------------------------------------------------------
// Invoices (2)
// ---------------------------------------------------------------------------

export async function listCustomerInvoices({
  customerId,
  companyId,
  search,
  status,
  from,
  to,
  sort,
  page = 1,
  limit = 10,
}) {
  const take = Math.min(Number(limit) || 10, 100);
  const currentPage = Number(page) || 1;

  const where = { customerId, companyId };
  if (status) where.status = status;
  if (search && search.trim()) where.invoiceNumber = { contains: search.trim() };
  if (from || to) {
    where.invoiceDate = {};
    if (from) where.invoiceDate.gte = new Date(from);
    if (to) where.invoiceDate.lte = new Date(to);
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip: (currentPage - 1) * take,
      take,
      orderBy: INVOICE_SORTS[sort] || INVOICE_SORTS.newest,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        status: true,
        currency: true,
        grandTotal: true,
        amountDue: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      currency: invoice.currency,
      total: toNumber(invoice.grandTotal),
      balance: toNumber(invoice.amountDue),
      itemCount: invoice._count?.items ?? 0,
    })),
    pagination: { total, page: currentPage, pageSize: take, totalPages: Math.ceil(total / take) || 1 },
  };
}

// ---------------------------------------------------------------------------
// Invoice details (3) — 404 unless the invoice belongs to the logged-in customer
// ---------------------------------------------------------------------------

export async function getCustomerInvoiceById({ customerId, companyId, id }) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, customerId, companyId },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      dueDate: true,
      status: true,
      currency: true,
      subtotal: true,
      discountTotal: true,
      taxTotal: true,
      grandTotal: true,
      amountPaid: true,
      amountDue: true,
      notes: true,
      termsAndConditions: true,
      company: { select: { name: true, address: true, city: true, country: true, gstNumber: true, currency: true } },
      customer: { select: { name: true, email: true, phoneNumber: true, taxNumber: true, companyName: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          itemType: true,
          description: true,
          quantity: true,
          unitPrice: true,
          taxRate: true,
          discount: true,
          lineTotal: true,
        },
      },
    },
  });

  // findFirst already scopes by customerId + companyId, so another customer's
  // invoice (or an unknown id) resolves to 404 here, never a cross-tenant read.
  if (!invoice) throw appError("Invoice not found.", 404);

  const base = mapMoney(invoice, INVOICE_MONEY_FIELDS);
  return {
    ...base,
    items: base.items.map((item) => mapMoney(item, INVOICE_ITEM_MONEY_FIELDS)),
  };
}

// ---------------------------------------------------------------------------
// Company catalogue: products (4) and services (5) — customer-safe fields only
// ---------------------------------------------------------------------------

const CATALOG_PROJECTION = {
  id: true,
  name: true,
  productCode: true,
  brand: true,
  description: true,
  status: true,
  salesPrice: true,
  sellingPriceTaxMode: true,
  taxRate: true,
  discountPercent: true,
  unit: true,
  category: true,
  createdAt: true,
  trackInventory: true,
  stockQuantity: true,
  unitRel: { select: { fullName: true, shortName: true } },
  categoryRel: { select: { name: true } },
};

function buildCatalogWhere({ companyId, type, search, category, availability }) {
  const where = { companyId, type, isDeleted: false };
  const and = [];

  if (search && search.trim()) {
    const term = search.trim();
    and.push({
      OR: type === "PRODUCT"
        ? [
            { name: { contains: term } },
            { productCode: { contains: term } },
            { brand: { contains: term } },
          ]
        : [
            { name: { contains: term } },
            { productCode: { contains: term } },
          ],
    });
  }

  if (category) {
    and.push({ OR: [{ categoryRel: { name: category } }, { category }] });
  }

  if (availability === "available") and.push({ status: "ACTIVE" });
  else if (availability === "notavailable") and.push({ status: "INACTIVE" });

  if (and.length) where.AND = and;
  return where;
}

/** Distinct category names for the company's rows of one type, for the filter dropdown. */
async function listCategoryNames({ companyId, type }) {
  const [legacyGroups, linkedGroups] = await Promise.all([
    prisma.item.groupBy({
      by: ["category"],
      where: { companyId, type, isDeleted: false, categoryId: null, category: { not: null } },
    }),
    prisma.item.groupBy({
      by: ["categoryId"],
      where: { companyId, type, isDeleted: false, categoryId: { not: null } },
    }),
  ]);
  const categoryIds = linkedGroups.map((row) => row.categoryId);
  const linkedCategories = categoryIds.length
    ? await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { name: true } })
    : [];
  const names = new Set();
  for (const name of [...legacyGroups.map((row) => row.category), ...linkedCategories.map((row) => row.name)]) {
    if (name && String(name).trim()) names.add(String(name).trim());
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Maps an Item row to customer-safe fields. `stockQuantity` is read here only to
 * derive a boolean In/Out-of-stock flag; the exact quantity is never returned,
 * and neither is any purchase-price / cost column.
 */
function formatCustomerProduct(item) {
  const taxed = item.sellingPriceTaxMode && item.sellingPriceTaxMode !== "NONE";
  const inStock = item.trackInventory ? toNumber(item.stockQuantity) > 0 : null;
  return {
    id: item.id,
    type: "PRODUCT",
    name: item.name,
    productCode: item.productCode ?? null,
    brand: item.brand ?? null,
    category: item.categoryRel?.name ?? item.category ?? null,
    unit: item.unitRel?.shortName || item.unitRel?.fullName || item.unit || null,
    description: item.description ?? null,
    sellingPrice: toNumber(item.salesPrice),
    sellingPriceTaxMode: item.sellingPriceTaxMode || "NONE",
    taxRate: taxed ? toNumber(item.taxRate) : null,
    discountPercent: item.discountPercent === null ? null : toNumber(item.discountPercent),
    availability: item.status === "ACTIVE" ? "Available" : "Not available",
    inStock,
    stockStatus: inStock === null ? null : inStock ? "In stock" : "Out of stock",
    createdAt: item.createdAt,
  };
}

function formatCustomerService(item) {
  const taxed = item.sellingPriceTaxMode && item.sellingPriceTaxMode !== "NONE";
  return {
    id: item.id,
    type: "SERVICE",
    name: item.name,
    serviceCode: item.productCode ?? null,
    category: item.categoryRel?.name ?? item.category ?? null,
    unit: item.unitRel?.shortName || item.unitRel?.fullName || item.unit || null,
    description: item.description ?? null,
    sellingPrice: toNumber(item.salesPrice),
    sellingPriceTaxMode: item.sellingPriceTaxMode || "NONE",
    taxRate: taxed ? toNumber(item.taxRate) : null,
    availability: item.status === "ACTIVE" ? "Available" : "Not available",
    createdAt: item.createdAt,
  };
}

async function listCatalog({ companyId, type, search, category, availability, sort, page = 1, limit = 10 }) {
  const take = Math.min(Number(limit) || 10, 100);
  const currentPage = Number(page) || 1;
  const where = buildCatalogWhere({ companyId, type, search, category, availability });

  const [items, total, categories] = await Promise.all([
    prisma.item.findMany({
      where,
      skip: (currentPage - 1) * take,
      take,
      orderBy: CATALOG_SORTS[sort] || CATALOG_SORTS.newest,
      select: CATALOG_PROJECTION,
    }),
    prisma.item.count({ where }),
    listCategoryNames({ companyId, type }),
  ]);

  return {
    items: items.map(type === "PRODUCT" ? formatCustomerProduct : formatCustomerService),
    categories,
    pagination: { total, page: currentPage, pageSize: take, totalPages: Math.ceil(total / take) || 1 },
  };
}

export function listCompanyProductsForCustomer(args) {
  return listCatalog({ ...args, type: "PRODUCT" });
}

export function listCompanyServicesForCustomer(args) {
  return listCatalog({ ...args, type: "SERVICE" });
}
