import prisma from "../prisma.js";
import {
  LOW_STOCK_THRESHOLD,
  PRODUCTS_DEFAULT_PAGE_SIZE,
  PRODUCTS_MAX_PAGE_SIZE,
} from "../config/products.js";
import { calculateProductProfitLoss } from "../utils/productProfitLoss.js";
import { mapMoney, toNumber } from "../utils/money.js";
import { productStatusSchema } from "../validators/productSchemas.js";

/**
 * Product service.
 *
 * Products and Services share the `Item` model, but only rows with
 * `type = "PRODUCT"` are handled here. Every read and write is scoped by
 * `companyId` (taken from the auth token by the controller, never from the
 * request body) and by `isDeleted: false`.
 *
 * The product endpoints deliberately ignore the legacy free-text columns
 * (`sku`, `unit`, `category`, `hsnCode`, `sacCode`, `openingStock`, ...) that
 * Services still use. They are left exactly as they are in the schema and are
 * never read or written by this file.
 */

function appError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function resolveProductStatus(quantity, requestedStatus, currentStatus, statusProvided) {
  if (toNumber(quantity) <= 0) {
    if (statusProvided && requestedStatus === "ACTIVE") {
      throw appError("Quantity is 0. Add stock before marking Available", 400);
    }
    return "INACTIVE";
  }

  return statusProvided ? requestedStatus : currentStatus;
}

/** Money returned by an API is always a number rounded to 2 decimals. */
function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

/** Every product query is a non-deleted PRODUCT row of this company. */
const PRODUCT_SCOPE = { type: "PRODUCT", isDeleted: false };

const PRODUCT_INCLUDE = {
  unitRel: { select: { id: true, fullName: true, shortName: true } },
  categoryRel: { select: { id: true, name: true } },
  linkedVendor: { select: { id: true, name: true } },
};

/** Money columns serialised as numbers instead of Prisma Decimals. */
const PRODUCT_MONEY_FIELDS = [
  "salesPrice",
  "purchasePrice",
  "taxRate",
  "discountPercent",
  "stockQuantity",
  "openingStock",
  "reorderLevel",
  "discountValue",
];

/**
 * Shapes a product row for the API.
 *
 * The new contract is exposed next to the raw row: `sellingPrice` and `quantity`
 * are the request/response names of the `salesPrice` and `stockQuantity` columns,
 * and every Decimal is converted to a number so clients never see a stringified
 * amount.
 *
 * `unitRef` / `categoryRef` carry the linked Unit and Category records
 * (`{ id, name }`). They deliberately use new key names instead of replacing
 * `unit` / `category`, because those two keys still hold the legacy free-text
 * column values and the existing frontend reads them as strings — the invoice
 * product picker renders `{item.unit}`, and the catalogue table renders
 * `{row.category}`. Replacing them would break those pages, so the relations
 * are added alongside instead of overwriting them. `unitText` / `categoryText`
 * are aliases for the same legacy strings, kept for symmetry.
 */
function formatProduct(item) {
  const { unitRel, categoryRel, ...rest } = item;
  const quantity = toNumber(rest.stockQuantity);
  const taxed = isTaxed(item);

  return {
    ...mapMoney(rest, PRODUCT_MONEY_FIELDS),
    // --- new product contract -------------------------------------------
    sellingPrice: toNumber(rest.salesPrice),
    sellingPriceTaxMode: rest.sellingPriceTaxMode || "NONE",
    purchasePriceTaxMode: rest.purchasePriceTaxMode || null,
    // The `taxRate` column is NOT NULL DEFAULT 0.00, so a product with no tax
    // mode on either side stores 0. The API reports that as null, which is what
    // the profit/loss maths reads it as anyway.
    taxRate: taxed ? toNumber(rest.taxRate) : null,
    discountPercent: rest.discountPercent === null ? null : toNumber(rest.discountPercent),
    quantity,
    // --- relations (added, not replacing the legacy text columns) --------
    unitRef: unitRel ? { id: unitRel.id, name: unitRel.fullName, shortName: unitRel.shortName } : null,
    categoryRef: categoryRel ? { id: categoryRel.id, name: categoryRel.name } : null,
    unitText: rest.unit ?? null,
    categoryText: rest.category ?? null,
    // --- derived stock flags ---------------------------------------------
    isLowStock: quantity > 0 && quantity <= LOW_STOCK_THRESHOLD,
    isOutOfStock: quantity <= 0,
  };
}

