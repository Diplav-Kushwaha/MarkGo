import prisma from "../prisma.js";
import { settingsDefaults } from "../validators/settingsValidators.js";
import { normalizePhone, invalidPhoneError } from "../utils/phone.js";

/**
 * Reads the company's billing settings, creating the row on first access so
 * callers never have to handle a missing-settings case.
 */
export async function getSettings({ companyId }) {
  const existing = await prisma.companySettings.findUnique({
    where: { companyId },
  });

  if (existing) {
    return existing;
  }

  try {
    return await prisma.companySettings.create({
      data: { companyId, ...settingsDefaults },
    });
  } catch (err) {
    if (err.code === "P2002") {
      return prisma.companySettings.findUnique({ where: { companyId } });
    }
    throw err;
  }
}

export async function updateSettings({ companyId, payload }) {
  await getSettings({ companyId });

  return prisma.companySettings.update({
    where: { companyId },
    data: payload,
  });
}

/**
 * Get company details (for Settings page)
 */
export async function getCompanyDetails({ companyId }) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      address: true,
      state: true,
      city: true,
      country: true,
      gstNumber: true,
      currency: true,
      financialYearStart: true,
      createdAt: true,
    },
  });

  if (!company) {
    const err = new Error("Company not found.");
    err.status = 404;
    throw err;
  }

  return company;
}

/**
 * Update company details (for Settings page)
 */
export async function updateCompanyDetails({ companyId, payload }) {
  const { email, gstNumber, ...rest } = payload;

  // Check email uniqueness if provided
  if (email) {
    const existing = await prisma.company.findUnique({ where: { email: email.toLowerCase() } });
    if (existing && existing.id !== companyId) {
      const err = new Error("A company with this email already exists.");
      err.status = 409;
      throw err;
    }
  }

  // Check GST uniqueness if provided
  if (gstNumber) {
    const existing = await prisma.company.findUnique({ where: { gstNumber } });
    if (existing && existing.id !== companyId) {
      const err = new Error("A company with this GST number already exists.");
      err.status = 409;
      throw err;
    }
  }

  return prisma.company.update({
    where: { id: companyId },
    data: {
      ...rest,
      email: email?.toLowerCase() || null,
      gstNumber: gstNumber || null,
    },
  });
}

/**
 * Get admin profile (for Settings page)
 */
export async function getAdminProfile({ userId }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
    },
  });

  if (!user) {
    const err = new Error("Admin not found.");
    err.status = 404;
    throw err;
  }

  return user;
}

/**
 * Update admin profile (for Settings page)
 */
export async function updateAdminProfile({ userId, payload }) {
  const { phoneNumber, email, ...rest } = payload;

  if (phoneNumber && !normalizePhone(phoneNumber)) {
    throw invalidPhoneError();
  }

  // Check phone uniqueness globally if provided
  if (phoneNumber) {
    const normalizedPhone = normalizePhone(phoneNumber);
    const existing = await prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } });
    if (existing && existing.id !== userId) {
      const err = new Error("This phone number is already registered.");
      err.status = 409;
      throw err;
    }
  }

  // Check email uniqueness if provided
  if (email) {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing && existing.id !== userId) {
      const err = new Error("This email is already registered.");
      err.status = 409;
      throw err;
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...rest,
      phoneNumber: phoneNumber ? normalizePhone(phoneNumber) : undefined,
      email: email?.toLowerCase() || null,
    },
  });
}

/**
 * Builds the next document number for a company, e.g. "INV-2026-0007".
 *
 * Numbers are derived from the highest existing number for the prefix rather
 * than from a count, so deleted or filtered rows can never cause a collision.
 * Callers must run this inside the same transaction that creates the document.
 */
export async function generateDocumentNumber(tx, companyId, kind) {
  const settings = await tx.companySettings.findUnique({ where: { companyId } });
  const prefix = kind === "bill" ? settings?.billPrefix || "BILL" : settings?.invoicePrefix || "INV";
  const year = new Date().getFullYear();
  const fullPrefix = `${prefix}-${year}-`;

  const lastDocument = await (kind === "bill" ? tx.bill : tx.invoice).findFirst({
    where: {
      companyId,
      ...(kind === "bill" ? { billNumber: { startsWith: fullPrefix } } : { invoiceNumber: { startsWith: fullPrefix } }),
    },
    orderBy: kind === "bill" ? { billNumber: "desc" } : { invoiceNumber: "desc" },
    select: kind === "bill" ? { billNumber: true } : { invoiceNumber: true },
  });

  let next = 1;
  if (lastDocument) {
    const lastValue = kind === "bill" ? lastDocument.billNumber : lastDocument.invoiceNumber;
    const parsed = parseInt(String(lastValue).split("-").pop(), 10);
    if (!Number.isNaN(parsed)) {
      next = parsed + 1;
    }
  }

  return `${fullPrefix}${String(next).padStart(4, "0")}`;
}

export function isDocumentNumberUniqueConflict(err, numberField) {
  if (err?.code !== "P2002") return false;

  const target = err.meta?.target;
  const targetParts = (Array.isArray(target) ? target : typeof target === "string" ? [target] : [])
    .flatMap((value) => String(value).split(/[^a-zA-Z0-9]+/));

  return targetParts.includes(numberField);
}

/**
 * Resolves the tax rate to use for a new line: the item's own rate when it has
 * one, otherwise the company default from Settings.
 */
export async function resolveTaxPercent({ companyId, itemTaxRate = null }) {
  if (itemTaxRate !== null && itemTaxRate !== undefined && itemTaxRate !== "") {
    return Number(itemTaxRate);
  }

  const settings = await prisma.companySettings.findUnique({ where: { companyId } });
  return Number(settings?.defaultTaxPercent ?? settingsDefaults.defaultTaxPercent);
}
