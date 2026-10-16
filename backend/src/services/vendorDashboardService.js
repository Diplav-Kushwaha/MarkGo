import prisma from "../prisma.js";
import { toNumber, mapMoney, BILL_MONEY_FIELDS, BILL_ITEM_MONEY_FIELDS } from "../utils/money.js";

/**
 * Vendor dashboard service — strictly READ-ONLY.
 *
 * Every function below only READS data (Prisma findMany / findFirst / count).
 * Identity and company are passed in by the controller, which takes them from
 * the verified token (`req.vendor`, set by `authenticateVendorToken`), never
 * from the request. No function here creates, updates or deletes anything.
 *
 * Nothing another vendor owns is ever reachable: bills are always scoped to the
 * caller's own vendorId + companyId, and the catalogue endpoints only ever
 * return vendor-safe fields — no purchase/cost price, no selling price, no
 * margin, and no exact stock quantity.
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

/** Money fields a vendor may see: their own bill totals and line amounts. */
const VENDOR_BILL_FIELDS = ["total", "amountPaid", "amountDue"];

// ---------------------------------------------------------------------------
// Profile (6)
// ---------------------------------------------------------------------------

/**
 * The logged-in vendor's own record, with their company's stored details.
 * Internal fields (password hash, login attempts, lock, notes) and the
 * company-side balances (credit limit, opening/outstanding/total amounts) are
 * deliberately NOT returned — the vendor sees their bills on the Bills page,
 * not pre-aggregated balances.
 */
export async function getVendorProfile({ vendorId }) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      companyName: true,
      contactPerson: true,
      vendorType: true,
      category: true,
      email: true,
      phoneNumber: true,
      alternatePhone: true,
      taxNumber: true,
      panNumber: true,
      currency: true,
      status: true,
      createdAt: true,
      company: { select: { name: true, address: true, city: true, state: true, country: true, gstNumber: true, currency: true } },
      addresses: {
        select: { id: true, type: true, line1: true, line2: true, city: true, state: true, country: true, postalCode: true },
        orderBy: { type: "asc" },
      },
    },
  });

  if (!vendor) throw appError("Vendor not found.", 404);
  return vendor;
}

// ---------------------------------------------------------------------------
// Sold products & services (1) — derived from the vendor's own bill line items
// ---------------------------------------------------------------------------

/**
 * Groups the vendor's own bill line items into one row per thing supplied.
 *
 * The row's code / name / unit / type come from the linked `Item` when the line
 * carries an `itemId`; otherwise the line's own stored `description` is used,
 * because bill items are allowed to exist without a catalogue link. A bill item
 * has no `itemType` column of its own, so `type` is the linked item's type when
 * present and null otherwise (the UI shows it as "—").
 */