/** True when either price side is taxed, i.e. taxRate actually means something. */
function isTaxed(item) {
  const selling = item?.sellingPriceTaxMode;
  const purchase = item?.purchasePriceTaxMode;
  return (selling && selling !== "NONE") || (purchase && purchase !== "NONE");
}

/** Company- and type-scoped read of a single product. 404 when not theirs. */
async function getProductRow(companyId, productId) {
  const item = await prisma.item.findFirst({
    where: { id: productId, companyId, ...PRODUCT_SCOPE },
    include: PRODUCT_INCLUDE,
  });
  if (!item) throw appError("Product not found.", 404);
  return item;
}

/**
 * A unit or category is usable when it is a built-in (shared, companyId null)
 * row or one owned by this company — the same visibility rule the Unit &
 * Category pages use for their pickers.
 */
async function assertUnitAndCategory(companyId, unitId, categoryId) {
  const [unit, category] = await Promise.all([
    prisma.unit.findFirst({
      where: { id: unitId },
      select: { id: true },
    }),
    prisma.category.findFirst({
      where: { id: categoryId },
      select: { id: true },
    }),
  ]);

  if (!unit) {
    throw appError("Selected unit does not exist.", 400);
  }
  if (!category) {
    throw appError("Selected category does not exist.", 400);
  }
}

/**
 * The duplicate rule: inside one company, the same product code may be reused
 * only when the selling price differs. `productCode` uses the table's
 * utf8mb4_unicode_ci collation, so the match is already case-insensitive.
 */
async function findProductCodeConflict(companyId, productCode, sellingPrice, excludeProductId) {
  return prisma.item.findFirst({
    where: {
      companyId,
      ...PRODUCT_SCOPE,
      ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      productCode: { equals: productCode },
      salesPrice: { equals: Number(sellingPrice) },
    },
    select: { id: true, name: true, productCode: true, salesPrice: true },
  });
}

/**
 * Shared business rules for create and update. `merged` is the resulting
 * product state (existing values overlaid with the payload), so an update that
 * only touches one field is still validated as a whole.
 *
 * `taxRateProvided` says whether THIS request carried a tax rate, and
 * `previouslyTaxed` whether the product already had a taxed side before the
 * update. Together they tell "the client switched tax on but sent no rate"
 * (rejected) from "the product was already taxed, keep its rate" (allowed) —
 * the `taxRate` column is NOT NULL DEFAULT 0, so a stored 0 cannot be told
 * apart from "never set" on its own.
 */
function assertProductRules(merged, { taxRateProvided = false, previouslyTaxed = false } = {}) {
  const sellingTaxed = merged.sellingPriceTaxMode && merged.sellingPriceTaxMode !== "NONE";
  const purchaseTaxed = merged.purchasePriceTaxMode && merged.purchasePriceTaxMode !== "NONE";
  const taxed = Boolean(sellingTaxed || purchaseTaxed);

  if (merged.purchasePrice !== null && merged.purchasePrice !== undefined && !merged.purchasePriceTaxMode) {
    throw appError(
      "Purchase price tax mode is required when a purchase price is provided.",
      400
    );
  }

  if (taxed && !taxRateProvided && !previouslyTaxed) {
    throw appError(
      "Tax rate is required when the selling or purchase price tax mode is INCLUSIVE or EXCLUSIVE.",
      400
    );
  }

  // The `taxRate` column is NOT NULL DEFAULT 0.00, so an untaxed product stores
  // 0 rather than null. The profit/loss maths reads 0 and null identically, and
  // the API reports 0 as null for a product with no taxed side.
  return taxed ? Number(merged.taxRate) || 0 : 0;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

const SORT_OPTIONS = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  az: { name: "asc" },
  za: { name: "desc" },
  priceHigh: { salesPrice: "desc" },
  priceLow: { salesPrice: "asc" },
};

