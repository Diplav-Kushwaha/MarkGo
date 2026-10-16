import prisma from "../prisma.js";

function appError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function visibleCategoryWhere() {
  return {};
}

function publicCategory(row, companyId) {
  const { companyId: owner, ...safe } = row;
  return { ...safe, isOwn: owner === companyId, isBuiltIn: owner == null };
}

function dedupeCategories(rows, companyId) {
  const chosen = new Map();
  const rank = (c) => c.companyId == null ? 0 : c.companyId === companyId ? 1 : 2;
  for (const row of rows) {
    const key = `${row.type}|${String(row.name).trim().toLocaleLowerCase()}`;
    const current = chosen.get(key);
    if (!current || rank(row) < rank(current) || (rank(row) === rank(current) && new Date(row.createdAt) < new Date(current.createdAt))) chosen.set(key, row);
  }
  return [...chosen.values()];
}

/** Returns all products/services currently referencing a category. */
export async function isCategoryInUse(categoryId, companyId) {
  return prisma.item.findMany({ where: { categoryId }, select: { id: true, companyId: true } });
}

/** Lightweight options for the category picker on future product/service forms. */
export async function getCategoryOptions({ companyId }) {
  const rows = await prisma.category.findMany({ orderBy: { createdAt: "asc" } });
  return dedupeCategories(rows, companyId).sort((a, b) => a.name.localeCompare(b.name)).map((row) => publicCategory(row, companyId));
}

export async function getCategoryById({ companyId, categoryId }) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw appError("Category not found.", 404);
  return publicCategory(category, companyId);
}

  async function findNameConflict(companyId, name, type, excludeId) {
    const rows = await prisma.category.findMany({
      where: { type, ...(excludeId ? { id: { not: excludeId } } : {}) },
      orderBy: { createdAt: "asc" },
    });
    const normalized = String(name).trim().toLocaleLowerCase();
    return rows.find((row) => String(row.name).trim().toLocaleLowerCase() === normalized) || null;
  }

export async function listCategories({ companyId, search, source, type, page = 1, pageSize = 10 }) {
  page = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  pageSize = Number.isInteger(Number(pageSize)) && Number(pageSize) > 0 ? Number(pageSize) : 10;
  const where = { AND: [] };

  if (source === "BUILT_IN") {
    where.AND.push({ OR: [{ companyId: null }, { isSystem: true }] });
  } else if (source === "CUSTOM") {
    where.AND.push({ companyId: companyId, isSystem: false });
  } else {
    where.AND.push(visibleCategoryWhere());
  }

  if (type === "PRODUCT" || type === "SERVICE") {
    where.AND.push({ type });
  }

  if (search && search.trim() && search.trim().toLowerCase() !== "all") {
    where.AND.push({ name: { contains: search.trim() } });
  }

  const all = await prisma.category.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  const unique = dedupeCategories(all, companyId);
  const total = unique.length;
  const categories = unique.slice((page - 1) * pageSize, page * pageSize).map((row) => publicCategory(row, companyId));

  return {
    categories,
    pagination: {
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

export async function createCategory({ companyId, payload }) {
  const { name, type } = payload;

  const conflict = await findNameConflict(companyId, name.trim(), type);
  if (conflict) {
    const err = appError("This category already exists in the shared list. You can select it directly.", 409);
    err.existing = { id: conflict.id, name: conflict.name, type: conflict.type };
    throw err;
  }

  const created = await prisma.category.create({
    data: {
      companyId,
      name: name.trim(),
      type,
      isSystem: false,
    },
  });
  return publicCategory(created, companyId);
}

export async function updateCategory({ companyId, categoryId, payload }) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.companyId !== companyId) throw appError("Category not found.", 404);

  const { name, type } = payload;
  if (name !== undefined || type !== undefined) {
    const conflict = await findNameConflict(
      companyId,
      name !== undefined ? name.trim() : category.name,
      type !== undefined ? type : category.type,
      categoryId
    );
    if (conflict) {
      throw appError("This category already exists in the shared list. You can select it directly.", 409);
    }
  }

  const otherCompanyUse = await prisma.item.findFirst({ where: { categoryId, companyId: { not: companyId } }, select: { id: true } });
  if (otherCompanyUse) throw appError("Used by other companies, cannot be changed.", 409);
  const updated = await prisma.category.update({
    where: { id: categoryId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(type !== undefined && { type }),
    },
  });
  return publicCategory(updated, companyId);
}

export async function deleteCategory({ companyId, categoryId }) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.companyId !== companyId) throw appError("Category not found.", 404);

  const inUse = await isCategoryInUse(categoryId, companyId);
  if (inUse.length) {
    throw appError("In use, cannot be deleted.", 409);
  }

  return prisma.category.delete({ where: { id: categoryId } });
}
