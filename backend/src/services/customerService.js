import prisma from "../prisma.js";

// Email uniqueness is scoped per company (see @@unique([companyId, email])
// in schema.prisma) — never check email uniqueness globally for customers.
async function checkDuplicateEmail(companyId, email, excludeCustomerId = null) {
  const existing = await prisma.customer.findUnique({
    where: { companyId_email: { companyId, email } },
  });
  if (existing && existing.id !== excludeCustomerId && !existing.isDeleted) {
    return existing;
  }
  return null;
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
    sameAsBilling,
  } = payload;

  const duplicate = await checkDuplicateEmail(companyId, email);
  if (duplicate) {
    const err = new Error("A customer with this email already exists for your company.");
    err.status = 409;
    throw err;
  }

  const addressesToCreate = [{ ...billingAddress, type: "BILLING" }];
  if (sameAsBilling) {
    addressesToCreate.push({ ...billingAddress, type: "SHIPPING" });
  } else if (shippingAddress) {
    addressesToCreate.push({ ...shippingAddress, type: "SHIPPING" });
  }

  // Customer + its address(es) are created together — if either insert
  // fails, the whole thing rolls back, so you never get a customer with
  // no address.
  return prisma.$transaction(async (tx) => {
    return tx.customer.create({
      data: {
        companyId,
        customerType,
        name: name.trim(),
        companyName: companyName ? companyName.trim() : null,
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber || null,
        alternatePhone: alternatePhone || null,
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

// companyId scoping here is what stops one company's admin from ever
// reading/editing another company's customer by guessing an id.
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
  await getCustomerById({ companyId, customerId }); // scoping + existence check

  if (payload.email) {
    const duplicate = await checkDuplicateEmail(companyId, payload.email, customerId);
    if (duplicate) {
      const err = new Error("Another customer with this email already exists for your company.");
      err.status = 409;
      throw err;
    }
  }

  const { billingAddress, shippingAddress, sameAsBilling, ...customerFields } = payload;

  return prisma.$transaction(async (tx) => {
    // If billing address was provided, update existing or create
    if (billingAddress) {
      const existingBilling = await tx.address.findFirst({
        where: { customerId, type: "BILLING" },
      });

      if (existingBilling) {
        await tx.address.update({
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
        await tx.address.create({
          data: {
            customerId,
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
        const existingShipping = await tx.address.findFirst({
          where: { customerId, type: "SHIPPING" },
        });

        if (existingShipping) {
          await tx.address.update({
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

// Soft delete customer (blocks deletion if active dues/orders or sets soft deleted)
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

// Bulk Actions: ACTIVATE, DEACTIVATE, DELETE
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

// Export dataset for customers
export async function getCustomersForExport({ companyId }) {
  return prisma.customer.findMany({
    where: { companyId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    include: { addresses: true },
  });
}

// Mock/Dummy GSTIN Lookup (no external API key required)
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