// Legacy sortBy + sortOrder pairs the catalogue pages still send, mapped onto
// the new sort vocabulary so the existing UI keeps working.
const LEGACY_SORT_OPTIONS = {
  "createdAt:desc": "newest",
  "createdAt:asc": "oldest",
  "name:asc": "az",
  "name:desc": "za",
  "salesPrice:desc": "priceHigh",
  "salesPrice:asc": "priceLow",
};

/** Legacy stock filter names, mapped onto the new buckets. */
const LEGACY_STOCK_OPTIONS = {
  IN_STOCK: "instock",
  LOW_STOCK: "lowstock",
  OUT_OF_STOCK: "outofstock",
};

/**
 * Normalises a product list query: accepts the new vocabulary plus the values
 * the existing catalogue pages still send (`ACTIVE`/`INACTIVE`, `stockLevel`,
 * `sortBy`+`sortOrder`) and reduces them to `{ status, stock, sort }`.
 */
function normaliseListFilters({ status, stock, stockLevel, sort, sortBy, sortOrder } = {}) {
  let normalisedStatus;
  if (status === "available" || status === "ACTIVE") normalisedStatus = "ACTIVE";
  else if (status === "notavailable" || status === "INACTIVE") normalisedStatus = "INACTIVE";

  const stockValue = stock || stockLevel;
  const normalisedStock = LEGACY_STOCK_OPTIONS[stockValue] || stockValue;

  const legacySort =
    sortBy && sortOrder ? `${String(sortBy).trim()}:${String(sortOrder).trim()}` : null;
  const normalisedSort = sort || (legacySort && LEGACY_SORT_OPTIONS[legacySort]) || "newest";

  return { status: normalisedStatus, stock: normalisedStock, sort: normalisedSort };
}

