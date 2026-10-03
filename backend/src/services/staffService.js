import prisma from "../prisma.js";

async function checkDuplicateEmail(companyId, email, excludeStaffId = null) {
  const existing = await prisma.staff.findUnique({
    where: { companyId_email: { companyId, email } },
  });
  if (existing && existing.id !== excludeStaffId) {
    return existing;
  }
  return null;
}

export async function createStaff({ companyId, userId, payload }) {
  const { name, email, phoneNumber, designation, department } = payload;

  const duplicate = await checkDuplicateEmail(companyId, email);
  if (duplicate) {
    const err = new Error("A staff member with this email already exists for your company.");
    err.status = 409;
    throw err;
  }

  return prisma.staff.create({
    data: {
      companyId,
      name: name.trim(),
      email,
      phoneNumber: phoneNumber || null,
      designation: designation || null,
      department: department || null,
      createdByUserId: userId,
    },
  });
}

export async function listStaff({ companyId, search, status, page = 1, pageSize = 20 }) {
  const where = {
    companyId,
    ...(status ? { status } : {}),
    ...(search
      ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { phoneNumber: { contains: search } },
          { designation: { contains: search } },
          { department: { contains: search } },
        ],
      }
      : {}),
  };

  const [staff, total] = await Promise.all([
    prisma.staff.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.staff.count({ where }),
  ]);

  return { staff, total, page, pageSize };
}

export async function getStaffById({ companyId, staffId }) {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, companyId },
  });
  if (!staff) {
    const err = new Error("Staff member not found.");
    err.status = 404;
    throw err;
  }
  return staff;
}

export async function updateStaff({ companyId, staffId, payload }) {
  await getStaffById({ companyId, staffId });

  if (payload.email) {
    const duplicate = await checkDuplicateEmail(companyId, payload.email, staffId);
    if (duplicate) {
      const err = new Error("Another staff member with this email already exists for your company.");
      err.status = 409;
      throw err;
    }
  }

  return prisma.staff.update({
    where: { id: staffId },
    data: payload,
  });
}

export async function deleteStaff({ companyId, staffId }) {
  await getStaffById({ companyId, staffId });

  return prisma.staff.delete({
    where: { id: staffId },
  });
}

export async function updateStaffStatus({ companyId, staffId, status }) {
  await getStaffById({ companyId, staffId });

  return prisma.staff.update({
    where: { id: staffId },
    data: { status },
  });
}
