import prisma from "../prisma.js";

async function checkDuplicateEmail(companyId, email, excludeVendorId = null) {
  const existing = await prisma.vendor.findUnique({
    where: { companyId_email: { companyId, email } },
  });
  if (existing && existing.id !== excludeVendorId && !existing.isDeleted) {
    return existing;
  }
  return null;
}

export async function createVendor({ companyId, userId, payload }) {
  const {
    name,
    companyName,
    contactPerson,
    vendorType = "BUSINESS",
    category,
    email,
    phoneNumber,
    alternatePhone,
    taxNumber,
    panNumber,
    currency = "INR",
    paymentTerms = "DUE_ON_RECEIPT",
    creditLimit,
    openingBalance = 0,
    bankAccountNumber,
    bankIfsc,
    bankName,
    bankBranch,
    notes,
    billingAddress,
    shippingAddress,
    sameAsBilling = true,
  } = payload;

  const duplicate = await checkDuplicateEmail(companyId, email);
  if (duplicate) {
    const err = new Error("A vendor with this email already exists for your company.");
    err.status = 409;
    throw err;
  }

  const addressesToCreate = [{ ...billingAddress, type: "BILLING" }];
  if (sameAsBilling) {
    addressesToCreate.push({ ...billingAddress, type: "SHIPPING" });
  } else if (shippingAddress) {
    addressesToCreate.push({ ...shippingAddress, type: "SHIPPING" });
  }

  return prisma.$transaction(async (tx) => {
    return tx.vendor.create({
      data: {
        companyId,
        name: name.trim(),
        companyName: companyName ? companyName.trim() : null,
        contactPerson: contactPerson ? contactPerson.trim() : null,
        vendorType,
        category: category ? category.trim() : null,
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber || null,
        alternatePhone: alternatePhone || null,
        taxNumber: taxNumber ? taxNumber.trim().toUpperCase() : null,
        panNumber: panNumber ? panNumber.trim().toUpperCase() : null,
        currency: currency || "INR",
        paymentTerms: paymentTerms || "DUE_ON_RECEIPT",
        creditLimit: creditLimit ?? null,
        openingBalance: openingBalance ?? 0,
        outstandingPayable: openingBalance ?? 0,
        bankAccountNumber: bankAccountNumber ? bankAccountNumber.trim() : null,
        bankIfsc: bankIfsc ? bankIfsc.trim().toUpperCase() : null,
        bankName: bankName ? bankName.trim() : null,
        bankBranch: bankBranch ? bankBranch.trim() : null,
        notes: notes ? notes.trim() : null,
        createdByUserId: userId,
        addresses: { create: addressesToCreate },
      },
      include: { addresses: true },
    });
  });
}

// Parses an optional numeric query filter. Returns null for anything that
// isn't a finite number, so a junk value can never reach Prisma as NaN.
function parseAmountFilter(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function listVendors({
  companyId,
  search,
  status,
  vendorType,
  category,
  minOutstanding,
  maxOutstanding,
  page = 1,
  pageSize = 20,
  sortBy = "createdAt",
  sortOrder = "desc",
}) {
  const minPayable = parseAmountFilter(minOutstanding);
  const maxPayable = parseAmountFilter(maxOutstanding);
  const payableRange = {
    ...(minPayable === null ? {} : { gte: minPayable }),
    ...(maxPayable === null ? {} : { lte: maxPayable }),
  };

  const where = {
    companyId,
    isDeleted: false,
    ...(status ? { status } : {}),
    ...(vendorType ? { vendorType } : {}),
    ...(category ? { category: { contains: category.trim() } } : {}),
    ...(Object.keys(payableRange).length ? { outstandingPayable: payableRange } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search.trim() } },
            { email: { contains: search.trim() } },
            { phoneNumber: { contains: search.trim() } },
            { companyName: { contains: search.trim() } },
            { contactPerson: { contains: search.trim() } },
            { taxNumber: { contains: search.trim() } },
            { panNumber: { contains: search.trim() } },
          ],
        }
      : {}),
  };

  const allowedSortFields = ["name", "createdAt", "outstandingPayable", "totalPurchased", "creditLimit"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortField]: direction },
      include: { addresses: true },
    }),
    prisma.vendor.count({ where }),
  ]);

  return {
    vendors,
    pagination: {
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

export async function getVendorStats({ companyId }) {
  const [totalVendors, activeVendors, inactiveVendors, aggregateResult] = await Promise.all([
    prisma.vendor.count({
      where: { companyId, isDeleted: false },
    }),
    prisma.vendor.count({
      where: { companyId, isDeleted: false, status: "ACTIVE" },
    }),
    prisma.vendor.count({
      where: { companyId, isDeleted: false, status: "INACTIVE" },
    }),
    prisma.vendor.aggregate({
      where: { companyId, isDeleted: false },
      _sum: {
        outstandingPayable: true,
        totalPurchased: true,
        totalPaid: true,
      },
    }),
  ]);

  return {
    totalVendors,
    activeVendors,
    inactiveVendors,
    totalOutstandingPayable: Number(aggregateResult._sum.outstandingPayable || 0),
    totalPurchased: Number(aggregateResult._sum.totalPurchased || 0),
    totalPaid: Number(aggregateResult._sum.totalPaid || 0),
  };
}

export async function getVendorById({ companyId, vendorId }) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, companyId, isDeleted: false },
    include: { addresses: true },
  });
  if (!vendor) {
    const err = new Error("Vendor not found.");
    err.status = 404;
    throw err;
  }

  // Linked Bills / Purchase Orders (relationship data)
  // When the Bill / PurchaseOrder Prisma models are implemented, this connects directly.
  // Currently returns structured financial link history ready for UI consumption.
  const linkedBills = [];
  const linkedPurchaseOrders = [];

  return {
    ...vendor,
    linkedBills,
    linkedPurchaseOrders,
  };
}

