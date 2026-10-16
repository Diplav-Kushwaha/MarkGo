import prisma from "../prisma.js";

function appError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Reusable dependency check for units.
 *
 * Returns package units and items that use `unitId`. Such a base unit must not be
 * converted into a package unit and must not be deleted, because doing so
 * would leave dependent package units with a dangling base.
 *
 * Item relations are real foreign keys; transaction lines retain unit text.
 */
export async function isUnitInUse(unitId, companyId) {
  const [dependents, items] = await Promise.all([prisma.unit.findMany({
    where: { baseUnitId: unitId },
    select: { id: true, fullName: true, shortName: true },
  }), prisma.item.findMany({ where: { unitId }, select: { id: true, companyId: true } })]);
  return [...dependents, ...items];
}

/** Catalog rows are shared, with null-company and system rows built in. */
function visibleUnitWhere() {
  return {};
}

function publicUnit(unit, companyId) {
  if (!unit) return unit;
  const { companyId: owner, baseUnit, ...safe } = unit;
  return {
    ...safe,
    ...(baseUnit ? { baseUnit: publicUnit(baseUnit, companyId) } : {}),
    isOwn: owner === companyId,
    isBuiltIn: owner == null,
  };
}

function dedupeUnits(rows, companyId) {
  const rank = (u) => u.companyId == null ? 0 : u.companyId === companyId ? 1 : 2;
  const chosen = [];
  for (const row of rows) {
    const full = String(row.fullName).trim().toLocaleLowerCase();
    const short = String(row.shortName).trim().toLocaleLowerCase();
    const index = chosen.findIndex((u) => String(u.fullName).trim().toLocaleLowerCase() === full || String(u.shortName).trim().toLocaleLowerCase() === short);
    if (index < 0) chosen.push(row);
    else if (rank(row) < rank(chosen[index]) || (rank(row) === rank(chosen[index]) && new Date(row.createdAt) < new Date(chosen[index].createdAt))) chosen[index] = row;
  }
  return chosen;
}

/** A unit visible by id. */
export async function getUnitById({ companyId, unitId }) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId },
    include: {
      baseUnit: {
        select: { id: true, fullName: true, shortName: true, isPackage: true },
      },
    },
  });
  if (!unit) throw appError("Unit not found.", 404);
  return publicUnit(unit, companyId);
}

/** Finds a unit that is visible to the company AND is a simple base candidate. */
async function findVisibleBaseUnit(companyId, baseUnitId) {
  return prisma.unit.findFirst({
    where: { id: baseUnitId },
  });
}

/**
 * A name/short-name conflict counts against any unit visible to this company
 * (built-in units are shared, so custom names may not duplicate them either).
 * MySQL cannot enforce uniqueness for the NULL companyId of built-ins, so this
 * service-level check is what makes built-in names effectively unique globally.
 */
  async function findNameConflict(companyId, fullName, shortName, excludeId) {
    const rows = await prisma.unit.findMany({
      where: excludeId ? { id: { not: excludeId } } : {},
      orderBy: { createdAt: "asc" },
    });
    const full = String(fullName).trim().toLocaleLowerCase();
    const short = String(shortName).trim().toLocaleLowerCase();
    return rows.find((row) => String(row.fullName).trim().toLocaleLowerCase() === full || String(row.shortName).trim().toLocaleLowerCase() === short) || null;
  }

