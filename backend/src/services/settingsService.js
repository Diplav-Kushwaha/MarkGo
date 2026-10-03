import prisma from "../prisma.js";
import { settingsDefaults } from "../validators/settingsValidators.js";

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

  // create() can race if two requests hit a brand new company at once; the
  // unique companyId constraint means the loser simply re-reads the row.
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
