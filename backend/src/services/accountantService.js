import prisma from "../prisma.js";

async function checkDuplicateEmail(companyId, email, excludeAccountantId = null) {
  const existing = await prisma.accountant.findUnique({
    where: { companyId_email: { companyId, email } },
  });
  if (existing && existing.id !== excludeAccountantId) {
    return existing;
  }
  return null;
}

export async function createAccountant({ companyId, userId, payload }) {
  const { name, email, phoneNumber, licenseNumber, experience } = payload;

  const duplicate = await checkDuplicateEmail(companyId, email);
  if (duplicate) {
    const err = new Error("An accountant with this email already exists for your company.");
    err.status = 409;
    throw err;
  }

  return prisma.accountant.create({
    data: {
      companyId,
      name: name.trim(),
      email,
      phoneNumber: phoneNumber || null,
      licenseNumber: licenseNumber || null,
      experience: experience || null,
      createdByUserId: userId,
    },
  });
}

export async function listAccountants({ companyId, search, status, page = 1, pageSize = 20 }) {
  const where = {
    companyId,
    ...(status ? { status } : {}),
    ...(search
      ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { phoneNumber: { contains: search } },
          { licenseNumber: { contains: search } },
        ],
      }
      : {}),
  };

  const [accountants, total] = await Promise.all([
    prisma.accountant.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.accountant.count({ where }),
  ]);

  return { accountants, total, page, pageSize };
}

export async function getAccountantById({ companyId, accountantId }) {
  const accountant = await prisma.accountant.findFirst({
    where: { id: accountantId, companyId },
  });
  if (!accountant) {
    const err = new Error("Accountant not found.");
    err.status = 404;
    throw err;
  }
  return accountant;
}

export async function updateAccountant({ companyId, accountantId, payload }) {
  await getAccountantById({ companyId, accountantId });

  if (payload.email) {
    const duplicate = await checkDuplicateEmail(companyId, payload.email, accountantId);
    if (duplicate) {
      const err = new Error("Another accountant with this email already exists for your company.");
      err.status = 409;
      throw err;
    }
  }

  return prisma.accountant.update({
    where: { id: accountantId },
    data: payload,
  });
}

export async function deleteAccountant({ companyId, accountantId }) {
  await getAccountantById({ companyId, accountantId });

  return prisma.accountant.delete({
    where: { id: accountantId },
  });
}

export async function updateAccountantStatus({ companyId, accountantId, status }) {
  await getAccountantById({ companyId, accountantId });

  return prisma.accountant.update({
    where: { id: accountantId },
    data: { status },
  });
}