export async function listUnits({
  companyId,
  search,
  source, // "" | "BUILT_IN" | "CUSTOM"
  type, // "" | "SIMPLE" | "PACKAGE"
  page = 1,
  pageSize = 10,
  sortBy = "createdAt",
  sortOrder = "desc",
}) {
  page = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  pageSize = Number.isInteger(Number(pageSize)) && Number(pageSize) > 0 ? Number(pageSize) : 10;
  const where = { AND: [] };

  if (source === "BUILT_IN") {
    where.AND.push({ OR: [{ companyId: null }, { isSystem: true }] });
  } else if (source === "CUSTOM") {
    where.AND.push({ companyId: companyId, isSystem: false });
  } else {
    where.AND.push(visibleUnitWhere(companyId));
  }

  if (type === "SIMPLE") {
    where.AND.push({ isPackage: false });
  } else if (type === "PACKAGE") {
    where.AND.push({ isPackage: true });
  }

  if (search && search.trim() && search.trim().toLowerCase() !== "all") {
    const term = search.trim();
    where.AND.push({
      OR: [
        { fullName: { contains: term } },
        { shortName: { contains: term } },
      ],
    });
  }

  const allowedSort = ["fullName", "createdAt"];
  const sortField = allowedSort.includes(sortBy) ? sortBy : "createdAt";
  const direction = sortOrder?.toLowerCase() === "asc" ? "asc" : "desc";

  const allUnits = await prisma.unit.findMany({
      where,
      orderBy: { [sortField]: direction },
      include: {
        baseUnit: {
          select: { id: true, fullName: true, shortName: true, isPackage: true },
        },
      },
    });
  const uniqueUnits = dedupeUnits(allUnits, companyId);
  const total = uniqueUnits.length;
  const units = uniqueUnits.slice((page - 1) * pageSize, page * pageSize).map((u) => publicUnit(u, companyId));

  return {
    units,
    pagination: {
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

/** Lightweight options for the base-unit dropdown and future product forms. */
export async function getUnitOptions({ companyId }) {
  const rows = await prisma.unit.findMany({ orderBy: { createdAt: "asc" } });
  return dedupeUnits(rows, companyId).sort((a, b) => a.fullName.localeCompare(b.fullName)).map((u) => publicUnit(u, companyId));
}

export async function createUnit({ companyId, payload }) {
  const { fullName, shortName, isPackage = false, quantity, baseUnitId } = payload;

  const conflict = await findNameConflict(companyId, fullName.trim(), shortName.trim());
  if (conflict) {
    const err = appError("This unit already exists in the shared list. You can select it directly.", 409);
    err.existing = { id: conflict.id, fullName: conflict.fullName, shortName: conflict.shortName };
    throw err;
  }

  if (isPackage) {
    const base = await findVisibleBaseUnit(companyId, baseUnitId);
    if (!base) throw appError("Base unit not found or not available to your company.", 404);
    if (base.isPackage) {
      throw appError("Base unit must be a simple unit, not a package unit.", 400);
    }
  }

  const created = await prisma.unit.create({
    data: {
      companyId,
      fullName: fullName.trim(),
      shortName: shortName.trim(),
      isPackage,
      quantity: isPackage ? quantity : null,
      baseUnitId: isPackage ? baseUnitId : null,
    },
    include: {
      baseUnit: {
        select: { id: true, fullName: true, shortName: true, isPackage: true },
      },
    },
  });
  return publicUnit(created, companyId);
}

export async function updateUnit({ companyId, unitId, payload }) {
  const rawUnit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!rawUnit || rawUnit.companyId !== companyId) throw appError("Unit not found.", 404);
  const unit = rawUnit;

  const { fullName, shortName, isPackage, quantity, baseUnitId } = payload;
  const nextIsPackage = isPackage !== undefined ? isPackage : unit.isPackage;

  // Uniqueness on name/short name (case-insensitive), excluding self.
  if (fullName !== undefined || shortName !== undefined) {
    const conflict = await findNameConflict(
      companyId,
      fullName !== undefined ? fullName.trim() : unit.fullName,
      shortName !== undefined ? shortName.trim() : unit.shortName,
      unitId
    );
    if (conflict) {
      throw appError("This unit already exists in the shared list. You can select it directly.", 409);
    }
  }

  const otherCompanyUse = await prisma.item.findFirst({ where: { unitId, companyId: { not: companyId } }, select: { id: true } });
  if (otherCompanyUse) throw appError("Used by other companies, cannot be changed.", 409);

  // A unit referenced as a base unit by others cannot become a package unit.
  if (nextIsPackage && !unit.isPackage) {
    const inUse = await isUnitInUse(unitId, companyId);
    if (inUse.length) {
      throw appError("In use, cannot be changed.", 409);
    }
  }

  const data = {};
  if (fullName !== undefined) data.fullName = fullName.trim();
  if (shortName !== undefined) data.shortName = shortName.trim();

  if (nextIsPackage) {
    // Partial update: fall back to the stored values for anything the
    // client did not send, so a PATCH that only changes (say) the
    // quantity cannot wipe the package's base unit or quantity.
    const effectiveBaseUnitId = baseUnitId !== undefined ? baseUnitId : unit.baseUnitId;
    const effectiveQuantity = quantity !== undefined ? quantity : unit.quantity;

    if (!effectiveBaseUnitId) {
      throw appError("Base unit is required for a package unit.", 400);
    }
    if (
      effectiveQuantity === undefined ||
      effectiveQuantity === null ||
      Number(effectiveQuantity) <= 0
    ) {
      throw appError("Quantity must be greater than 0.", 400);
    }

    const base = await findVisibleBaseUnit(companyId, effectiveBaseUnitId);
    if (!base) throw appError("Base unit not found or not available to your company.", 404);
    if (base.isPackage) throw appError("Base unit must be a simple unit, not a package unit.", 400);
    if (base.id === unitId) throw appError("A unit cannot use itself as its base unit.", 400);

    data.isPackage = true;
    if (quantity !== undefined) data.quantity = quantity;
    if (baseUnitId !== undefined) data.baseUnitId = baseUnitId;
  } else {
    data.isPackage = false;
    data.quantity = null;
    data.baseUnitId = null;
  }

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data,
    include: {
      baseUnit: {
        select: { id: true, fullName: true, shortName: true, isPackage: true },
      },
    },
  });
  return publicUnit(updated, companyId);
}

export async function deleteUnit({ companyId, unitId }) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.companyId !== companyId) throw appError("Unit not found.", 404);

  const inUse = await isUnitInUse(unitId, companyId);
  if (inUse.length) {
    throw appError("In use, cannot be deleted.", 409);
  }

  return prisma.unit.delete({ where: { id: unitId } });
}
