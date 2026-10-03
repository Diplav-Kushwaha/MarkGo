import prisma from "../prisma.js";

async function checkDuplicateSku(companyId, sku, excludeItemId = null) {
  if (!sku || !sku.trim()) return null;
  const existing = await prisma.item.findUnique({
    where: { companyId_sku: { companyId, sku: sku.trim() } },
  });
  if (existing && existing.id !== excludeItemId && !existing.isDeleted) {
    return existing;
  }
  return null;
}

export async function createItem({ companyId, userId, payload }) {
  const {
    type = "PRODUCT",
    name,
    sku,
    barcode,
    category,
    subCategory,
    brand,
    tags,
    hsnCode,
    sacCode,
    taxRate = 0,
    isPriceInclusiveTax = false,
    salesPrice = 0,
    purchasePrice,
    discountType,
    discountValue,
    unit = type === "SERVICE" ? "hrs" : "pcs",
    trackInventory = type === "PRODUCT",
    stockQuantity,
    openingStock = 0,
    reorderLevel = 0,
    allowBackorder = false,
    description,
    imageUrl,
    linkedVendorId,
  } = payload;

  if (sku && sku.trim()) {
    const duplicate = await checkDuplicateSku(companyId, sku);
    if (duplicate) {
      const err = new Error("An item with this SKU or Item Code already exists in your catalog.");
      err.status = 409;
      throw err;
    }
  }

  // Initial stock defaults to openingStock if not specified
  const initialStock = stockQuantity !== undefined ? stockQuantity : openingStock;

  return prisma.item.create({
    data: {
      companyId,
      type,
      name: name.trim(),
      sku: sku && sku.trim() ? sku.trim() : null,
      barcode: barcode && barcode.trim() ? barcode.trim() : null,
      category: category && category.trim() ? category.trim() : null,
      subCategory: subCategory && subCategory.trim() ? subCategory.trim() : null,
      brand: brand && brand.trim() ? brand.trim() : null,
      tags: tags && tags.trim() ? tags.trim() : null,
      hsnCode: type === "PRODUCT" && hsnCode && hsnCode.trim() ? hsnCode.trim() : null,
      sacCode: type === "SERVICE" && sacCode && sacCode.trim() ? sacCode.trim() : null,
      taxRate,
      isPriceInclusiveTax,
      salesPrice,
      purchasePrice: purchasePrice !== undefined ? purchasePrice : null,
      discountType: discountType || null,
      discountValue: discountValue !== undefined ? discountValue : null,
      unit: unit.trim(),
      trackInventory: type === "SERVICE" ? false : trackInventory,
      stockQuantity: type === "SERVICE" ? 0 : initialStock,
      openingStock: type === "SERVICE" ? 0 : openingStock,
      reorderLevel: type === "SERVICE" ? 0 : reorderLevel,
      allowBackorder: type === "SERVICE" ? false : allowBackorder,
      description: description && description.trim() ? description.trim() : null,
      imageUrl: imageUrl && imageUrl.trim() ? imageUrl.trim() : null,
      linkedVendorId: linkedVendorId && linkedVendorId.trim() ? linkedVendorId.trim() : null,
      createdByUserId: userId,
    },
    include: {
      linkedVendor: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function listItems({
  companyId,
  search,
  type,
  category,
  status,
  stockLevel, // "LOW_STOCK", "IN_STOCK", "OUT_OF_STOCK"
  page = 1,
  pageSize = 10,
  sortBy = "createdAt",
  sortOrder = "desc",
}) {
  const where = {
    companyId,
    isDeleted: false,
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(search
      ? {
        OR: [
          { name: { contains: search.trim() } },
          { sku: { contains: search.trim() } },
          { category: { contains: search.trim() } },
          { brand: { contains: search.trim() } },
          { hsnCode: { contains: search.trim() } },
          { sacCode: { contains: search.trim() } },
          { barcode: { contains: search.trim() } },
        ],
      }
      : {}),
  };

  if (stockLevel === "OUT_OF_STOCK") {
    where.trackInventory = true;
    where.stockQuantity = { lte: 0 };
  }

  const allowedSortFields = ["name", "createdAt", "salesPrice", "stockQuantity", "type", "category"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortField]: direction },
      include: {
        linkedVendor: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.item.count({ where }),
  ]);

  // Compute low stock on results if needed or mark isLowStock
  const formattedItems = items.map((item) => {
    const isLow =
      item.type === "PRODUCT" &&
      item.trackInventory &&
      Number(item.stockQuantity) <= Number(item.reorderLevel);
    return {
      ...item,
      isLowStock: isLow,
    };
  });

  return {
    items: formattedItems,
    pagination: {
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

export async function getItemStats({ companyId }) {
  const [totalProducts, totalServices, inactiveItems, allProducts] = await Promise.all([
    prisma.item.count({
      where: { companyId, isDeleted: false, type: "PRODUCT" },
    }),
    prisma.item.count({
      where: { companyId, isDeleted: false, type: "SERVICE" },
    }),
    prisma.item.count({
      where: { companyId, isDeleted: false, status: "INACTIVE" },
    }),
    prisma.item.findMany({
      where: { companyId, isDeleted: false, type: "PRODUCT", trackInventory: true },
      select: { stockQuantity: true, reorderLevel: true },
    }),
  ]);

  const lowStockCount = allProducts.filter(
    (p) => Number(p.stockQuantity) <= Number(p.reorderLevel)
  ).length;

  return {
    totalProducts,
    totalServices,
    lowStockCount,
    inactiveItems,
  };
}

export async function getItemById({ companyId, itemId }) {
  const item = await prisma.item.findFirst({
    where: { id: itemId, companyId, isDeleted: false },
    include: {
      linkedVendor: {
        select: { id: true, name: true, email: true, phoneNumber: true },
      },
      createdBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  if (!item) {
    const err = new Error("Product or service not found.");
    err.status = 404;
    throw err;
  }

  return item;
}

export async function updateItem({ companyId, itemId, payload }) {
  await getItemById({ companyId, itemId });

  if (payload.sku) {
    const duplicate = await checkDuplicateSku(companyId, payload.sku, itemId);
    if (duplicate) {
      const err = new Error("Another item with this SKU already exists.");
      err.status = 409;
      throw err;
    }
  }

  return prisma.item.update({
    where: { id: itemId },
    data: payload,
    include: {
      linkedVendor: {
        select: { id: true, name: true },
      },
    },
  });
}

export async function updateItemStatus({ companyId, itemId, status }) {
  await getItemById({ companyId, itemId });

  return prisma.item.update({
    where: { id: itemId },
    data: { status },
  });
}

// Soft delete item
export async function deleteItem({ companyId, itemId }) {
  await getItemById({ companyId, itemId });

  return prisma.item.update({
    where: { id: itemId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });
}

// Bulk Actions: ACTIVATE, DEACTIVATE, DELETE, ASSIGN_CATEGORY
export async function bulkActionItems({ companyId, itemIds, action, category }) {
  const where = {
    companyId,
    id: { in: itemIds },
    isDeleted: false,
  };

  if (action === "ACTIVATE") {
    return prisma.item.updateMany({
      where,
      data: { status: "ACTIVE" },
    });
  }

  if (action === "DEACTIVATE") {
    return prisma.item.updateMany({
      where,
      data: { status: "INACTIVE" },
    });
  }

  if (action === "DELETE") {
    return prisma.item.updateMany({
      where,
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  if (action === "ASSIGN_CATEGORY") {
    return prisma.item.updateMany({
      where,
      data: { category: category?.trim() || null },
    });
  }

  throw new Error("Invalid bulk action requested.");
}

// Export items to JSON array for CSV conversion
export async function getItemsForExport({ companyId }) {
  return prisma.item.findMany({
    where: { companyId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      linkedVendor: {
        select: { name: true },
      },
    },
  });
}