export async function listProducts({
  companyId,
  search,
  status,
  stock,
  stockLevel,
  sort,
  sortBy,
  sortOrder,
  page = 1,
  pageSize = PRODUCTS_DEFAULT_PAGE_SIZE,
}) {
  const filters = normaliseListFilters({ status, stock, stockLevel, sort, sortBy, sortOrder });

  const where = { companyId, ...PRODUCT_SCOPE };

  if (filters.status === "ACTIVE") where.status = "ACTIVE";
  else if (filters.status === "INACTIVE") where.status = "INACTIVE";

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term } },
      { productCode: { contains: term } },
      { brand: { contains: term } },
    ];
  }

  // Stock buckets, all driven by the single LOW_STOCK_THRESHOLD constant.
  if (filters.stock === "outofstock") where.stockQuantity = { lte: 0 };
  else if (filters.stock === "lowstock") where.stockQuantity = { gt: 0, lte: LOW_STOCK_THRESHOLD };
  else if (filters.stock === "instock") where.stockQuantity = { gt: LOW_STOCK_THRESHOLD };

  const orderBy = SORT_OPTIONS[filters.sort] || SORT_OPTIONS.newest;
  const take = Math.min(Number(pageSize) || PRODUCTS_DEFAULT_PAGE_SIZE, PRODUCTS_MAX_PAGE_SIZE);
  const currentPage = Number(page) || 1;

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      skip: (currentPage - 1) * take,
      take,
      orderBy,
      include: PRODUCT_INCLUDE,
    }),
    prisma.item.count({ where }),
  ]);

  return {
    items: items.map(formatProduct),
    pagination: {
      total,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createProduct({ companyId, userId, payload }) {
  const {
    name,
    productCode,
    unitId,
    categoryId,
    sellingPrice,
    sellingPriceTaxMode = "NONE",
    purchasePrice,
    purchasePriceTaxMode,
    taxRate,
    quantity = 0,
    discountPercent,
    hsnSacCode,
    brand,
    description,
    status = "ACTIVE",
  } = payload;
  const effectiveStatus = resolveProductStatus(quantity, status, status, payload.status !== undefined);

  await assertUnitAndCategory(companyId, unitId, categoryId);

  const merged = {
    sellingPriceTaxMode,
    purchasePrice,
    purchasePriceTaxMode,
    taxRate,
  };
  const effectiveTaxRate = assertProductRules(merged, {
    taxRateProvided: payload.taxRate !== undefined,
  });

  const conflict = await findProductCodeConflict(companyId, productCode, sellingPrice, null);
  if (conflict) {
    throw appError(
      `A product with code "${conflict.productCode}" and the same selling price already exists (${conflict.name}).`,
      409
    );
  }

  const item = await prisma.item.create({
    data: {
      companyId,
      type: "PRODUCT",
      createdByUserId: userId,
      name,
      productCode,
      unitId,
      categoryId,
      salesPrice: sellingPrice,
      sellingPriceTaxMode,
      purchasePrice: purchasePrice === undefined ? null : purchasePrice,
      purchasePriceTaxMode:
        purchasePrice === undefined || purchasePrice === null ? null : purchasePriceTaxMode,
      taxRate: effectiveTaxRate,
      stockQuantity: quantity,
      discountPercent: discountPercent === undefined ? null : discountPercent,
      hsnSacCode: hsnSacCode ?? null,
      brand: brand ?? null,
      description: description ?? null,
      status: effectiveStatus,
      trackInventory: true,
    },
    include: PRODUCT_INCLUDE,
  });

  return formatProduct(item);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateProduct({ companyId, productId, payload }) {
  const existing = await getProductRow(companyId, productId);
  const resultingQuantity = payload.quantity !== undefined
    ? payload.quantity
    : existing.stockQuantity;
  const effectiveStatus = resolveProductStatus(
    resultingQuantity,
    payload.status,
    existing.status,
    payload.status !== undefined
  );

  // Effective state after this payload, used for the shared rule checks.
  const merged = {
    sellingPriceTaxMode:
      payload.sellingPriceTaxMode !== undefined
        ? payload.sellingPriceTaxMode
        : existing.sellingPriceTaxMode,
    purchasePrice:
      payload.purchasePrice !== undefined ? payload.purchasePrice : existing.purchasePrice,
    purchasePriceTaxMode:
      payload.purchasePriceTaxMode !== undefined
        ? payload.purchasePriceTaxMode
        : existing.purchasePriceTaxMode,
    taxRate: payload.taxRate !== undefined ? payload.taxRate : existing.taxRate,
  };
  const effectiveTaxRate = assertProductRules(merged, {
    taxRateProvided: payload.taxRate !== undefined,
    previouslyTaxed: isTaxed(existing),
  });

  if (payload.unitId || payload.categoryId) {
    await assertUnitAndCategory(
      companyId,
      payload.unitId ?? existing.unitId,
      payload.categoryId ?? existing.categoryId
    );
  }

  // Only the fields actually sent are written; nothing is reset implicitly.
  const data = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.productCode !== undefined) data.productCode = payload.productCode;
  if (payload.unitId !== undefined) data.unitId = payload.unitId;
  if (payload.categoryId !== undefined) data.categoryId = payload.categoryId;
  if (payload.sellingPrice !== undefined) data.salesPrice = payload.sellingPrice;
  if (payload.sellingPriceTaxMode !== undefined) data.sellingPriceTaxMode = payload.sellingPriceTaxMode;
  if (payload.purchasePrice !== undefined) data.purchasePrice = payload.purchasePrice;
  if (payload.purchasePriceTaxMode !== undefined) {
    data.purchasePriceTaxMode =
      payload.purchasePrice === null ? null : payload.purchasePriceTaxMode;
  } else if (payload.purchasePrice === null) {
    // Clearing the cost price also clears its tax mode: the mode is only
    // meaningful next to a price, and leaving it behind would keep the product
    // looking "taxed on the purchase side" with no price to tax.
    data.purchasePriceTaxMode = null;
  }
  // taxRate is always written from the validated merged state: an untaxed
  // product stores 0 (the column is NOT NULL) instead of the requested null.
  data.taxRate = effectiveTaxRate;
  if (payload.quantity !== undefined) data.stockQuantity = payload.quantity;
  if (payload.discountPercent !== undefined) data.discountPercent = payload.discountPercent;
  if (payload.hsnSacCode !== undefined) data.hsnSacCode = payload.hsnSacCode;
  if (payload.brand !== undefined) data.brand = payload.brand;
  if (payload.description !== undefined) data.description = payload.description;
  data.status = effectiveStatus;

  const codeToCheck = payload.productCode ?? existing.productCode;
  const priceToCheck = payload.sellingPrice ?? toNumber(existing.salesPrice);
  const conflict = await findProductCodeConflict(companyId, codeToCheck, priceToCheck, productId);
  if (conflict) {
    throw appError(
      `A product with code "${conflict.productCode}" and the same selling price already exists (${conflict.name}).`,
      409
    );
  }

  const item = await prisma.item.update({
    where: { id: productId },
    data,
    include: PRODUCT_INCLUDE,
  });

  return formatProduct(item);
}

// ---------------------------------------------------------------------------
// Status toggle
// ---------------------------------------------------------------------------

export async function setProductStatus({ companyId, productId, status }) {
  const existing = await getProductRow(companyId, productId);

  // Same ACTIVE / INACTIVE contract as the Services toggle, parsed through the
  // product schema so a bad value is a clear 400 rather than a driver error.
  const parsed = productStatusSchema.safeParse({ status });
  if (!parsed.success) {
    throw appError("Status must be ACTIVE or INACTIVE.", 400);
  }
  const nextStatus = parsed.data.status;

  const effectiveStatus = resolveProductStatus(
    existing.stockQuantity,
    nextStatus,
    existing.status,
    true
  );

  const item = await prisma.item.update({
    where: { id: productId },
    data: { status: effectiveStatus },
    include: PRODUCT_INCLUDE,
  });

  return formatProduct(item);
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

export async function getProductDetails({ companyId, productId }) {
  const item = await getProductRow(companyId, productId);
  return {
    ...formatProduct(item),
    profitLoss: calculateProductProfitLoss(item),
  };
}

// ---------------------------------------------------------------------------
// Delete — soft delete of exactly one product of this company
// ---------------------------------------------------------------------------

export async function deleteProduct({ companyId, productId }) {
  await getProductRow(companyId, productId);

  await prisma.item.update({
    where: { id: productId },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  return { id: productId };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * Company-wide product totals. Deliberately ignores every list filter.
 *
 * One read-only, company-scoped aggregate: the products-with-cost total skips
 * rows whose purchasePrice is NULL. `${companyId}` and the threshold are bound
 * as query parameters by Prisma; `type` and `isDeleted` are fixed literals.
 */
export async function getProductSummary({ companyId }) {
  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(*) AS totalProducts,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS availableProducts,
      SUM(CASE WHEN stockQuantity > 0 AND stockQuantity <= ${LOW_STOCK_THRESHOLD} THEN 1 ELSE 0 END) AS lowStockProducts,
      COALESCE(SUM(salesPrice * stockQuantity), 0) AS totalSellingPrice,
      COALESCE(SUM(CASE WHEN purchasePrice IS NOT NULL THEN purchasePrice * stockQuantity ELSE 0 END), 0) AS totalCost
    FROM items
    WHERE companyId = ${companyId}
      AND type = 'PRODUCT'
      AND isDeleted = 0
  `;

  const row = rows[0] || {};

  return {
    totalProducts: Number(row.totalProducts ?? 0),
    availableProducts: Number(row.availableProducts ?? 0),
    lowStockProducts: Number(row.lowStockProducts ?? 0),
    totalSellingPrice: round2(row.totalSellingPrice ?? 0),
    totalCost: round2(row.totalCost ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Stock helpers
//
// NOT wired into any endpoint yet. The invoice/bill flow will call these when
// it learns to reserve stock; until then they are exported for that future
// use and are intentionally not called from anywhere in the application.
// ---------------------------------------------------------------------------

/**
 * Atomically decreases a product's stock.
 *
 * `productId, qty, tx` is the documented call shape; `tx` is an optional Prisma
 * transaction client so the decrement can join a larger transaction. Pass the
 * caller's `companyId` as the fourth argument to keep the decrement scoped to
 * that company.
 *
 * The WHERE guard (`stockQuantity >= qty`) plus Prisma's `decrement` make the
 * update a single atomic statement, so two concurrent calls can never drive the
 * quantity below zero — the second one simply matches no row and is rejected.
 *
 * When the product runs out of stock its status is set to INACTIVE
 * ("Not available") in the same transaction.
 *
 * NOT wired into any endpoint: the invoice/bill flow will call this when it
 * learns to reserve stock.
 */
export async function decreaseProductStock(productId, qty, tx, companyId) {
  const client = tx || prisma;
  const amount = Number(qty);

  // `stockQuantity` is DECIMAL(12,2), so any positive finite amount is valid;
  // zero, negative, NaN and non-numeric input are not.
  if (!Number.isFinite(amount) || amount <= 0) {
    throw appError("Quantity to remove must be a number greater than 0.", 400);
  }

  const scope = {
    id: productId,
    ...PRODUCT_SCOPE,
    ...(companyId ? { companyId } : {}),
  };

  const updated = await client.item.updateMany({
    where: { ...scope, stockQuantity: { gte: amount } },
    data: { stockQuantity: { decrement: amount } },
  });

  if (updated.count === 0) {
    const row = await client.item.findFirst({
      where: scope,
      select: { id: true, stockQuantity: true },
    });
    if (!row) throw appError("Product not found.", 404);
    throw appError(
      `Insufficient stock: only ${toNumber(row.stockQuantity)} left for this product.`,
      400
    );
  }

  // Out of stock can no longer be offered for sale. Guarded on the quantity so
  // two concurrent decrements cannot resurrect the product, and it is a no-op
  // when the status is already INACTIVE.
  await client.item.updateMany({
    where: { ...scope, stockQuantity: { lte: 0 }, status: "ACTIVE" },
    data: { status: "INACTIVE" },
  });

  return client.item.findFirst({
    where: scope,
    select: { id: true, name: true, stockQuantity: true, status: true },
  });
}

/**
 * Atomically increases a product's stock.
 *
 * Same shape as `decreaseProductStock`. It deliberately does NOT reactivate the
 * product: restocking is an inventory event, and whether an item is offered for
 * sale stays a manual decision on the status endpoint.
 *
 * NOT wired into any endpoint: reserved for the future invoice/bill flow.
 */
export async function increaseProductStock(productId, qty, tx, companyId) {
  const client = tx || prisma;
  const amount = Number(qty);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw appError("Quantity to add must be a number greater than 0.", 400);
  }

  const scope = {
    id: productId,
    ...PRODUCT_SCOPE,
    ...(companyId ? { companyId } : {}),
  };

  const updated = await client.item.updateMany({
    where: scope,
    data: { stockQuantity: { increment: amount } },
  });

  if (updated.count === 0) {
    throw appError("Product not found.", 404);
  }

  return client.item.findFirst({
    where: scope,
    select: { id: true, name: true, stockQuantity: true, status: true },
  });
}
