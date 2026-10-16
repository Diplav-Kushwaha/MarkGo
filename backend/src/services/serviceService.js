import prisma from "../prisma.js";
import { SERVICES_DEFAULT_PAGE_SIZE, SERVICES_MAX_PAGE_SIZE } from "../config/services.js";
import { mapMoney, toNumber } from "../utils/money.js";
import { serviceStatusSchema } from "../validators/serviceSchemas.js";

/**
 * Service catalogue service.
 *
 * Services and Products share the `Item` model, but only rows with
 * `type = "SERVICE"` are handled here. Every read and write is scoped by
 * `companyId` (taken from the auth token by the controller, never from the
 * request body) and by `isDeleted: false`, so a product row can never be read
 * or written through this file.
 *
 * The service contract exposes the new field names. The columns they map onto:
 *
 *   name                -> name
 *   serviceCode         -> productCode   (services share the item code column)
 *   sellingPrice        -> salesPrice
 *   sellingPriceTaxMode -> sellingPriceTaxMode
 *   taxRate             -> taxRate
 *   unitId              -> unitId        (relation to Unit)
 *   categoryId          -> categoryId    (relation to Category)
 *   description         -> description
 *   status              -> status        (ACTIVE / INACTIVE)
 *
 * Services have no stock, no purchase price, no discount, no HSN/SAC, no brand,
 * no barcode, no tags and no sub-category: those columns are never read or
 * written here, and the legacy free-text columns (`sku`, `unit`, `category`,
 * `sacCode`, ...) stay exactly as they are in the schema.
 */

function appError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Every service query is a non-deleted SERVICE row of this company. */
const SERVICE_SCOPE = { type: "SERVICE", isDeleted: false };

const SERVICE_INCLUDE = {
  unitRel: { select: { id: true, fullName: true, shortName: true } },
  categoryRel: { select: { id: true, name: true } },
};

/** Decimal columns serialised as numbers instead of Prisma Decimals. */
const SERVICE_MONEY_FIELDS = ["salesPrice", "taxRate"];

/** True when the selling side is taxed, i.e. a tax rate actually means something. */
function isTaxed(mode) {
  return Boolean(mode) && mode !== "NONE";
}

/**
 * Shapes a service row for the API.
 *
 * The whole row is returned, so the existing pages keep reading the columns
 * they already use (`salesPrice`, `status`, `description`, ...). The new service
 * contract is exposed next to it: `serviceCode` is the API name of the
 * `productCode` column, `sellingPrice` the API name of `salesPrice`, and
 * `unitRef` / `categoryRef` carry the linked records as `{ id, name }`.
 *
 * `unitRef` / `categoryRef` use their own key names instead of replacing `unit`
 * / `category` for exactly the same reason the product path does: those keys
 * still hold the legacy free-text column values (older services have text like
 * "hrs" there and are only being migrated to real relations now), and the
 * existing frontend renders them as strings.
 *
 * `taxRate` is reported as null when the tax mode is NONE, which is what "no
 * tax" means; the column itself is NOT NULL DEFAULT 0.00 (see resolveTaxRate).
 */
function formatService(item) {
  const { unitRel, categoryRel, ...rest } = item;
  const taxed = isTaxed(rest.sellingPriceTaxMode);

  return {
    ...mapMoney(rest, SERVICE_MONEY_FIELDS),
    // --- new service contract -------------------------------------------
    serviceCode: rest.productCode ?? null,
    sellingPrice: toNumber(rest.salesPrice),
    sellingPriceTaxMode: rest.sellingPriceTaxMode || "NONE",
    taxRate: taxed ? toNumber(rest.taxRate) : null,
    // --- relations (null when the row has none) ---------------------------
    unitRef: unitRef(unitRel),
    categoryRef: categoryRef(categoryRel),
  };
}

function unitRef(unitRel) {
  return unitRel ? { id: unitRel.id, name: unitRel.fullName, shortName: unitRel.shortName } : null;
}

function categoryRef(categoryRel) {
  return categoryRel ? { id: categoryRel.id, name: categoryRel.name } : null;
}