export async function listVendorSoldProducts({
  vendorId,
  companyId,
  search,
  type,
  sort,
  page = 1,
  limit = 10,
}) {
  const lines = await prisma.billItem.findMany({
    where: { bill: { vendorId, companyId } },
    orderBy: { bill: { billDate: "asc" } },
    select: {
      id: true,
      itemId: true,
      description: true,
      quantity: true,
      unitPrice: true,
      bill: { select: { id: true, billNumber: true, billDate: true } },
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
    const billDate = line.bill?.billDate || null;

    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        key,
        itemId: line.itemId || null,
        type: line.item?.type || null,
        name: line.item?.name || line.description,
        productCode: line.item?.productCode || null,
        unit: line.item?.unitRel?.shortName || line.item?.unitRel?.fullName || line.item?.unit || null,
        totalQuantity: 0,
        totalValue: 0,
        billIds: new Set(),
        lastSupplyDate: billDate,
        lastUnitPrice: unitPrice,
        lastBillNumber: line.bill?.billNumber || null,
        firstSupplyDate: billDate,
      };
      grouped.set(key, entry);
    }

    entry.totalQuantity += quantity;
    entry.totalValue += quantity * unitPrice;
    if (line.bill?.id) entry.billIds.add(line.bill.id);

    if (billDate) {
      if (!entry.firstSupplyDate || new Date(billDate) < new Date(entry.firstSupplyDate)) {
        entry.firstSupplyDate = billDate;
      }
      if (!entry.lastSupplyDate || new Date(billDate) >= new Date(entry.lastSupplyDate)) {
        entry.lastSupplyDate = billDate;
        entry.lastUnitPrice = unitPrice;
        entry.lastBillNumber = line.bill?.billNumber || null;
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
    billCount: entry.billIds.size,
    firstSupplyDate: entry.firstSupplyDate,
    lastSupplyDate: entry.lastSupplyDate,
    lastBillNumber: entry.lastBillNumber,
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

  // Tolerant type filter: "product" / "service" match the linked item's type;
  // rows without a linked item (null type) only show under "all".
  if (type === "product") rows = rows.filter((row) => row.type === "PRODUCT");
  else if (type === "service") rows = rows.filter((row) => row.type === "SERVICE");

  const SORTS = {
    recent: (a, b) => new Date(b.lastSupplyDate || 0) - new Date(a.lastSupplyDate || 0),
    az: (a, b) => String(a.name || "").localeCompare(String(b.name || "")),
    quantity: (a, b) => b.totalQuantity - a.totalQuantity,
  };
  rows.sort(SORTS[sort] || SORTS.recent);

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
// Bills (2) — only the vendor's own bills
// ---------------------------------------------------------------------------

const BILL_SORTS = {
  newest: { billDate: "desc" },
  oldest: { billDate: "asc" },
  amountHigh: { total: "desc" },
  amountLow: { total: "asc" },
};

export async function listVendorBills({
  vendorId,
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

  const where = { vendorId, companyId };
  if (status) where.status = status;
  if (search && search.trim()) where.billNumber = { contains: search.trim() };
  if (from || to) {
    where.billDate = {};
    if (from) where.billDate.gte = new Date(from);
    if (to) where.billDate.lte = new Date(to);
  }

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      skip: (currentPage - 1) * take,
      take,
      orderBy: BILL_SORTS[sort] || BILL_SORTS.newest,
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        dueDate: true,
        status: true,
        currency: true,
        total: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.bill.count({ where }),
  ]);

  return {
    bills: bills.map((bill) => ({
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      dueDate: bill.dueDate,
      status: bill.status,
      currency: bill.currency,
      total: toNumber(bill.total),
      itemCount: bill._count?.items ?? 0,
    })),
    pagination: { total, page: currentPage, pageSize: take, totalPages: Math.ceil(total / take) || 1 },
  };
}

// ---------------------------------------------------------------------------
// Bill details (3) — 404 unless the bill belongs to the logged-in vendor
// ---------------------------------------------------------------------------

export async function getVendorBillById({ vendorId, companyId, id }) {
  const bill = await prisma.bill.findFirst({
    where: { id, vendorId, companyId },
    select: {
      id: true,
      billNumber: true,
      billDate: true,
      dueDate: true,
      category: true,
      status: true,
      currency: true,
      total: true,
      amountPaid: true,
      amountDue: true,
      company: { select: { name: true, address: true, city: true, state: true, country: true, gstNumber: true, currency: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
        },
      },
    },
  });

  // findFirst already scopes by vendorId + companyId, so another vendor's bill
  // (or an unknown id) resolves to 404 here, never a cross-tenant read.
  if (!bill) throw appError("Bill not found.", 404);

  const base = mapMoney(bill, VENDOR_BILL_FIELDS);
  // The Bill model stores only the three money fields above: there are no
  // per-line or per-bill tax/discount columns today, so none are returned.
  return {
    ...base,
    items: base.items.map((item) => mapMoney(item, BILL_ITEM_MONEY_FIELDS)),
  };
}

// ---------------------------------------------------------------------------
// Company catalogue: products (4) and services (5) — vendor-safe fields only
// ---------------------------------------------------------------------------

/**
 * Vendor-safe projection. Deliberately excludes every money column
 * (salesPrice, purchasePrice), inventory (stockQuantity, reorderLevel,
 * openingStock) and audit fields, so a vendor sees what the company sells,
 * not what it costs, what it charges or how much is on the shelf.
 */
const CATALOG_PROJECTION = {
  id: true,
  name: true,
  productCode: true,
  brand: true,
  description: true,
  status: true,
  unit: true,
  category: true,
  createdAt: true,
  unitRel: { select: { fullName: true, shortName: true } },
  categoryRel: { select: { name: true } },
};

const CATALOG_SORTS = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  az: { name: "asc" },
  za: { name: "desc" },
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

/** Maps an Item row to vendor-safe fields. */
function formatVendorCatalogItem(item, type) {
  return {
    id: item.id,
    type,
    name: item.name,
    productCode: item.productCode ?? null,
    serviceCode: type === "SERVICE" ? item.productCode ?? null : undefined,
    brand: item.brand ?? null,
    category: item.categoryRel?.name ?? item.category ?? null,
    unit: item.unitRel?.shortName || item.unitRel?.fullName || item.unit || null,
    description: item.description ?? null,
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
    items: items.map((item) => formatVendorCatalogItem(item, type)),
    categories,
    pagination: { total, page: currentPage, pageSize: take, totalPages: Math.ceil(total / take) || 1 },
  };
}

export function listVendorProducts(args) {
  return listCatalog({ ...args, type: "PRODUCT" });
}

export function listVendorServices(args) {
  return listCatalog({ ...args, type: "SERVICE" });
}
