import prisma from "../prisma.js";
import { normalizePhone, invalidPhoneError } from "../utils/phone.js";
import { Decimal } from "../utils/money.js";

const EXPORT_MAX_ROWS = 10_000;

async function checkDuplicateEmail(companyId, email, excludeVendorId = null) {
  if (!email) return null;
  const existing = await prisma.vendor.findUnique({
    where: { companyId_email: { companyId, email: email.toLowerCase() } },
  });
  if (existing && existing.id !== excludeVendorId && !existing.isDeleted) {
    return existing;
  }
  return null;
}

async function checkDuplicatePhone(companyId, phoneNumber, excludeVendorId = null) {
  const normalizedPhone = normalizePhone(phoneNumber);
  const existing = await prisma.vendor.findUnique({
    where: { companyId_phoneNumber: { companyId, phoneNumber: normalizedPhone } },
  });
  if (existing && existing.id !== excludeVendorId && !existing.isDeleted) {
    return existing;
  }
  return null;
}

/**
 * Builds an address update payload from a submitted address object.
 * Blank optional fields become null; line1 is only included when a
 * non-blank value is provided because the column is NOT NULL — a blank
 * line1 keeps the stored value instead of wiping it. Keys the client
 * did not send are left out entirely so they stay unchanged.
 */
function buildAddressUpdateData(address) {
  const data = {};
  if (address.line1) data.line1 = address.line1;
  if (address.line2 !== undefined) data.line2 = address.line2 || null;
  if (address.city !== undefined) data.city = address.city || null;
  if (address.state !== undefined) data.state = address.state || null;
  if (address.country !== undefined) data.country = address.country || null;
  if (address.postalCode !== undefined) data.postalCode = address.postalCode || null;
  return data;
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

  if (phoneNumber && !normalizePhone(phoneNumber)) {
    throw invalidPhoneError();
  }
  if (alternatePhone && !normalizePhone(alternatePhone)) {
    throw invalidPhoneError();
  }

  if (email) {
    const duplicate = await checkDuplicateEmail(companyId, email);
    if (duplicate) {
      const err = new Error("A vendor with this email already exists for your company.");
      err.status = 409;
      throw err;
    }
  }

  if (phoneNumber) {
    const duplicate = await checkDuplicatePhone(companyId, phoneNumber);
    if (duplicate) {
      const err = new Error("A vendor with this phone number already exists for your company.");
      err.status = 409;
      throw err;
    }
  }

  const addressesToCreate = [];
  if (billingAddress && billingAddress.line1) {
    addressesToCreate.push({ ...billingAddress, type: "BILLING" });
  }
  if (sameAsBilling && billingAddress && billingAddress.line1) {
    addressesToCreate.push({ ...billingAddress, type: "SHIPPING" });
  } else if (shippingAddress && shippingAddress.line1) {
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
        email: email?.trim().toLowerCase() || null,
        phoneNumber: phoneNumber ? normalizePhone(phoneNumber) : null,
        alternatePhone: alternatePhone ? normalizePhone(alternatePhone) : null,
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

  if (payload.phoneNumber && !normalizePhone(payload.phoneNumber)) {
    throw invalidPhoneError();
  }
  if (payload.alternatePhone && !normalizePhone(payload.alternatePhone)) {
    throw invalidPhoneError();
  }

  if (payload.email) {
    const duplicate = await checkDuplicateEmail(companyId, payload.email, vendorId);
    if (duplicate) {
      const err = new Error("Another vendor with this email already exists for your company.");
      err.status = 409;
      throw err;
    }
  }

  if (payload.phoneNumber) {
    const duplicate = await checkDuplicatePhone(companyId, payload.phoneNumber, vendorId);
    if (duplicate) {
      const err = new Error("Another vendor with this phone number already exists for your company.");
      err.status = 409;
      throw err;
    }
  }

  const { billingAddress, shippingAddress, sameAsBilling, ...vendorFields } = payload;

  // Normalize phone numbers and blank optional strings. "" becomes
  // null so a cleared field is stored as NULL, never as "".
  if (vendorFields.phoneNumber) {
    vendorFields.phoneNumber = normalizePhone(vendorFields.phoneNumber);
  }
  if (vendorFields.alternatePhone) {
    vendorFields.alternatePhone = normalizePhone(vendorFields.alternatePhone);
  }
  for (const field of ["companyName", "contactPerson", "category", "email", "taxNumber", "panNumber", "notes", "bankAccountNumber", "bankIfsc", "bankName", "bankBranch"]) {
    if (vendorFields[field] === "") {
      vendorFields[field] = null;
    }
  }

  return prisma.$transaction(async (tx) => {
    if (vendorFields.openingBalance !== undefined) {
      const current = await tx.vendor.findFirst({
        where: { id: vendorId, companyId, isDeleted: false },
        select: { openingBalance: true },
      });
      if (!current) {
        const err = new Error("Vendor not found");
        err.status = 404;
        throw err;
      }

      const nextOpeningBalance = new Decimal(vendorFields.openingBalance);
      const openingBalanceDelta = nextOpeningBalance.minus(current.openingBalance);
      if (openingBalanceDelta.isZero()) {
        delete vendorFields.openingBalance;
      } else {
        vendorFields.openingBalance = nextOpeningBalance;
        vendorFields.outstandingPayable = { increment: openingBalanceDelta };
      }
    }

    if (billingAddress) {
      const addressData = buildAddressUpdateData(billingAddress);

      const existingBilling = await tx.vendorAddress.findFirst({
        where: { vendorId, type: "BILLING" },
      });

      if (existingBilling && Object.keys(addressData).length) {
        await tx.vendorAddress.update({
          where: { id: existingBilling.id },
          data: addressData,
        });
      } else if (!existingBilling && addressData.line1) {
        await tx.vendorAddress.create({
          data: { vendorId, type: "BILLING", ...addressData },
        });
      }

      if (sameAsBilling) {
        const existingShipping = await tx.vendorAddress.findFirst({
          where: { vendorId, type: "SHIPPING" },
        });

        if (existingShipping && Object.keys(addressData).length) {
          await tx.vendorAddress.update({
            where: { id: existingShipping.id },
            data: addressData,
          });
        } else if (!existingShipping && addressData.line1) {
          await tx.vendorAddress.create({
            data: { vendorId, type: "SHIPPING", ...addressData },
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

export async function getVendorsForExport({ companyId }) {
  const rows = await prisma.vendor.findMany({
    where: { companyId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: EXPORT_MAX_ROWS + 1,
    include: { addresses: true },
  });
  return { rows: rows.slice(0, EXPORT_MAX_ROWS), truncated: rows.length > EXPORT_MAX_ROWS };
}