export async function updateVendor({ companyId, vendorId, payload }) {
  await getVendorById({ companyId, vendorId });

  if (payload.email) {
    const duplicate = await checkDuplicateEmail(companyId, payload.email, vendorId);
    if (duplicate) {
      const err = new Error("Another vendor with this email already exists for your company.");
      err.status = 409;
      throw err;
    }
  }

  const { billingAddress, shippingAddress, sameAsBilling, ...vendorFields } = payload;

  return prisma.$transaction(async (tx) => {
    if (billingAddress) {
      const existingBilling = await tx.vendorAddress.findFirst({
        where: { vendorId, type: "BILLING" },
      });

      if (existingBilling) {
        await tx.vendorAddress.update({
          where: { id: existingBilling.id },
          data: {
            line1: billingAddress.line1,
            line2: billingAddress.line2 ?? null,
            city: billingAddress.city ?? null,
            state: billingAddress.state ?? null,
            country: billingAddress.country ?? null,
            postalCode: billingAddress.postalCode ?? null,
          },
        });
      } else {
        await tx.vendorAddress.create({
          data: {
            vendorId,
            type: "BILLING",
            line1: billingAddress.line1,
            line2: billingAddress.line2 ?? null,
            city: billingAddress.city ?? null,
            state: billingAddress.state ?? null,
            country: billingAddress.country ?? null,
            postalCode: billingAddress.postalCode ?? null,
          },
        });
      }

      if (sameAsBilling) {
        const existingShipping = await tx.vendorAddress.findFirst({
          where: { vendorId, type: "SHIPPING" },
        });

        if (existingShipping) {
          await tx.vendorAddress.update({
            where: { id: existingShipping.id },
            data: {
              line1: billingAddress.line1,
              line2: billingAddress.line2 ?? null,
              city: billingAddress.city ?? null,
              state: billingAddress.state ?? null,
              country: billingAddress.country ?? null,
              postalCode: billingAddress.postalCode ?? null,
            },
          });
        } else {
          await tx.vendorAddress.create({
            data: {
              vendorId,
              type: "SHIPPING",
              line1: billingAddress.line1,
              line2: billingAddress.line2 ?? null,
              city: billingAddress.city ?? null,
              state: billingAddress.state ?? null,
              country: billingAddress.country ?? null,
              postalCode: billingAddress.postalCode ?? null,
            },
          });
        }
      }
    }

    return tx.vendor.update({
      where: { id: vendorId },
      data: vendorFields,
      include: { addresses: true },
    });
  });
}

// Soft delete vendor (preserves data integrity for past bills / purchase orders)
export async function deleteVendor({ companyId, vendorId }) {
  await getVendorById({ companyId, vendorId });

  return prisma.vendor.update({
    where: { id: vendorId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      status: "INACTIVE",
    },
  });
}

export async function updateVendorStatus({ companyId, vendorId, status }) {
  await getVendorById({ companyId, vendorId });

  return prisma.vendor.update({
    where: { id: vendorId },
    data: { status },
  });
}

// Bulk Actions: ACTIVATE, DEACTIVATE, DELETE
export async function bulkActionVendors({ companyId, vendorIds, action }) {
  const where = {
    companyId,
    id: { in: vendorIds },
    isDeleted: false,
  };

  if (action === "ACTIVATE") {
    return prisma.vendor.updateMany({
      where,
      data: { status: "ACTIVE" },
    });
  }

  if (action === "DEACTIVATE") {
    return prisma.vendor.updateMany({
      where,
      data: { status: "INACTIVE" },
    });
  }

  if (action === "DELETE") {
    return prisma.vendor.updateMany({
      where,
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: "INACTIVE",
      },
    });
  }

  throw new Error("Invalid bulk action requested.");
}

// Export dataset for vendors
export async function getVendorsForExport({ companyId }) {
  return prisma.vendor.findMany({
    where: { companyId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    include: { addresses: true },
  });
}
