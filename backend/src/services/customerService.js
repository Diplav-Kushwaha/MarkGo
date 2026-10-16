import prisma from "../prisma.js";
import { normalizePhone, invalidPhoneError } from "../utils/phone.js";
import { Decimal } from "../utils/money.js";

const EXPORT_MAX_ROWS = 10_000;

async function checkDuplicateEmail(companyId, email, excludeCustomerId = null) {
  if (!email) return null;
  const existing = await prisma.customer.findUnique({
    where: { companyId_email: { companyId, email: email.toLowerCase() } },
  });
  if (existing && existing.id !== excludeCustomerId && !existing.isDeleted) {
    return existing;
  }
  return null;
}

async function checkDuplicatePhone(companyId, phoneNumber, excludeCustomerId = null) {
  const normalizedPhone = normalizePhone(phoneNumber);
  const existing = await prisma.customer.findUnique({
    where: { companyId_phoneNumber: { companyId, phoneNumber: normalizedPhone } },
  });
  if (existing && existing.id !== excludeCustomerId && !existing.isDeleted) {
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

export async function createCustomer({ companyId, userId, payload }) {
  const {
    customerType = "BUSINESS",
    name,
    companyName,
    email,
    phoneNumber,
    alternatePhone,
    taxNumber,
    panNumber,
    currency = "INR",
    paymentTerms = "DUE_ON_RECEIPT",
    creditLimit,
    openingBalance = 0,
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
      const err = new Error("A customer with this email already exists for your company.");
      err.status = 409;
      throw err;
    }
  }

  if (phoneNumber) {
    const duplicate = await checkDuplicatePhone(companyId, phoneNumber);
    if (duplicate) {
      const err = new Error("A customer with this phone number already exists for your company.");
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
    return tx.customer.create({
      data: {
        companyId,
        customerType,
        name: name.trim(),
        companyName: companyName ? companyName.trim() : null,
        email: email?.trim().toLowerCase() || null,
        phoneNumber: phoneNumber ? normalizePhone(phoneNumber) : null,
        alternatePhone: alternatePhone ? normalizePhone(alternatePhone) : null,
        taxNumber: taxNumber ? taxNumber.trim().toUpperCase() : null,
        panNumber: panNumber ? panNumber.trim().toUpperCase() : null,
        currency: currency || "INR",
        paymentTerms: paymentTerms || "DUE_ON_RECEIPT",
        creditLimit: creditLimit ?? null,
        openingBalance: openingBalance ?? 0,
        outstandingBalance: openingBalance ?? 0,
        notes: notes ? notes.trim() : null,
        createdByUserId: userId,
        addresses: { create: addressesToCreate },
      },
      include: { addresses: true },
    });
  });
}

export async function listCustomers({
  companyId,
  search,
  status,
  customerType,
  hasBalance,
  page = 1,
  pageSize = 10,
  sortBy = "createdAt",
  sortOrder = "desc",
}) {
  const where = {
    companyId,
    isDeleted: false,
    ...(status ? { status } : {}),
    ...(customerType ? { customerType } : {}),
    ...(hasBalance === "true" ? { outstandingBalance: { gt: 0 } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search.trim() } },
            { companyName: { contains: search.trim() } },
            { email: { contains: search.trim() } },
            { phoneNumber: { contains: search.trim() } },
            { taxNumber: { contains: search.trim() } },
            { panNumber: { contains: search.trim() } },
          ],
        }
      : {}),
  };

  const allowedSortFields = ["name", "createdAt", "outstandingBalance", "creditLimit", "customerType"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortField]: direction },
      include: { addresses: true },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers,
    pagination: {
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

export async function getCustomerStats({ companyId }) {
  const [totalCustomers, activeCustomers, inactiveCustomers, customersWithBalance] =
    await Promise.all([
      prisma.customer.count({
        where: { companyId, isDeleted: false },
      }),
      prisma.customer.count({
        where: { companyId, isDeleted: false, status: "ACTIVE" },
      }),
      prisma.customer.count({
        where: { companyId, isDeleted: false, status: "INACTIVE" },
      }),
      prisma.customer.aggregate({
        where: { companyId, isDeleted: false },
        _sum: {
          outstandingBalance: true,
          totalInvoiced: true,
          totalPaid: true,
        },
      }),
    ]);

  return {
    totalCustomers,
    activeCustomers,
    inactiveCustomers,
    totalOutstanding: Number(customersWithBalance._sum.outstandingBalance || 0),
    totalInvoiced: Number(customersWithBalance._sum.totalInvoiced || 0),
    totalPaid: Number(customersWithBalance._sum.totalPaid || 0),
  };
}

export async function getCustomerById({ companyId, customerId }) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    include: { addresses: true },
  });
  if (!customer) {
    const err = new Error("Customer not found.");
    err.status = 404;
    throw err;
  }
  return customer;
}