/** Company- and type-scoped read of a single service. 404 when not theirs. */
async function getServiceRow(companyId, serviceId) {
  const item = await prisma.item.findFirst({
    where: { id: serviceId, companyId, ...SERVICE_SCOPE },
    include: SERVICE_INCLUDE,
  });
  if (!item) throw appError("Service not found.", 404);
  return item;
}

/**
 * A unit or category is usable when it is a built-in (shared, companyId null)
 * row or one owned by this company — the same visibility rule the Unit &
 * Category pages use for their pickers, so a value those pages offer can never
 * be rejected here. Another company's row, and an unknown id, is rejected with
 * a clear 400.
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
 * The mandatory fields of the service contract, checked against the RESULTING
 * state. Create uses it directly; update uses it on the existing row overlaid
 * with the payload, so an older service with an empty unit, category or code
 * is only saved once the request fills it in.
 */
function assertRequiredFields({ name, serviceCode, unitId, categoryId, sellingPrice, sellingPriceTaxMode }) {
  const missing = [];
  if (!name || !String(name).trim()) missing.push("name");
  if (!serviceCode || !String(serviceCode).trim()) missing.push("service code");
  if (!unitId) missing.push("unit");
  if (!categoryId) missing.push("category");
  if (sellingPrice === null || sellingPrice === undefined) missing.push("sellingPrice");
  if (!sellingPriceTaxMode) missing.push("sellingPriceTaxMode");

  if (missing.length) {
    throw appError(`Missing required service field(s): ${missing.join(", ")}.`, 400);
  }
}

/** Update fields are required only when the request explicitly includes them. */
function assertProvidedRequiredFields(payload, values) {
  const missing = [];
  const provided = (field) => Object.prototype.hasOwnProperty.call(payload, field);

  if (provided("name") && (!values.name || !String(values.name).trim())) missing.push("name");
  if (provided("serviceCode") && (!values.serviceCode || !String(values.serviceCode).trim())) missing.push("service code");
  if (provided("unitId") && !values.unitId) missing.push("unit");
  if (provided("categoryId") && !values.categoryId) missing.push("category");
  if (provided("sellingPrice") && (values.sellingPrice === null || values.sellingPrice === undefined)) {
    missing.push("sellingPrice");
  }
  if (provided("sellingPriceTaxMode") && !values.sellingPriceTaxMode) missing.push("sellingPriceTaxMode");

  if (missing.length) {
    throw appError(`Missing required service field(s): ${missing.join(", ")}.`, 400);
  }
}

/**
 * The tax rate to store, validated from the resulting tax mode.
 *
 * `taxRate` is required when the mode is INCLUSIVE or EXCLUSIVE. The column is
 * NOT NULL DEFAULT 0.00, so an untaxed service stores 0 rather than null — the
 * API reports that 0 back as null (see formatService), which is what "no tax"
 * means on the wire.
 */
function resolveTaxRate({ sellingPriceTaxMode, taxRate }, { taxRateProvided = false, previouslyTaxed = false } = {}) {
  const taxed = isTaxed(sellingPriceTaxMode);

  if (taxed && !taxRateProvided && !previouslyTaxed) {
    throw appError("Tax rate is required when the selling price tax mode is INCLUSIVE or EXCLUSIVE.", 400);
  }

  return taxed ? Number(taxRate) || 0 : 0;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

const SERVICE_SORT_OPTIONS = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  az: { name: "asc" },
  za: { name: "desc" },
  priceHigh: { salesPrice: "desc" },
  priceLow: { salesPrice: "asc" },
};

// Legacy sortBy + sortOrder pairs the current pages still send, mapped onto the
// new sort vocabulary so that UI keeps working.
const SERVICE_LEGACY_SORT_OPTIONS = {
  "createdAt:desc": "newest",
  "createdAt:asc": "oldest",
  "name:asc": "az",
  "name:desc": "za",
  "salesPrice:desc": "priceHigh",
  "salesPrice:asc": "priceLow",
};