export async function updateCustomer({ companyId, customerId, payload }) {
  await getCustomerById({ companyId, customerId });

  if (payload.phoneNumber && !normalizePhone(payload.phoneNumber)) {
    throw invalidPhoneError();
  }
  if (payload.alternatePhone && !normalizePhone(payload.alternatePhone)) {
    throw invalidPhoneError();
  }

  if (payload.email) {
    const duplicate = await checkDuplicateEmail(companyId, payload.email, customerId);
    if (duplicate) {
      const err = new Error("Another customer with this email already exists for your company.");
      err.status = 409;
      throw err;
    }
  }

  if (payload.phoneNumber) {
    const duplicate = await checkDuplicatePhone(companyId, payload.phoneNumber, customerId);
    if (duplicate) {
      const err = new Error("Another customer with this phone number already exists for your company.");
      err.status = 409;
      throw err;
    }
  }

  const { billingAddress, shippingAddress, sameAsBilling, ...customerFields } = payload;

  // Normalize phone numbers and blank optional strings. "" becomes
  // null so a cleared field is stored as NULL, never as "".
  if (customerFields.phoneNumber) {
    customerFields.phoneNumber = normalizePhone(customerFields.phoneNumber);
  }
  if (customerFields.alternatePhone) {
    customerFields.alternatePhone = normalizePhone(customerFields.alternatePhone);
  }
  for (const field of ["companyName", "email", "taxNumber", "panNumber", "notes"]) {
    if (customerFields[field] === "") {
      customerFields[field] = null;
    }
  }

  return prisma.$transaction(async (tx) => {
    if (customerFields.openingBalance !== undefined) {
      const current = await tx.customer.findFirst({
        where: { id: customerId, companyId, isDeleted: false },
        select: { openingBalance: true },
      });
      if (!current) {
        const err = new Error("Customer not found");
        err.status = 404;
        throw err;
      }

      const nextOpeningBalance = new Decimal(customerFields.openingBalance);
      const openingBalanceDelta = nextOpeningBalance.minus(current.openingBalance);
      if (openingBalanceDelta.isZero()) {
        delete customerFields.openingBalance;
      } else {
        customerFields.openingBalance = nextOpeningBalance;
        customerFields.outstandingBalance = { increment: openingBalanceDelta };
      }
    }

    if (billingAddress) {
      const addressData = buildAddressUpdateData(billingAddress);

      const existingBilling = await tx.address.findFirst({
        where: { customerId, type: "BILLING" },
      });

      if (existingBilling && Object.keys(addressData).length) {
        await tx.address.update({
          where: { id: existingBilling.id },
          data: addressData,
        });
      } else if (!existingBilling && addressData.line1) {
        await tx.address.create({
          data: { customerId, type: "BILLING", ...addressData },
        });
      }

      if (sameAsBilling) {
        const existingShipping = await tx.address.findFirst({
          where: { customerId, type: "SHIPPING" },
        });

        if (existingShipping && Object.keys(addressData).length) {
          await tx.address.update({
            where: { id: existingShipping.id },
            data: addressData,
          });
        }
      }
    }

    return tx.customer.update({
      where: { id: customerId },
      data: customerFields,
      include: { addresses: true },
    });
  });
}

export async function deleteCustomer({ companyId, customerId }) {
  await getCustomerById({ companyId, customerId });

  return prisma.customer.update({
    where: { id: customerId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      status: "INACTIVE",
    },
  });
}

export async function updateCustomerStatus({ companyId, customerId, status }) {
  await getCustomerById({ companyId, customerId });

  return prisma.customer.update({
    where: { id: customerId },
    data: { status },
  });
}

export async function bulkActionCustomers({ companyId, customerIds, action }) {
  const where = {
    companyId,
    id: { in: customerIds },
    isDeleted: false,
  };

  if (action === "ACTIVATE") {
    return prisma.customer.updateMany({
      where,
      data: { status: "ACTIVE" },
    });
  }

  if (action === "DEACTIVATE") {
    return prisma.customer.updateMany({
      where,
      data: { status: "INACTIVE" },
    });
  }

  if (action === "DELETE") {
    return prisma.customer.updateMany({
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

export async function getCustomersForExport({ companyId }) {
  const rows = await prisma.customer.findMany({
    where: { companyId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: EXPORT_MAX_ROWS + 1,
    include: { addresses: true },
  });
  return { rows: rows.slice(0, EXPORT_MAX_ROWS), truncated: rows.length > EXPORT_MAX_ROWS };
}

export async function lookupGstin(gstin) {
  const cleanGstin = gstin.trim().toUpperCase();
  const pan = cleanGstin.substring(2, 12);
  const stateCode = cleanGstin.substring(0, 2);

  const stateMap = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "19": "West Bengal",
    "24": "Gujarat",
    "27": "Maharashtra",
    "29": "Karnataka",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "36": "Telangana",
  };

  const stateName = stateMap[stateCode] || "Maharashtra";

  return {
    gstin: cleanGstin,
    panNumber: pan,
    tradeName: `Enterprise (${cleanGstin.slice(-4)}) Pvt Ltd`,
    legalName: `Bharat Business Group`,
    state: stateName,
    city: stateName === "Maharashtra" ? "Mumbai" : stateName === "Delhi" ? "New Delhi" : "Central City",
    pincode: "400001",
    status: "Active",
  };
}