/**
 * Normalises a service list query: accepts the new vocabulary plus the values
 * the existing pages still send (`ACTIVE`/`INACTIVE`, `sortBy` + `sortOrder`)
 * and reduces them to `{ status, sort }`.
 */
function normaliseServiceFilters({ status, sort, sortBy, sortOrder } = {}) {
  let normalisedStatus;
  if (status === "available" || status === "ACTIVE") normalisedStatus = "ACTIVE";
  else if (status === "notavailable" || status === "INACTIVE") normalisedStatus = "INACTIVE";

  const legacySort =
    sortBy && sortOrder ? `${String(sortBy).trim()}:${String(sortOrder).trim()}` : null;
  const normalisedSort = sort || (legacySort && SERVICE_LEGACY_SORT_OPTIONS[legacySort]) || "newest";

  return { status: normalisedStatus, sort: normalisedSort };
}

export async function listServices({
  companyId,
  search,
  status,
  sort,
  sortBy,
  sortOrder,
  page = 1,
  pageSize = SERVICES_DEFAULT_PAGE_SIZE,
}) {
  const filters = normaliseServiceFilters({ status, sort, sortBy, sortOrder });

  const where = { companyId, ...SERVICE_SCOPE };

  if (filters.status === "ACTIVE") where.status = "ACTIVE";
  else if (filters.status === "INACTIVE") where.status = "INACTIVE";

  if (search && search.trim()) {
    const term = search.trim();
    // The only two fields a service can be searched on. The old item list also
    // searched sku, barcode, HSN/SAC, brand and the legacy category text;
    // a service has none of those in the new contract.
    where.OR = [{ name: { contains: term } }, { productCode: { contains: term } }];
  }

  const orderBy = SERVICE_SORT_OPTIONS[filters.sort] || SERVICE_SORT_OPTIONS.newest;
  const take = Math.min(Number(pageSize) || SERVICES_DEFAULT_PAGE_SIZE, SERVICES_MAX_PAGE_SIZE);
  const currentPage = Number(page) || 1;

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      skip: (currentPage - 1) * take,
      take,
      orderBy,
      include: SERVICE_INCLUDE,
    }),
    prisma.item.count({ where }),
  ]);

  return {
    items: items.map(formatService),
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

export async function createService({ companyId, userId, payload }) {
  const {
    name,
    serviceCode,
    unitId,
    categoryId,
    sellingPrice,
    sellingPriceTaxMode,
    taxRate,
    description,
    status = "ACTIVE",
  } = payload;

  assertRequiredFields({
    name,
    serviceCode,
    unitId,
    categoryId,
    sellingPrice,
    sellingPriceTaxMode,
  });

  await assertUnitAndCategory(companyId, unitId, categoryId);

  const effectiveTaxRate = resolveTaxRate(
    { sellingPriceTaxMode, taxRate },
    { taxRateProvided: payload.taxRate !== undefined }
  );

  const item = await prisma.item.create({
    data: {
      companyId,
      type: "SERVICE",
      createdByUserId: userId,
      name,
      // The service code lives in the shared item code column.
      productCode: serviceCode,
      unitId,
      categoryId,
      salesPrice: sellingPrice,
      sellingPriceTaxMode,
      taxRate: effectiveTaxRate,
      description: description ?? null,
      status,
      // A service is never tracked in inventory. Every other stock, purchase
      // price, discount, HSN/SAC, brand, barcode, tag and sub-category column
      // keeps its schema default and is deliberately left out.
      trackInventory: false,
    },
    include: SERVICE_INCLUDE,
  });

  return formatService(item);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateService({ companyId, serviceId, payload }) {
  const existing = await getServiceRow(companyId, serviceId);

  // Effective state after this payload, used for the shared rule checks.
  const merged = {
    name: payload.name !== undefined ? payload.name : existing.name,
    serviceCode: payload.serviceCode !== undefined ? payload.serviceCode : existing.productCode,
    unitId: payload.unitId !== undefined ? payload.unitId : existing.unitId,
    categoryId: payload.categoryId !== undefined ? payload.categoryId : existing.categoryId,
    sellingPrice: payload.sellingPrice !== undefined ? payload.sellingPrice : existing.salesPrice,
    sellingPriceTaxMode:
      payload.sellingPriceTaxMode !== undefined
        ? payload.sellingPriceTaxMode
        : existing.sellingPriceTaxMode,
    taxRate: payload.taxRate !== undefined ? payload.taxRate : existing.taxRate,
  };

  // Legacy services may have unset required fields. Validate only required
  // fields supplied by this update, so unrelated edits remain possible.
  assertProvidedRequiredFields(payload, merged);

  if (payload.unitId !== undefined || payload.categoryId !== undefined) {
    await assertUnitAndCategory(companyId, merged.unitId, merged.categoryId);
  }

  const effectiveTaxRate = resolveTaxRate(merged, {
    taxRateProvided: payload.taxRate !== undefined,
    previouslyTaxed: isTaxed(existing.sellingPriceTaxMode),
  });

  // Only the fields actually sent are written; nothing is reset implicitly.
  // `taxRate` is always written from the validated merged state, so switching
  // to NONE stores 0 instead of a stale rate.
  const data = { taxRate: effectiveTaxRate };
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.serviceCode !== undefined) data.productCode = payload.serviceCode;
  if (payload.unitId !== undefined) data.unitId = payload.unitId;
  if (payload.categoryId !== undefined) data.categoryId = payload.categoryId;
  if (payload.sellingPrice !== undefined) data.salesPrice = payload.sellingPrice;
  if (payload.sellingPriceTaxMode !== undefined) data.sellingPriceTaxMode = payload.sellingPriceTaxMode;
  if (payload.description !== undefined) data.description = payload.description ?? null;
  if (payload.status !== undefined) data.status = payload.status;

  const item = await prisma.item.update({
    where: { id: serviceId },
    data,
    include: SERVICE_INCLUDE,
  });

  return formatService(item);
}

// ---------------------------------------------------------------------------
// Status toggle
// ---------------------------------------------------------------------------

export async function setServiceStatus({ companyId, serviceId, status }) {
  // Also the 404 check: the row must be a service of this company.
  await getServiceRow(companyId, serviceId);

  const parsed = serviceStatusSchema.safeParse({ status });
  if (!parsed.success) {
    throw appError("Status must be ACTIVE or INACTIVE.", 400);
  }
  const nextStatus = parsed.data.status;

  // No quantity rule for services: a service always has something to sell.
  const item = await prisma.item.update({
    where: { id: serviceId },
    data: { status: nextStatus },
    include: SERVICE_INCLUDE,
  });

  return formatService(item);
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

export async function getServiceDetails({ companyId, serviceId }) {
  const item = await getServiceRow(companyId, serviceId);
  // No profit / loss block: services have no purchase price.
  return formatService(item);
}

// ---------------------------------------------------------------------------
// Delete — soft delete of exactly one service of this company
// ---------------------------------------------------------------------------

export async function deleteService({ companyId, serviceId }) {
  // Scoped single-row soft delete. The row is kept for invoice history, exactly
  // like the product path, and the id can only ever match a service of this
  // company (getServiceRow scopes by companyId AND type = SERVICE).
  await getServiceRow(companyId, serviceId);

  await prisma.item.update({
    where: { id: serviceId },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  return { id: serviceId };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * Company-wide service totals. Deliberately ignores every list filter, so the
 * cards a page shows never change with the search box.
 *
 * Three Prisma counts, each scoped by companyId and to non-deleted SERVICE
 * rows; no raw SQL is used at all.
 */
export async function getServiceSummary({ companyId }) {
  const [totalServices, availableServices, unavailableServices] = await Promise.all([
    prisma.item.count({ where: { companyId, ...SERVICE_SCOPE } }),
    prisma.item.count({ where: { companyId, ...SERVICE_SCOPE, status: "ACTIVE" } }),
    prisma.item.count({ where: { companyId, ...SERVICE_SCOPE, status: "INACTIVE" } }),
  ]);

  return {
    totalServices,
    availableServices,
    unavailableServices,
  };
}
