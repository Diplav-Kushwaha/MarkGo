import prisma from "../prisma.js";
import { Decimal, toNumber, mapMoney, BILL_MONEY_FIELDS, BILL_ITEM_MONEY_FIELDS } from "../utils/money.js";
import { generateDocumentNumber, getSettings, isDocumentNumberUniqueConflict } from "./settingsService.js";
import { recordBillPayment, markBillAsPaid } from "./paymentService.js";

async function assertVendorUsable(vendorId, companyId) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, companyId, isDeleted: false },
    select: { id: true, name: true, status: true },
  });

  if (!vendor) {
    const err = new Error("Vendor not found or access denied.");
    err.status = 404;
    throw err;
  }

  if (vendor.status !== "ACTIVE") {
    const err = new Error("This vendor is inactive and cannot be billed.");
    err.status = 400;
    throw err;
  }

  return vendor;
}

async function assertItemsUsable(items, companyId) {
  const itemIds = [...new Set((items ?? []).filter((i) => i.itemId).map((i) => i.itemId))];
  if (itemIds.length === 0) return;

  const found = await prisma.item.findMany({
    where: { id: { in: itemIds }, companyId, isDeleted: false },
    select: { id: true },
  });

  if (found.length !== itemIds.length) {
    const err = new Error("One or more products/services not found or access denied.");
    err.status = 400;
    throw err;
  }
}

function buildLineTotals(items) {
  return items.map((item) => {
    const amount = new Decimal(item.quantity).times(item.unitPrice);
    return {
      itemId: item.itemId ?? null,
      description: item.description.trim(),
      quantity: new Decimal(item.quantity),
      unitPrice: new Decimal(item.unitPrice),
      amount,
    };
  });
}

function buildItemCreates(lineTotals) {
  return lineTotals.map((line) => ({
    itemId: line.itemId,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    amount: line.amount,
  }));
}

function sumLineTotals(lineTotals) {
  return lineTotals.reduce((total, line) => total.plus(line.amount), new Decimal(0));
}

/**
 * Prisma requires a DateTime instance for a DateTime column and rejects a bare
 * "YYYY-MM-DD" string. The validator already returns Dates, but normalising here
 * too keeps the service correct for any caller that reaches it directly.
 * null is preserved so a due date can be cleared.
 */
function toDateTime(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createBill({ companyId, userId, payload }) {
  const { vendorId, items, amount, category, notes, attachmentUrl, billDate, dueDate } = payload;

  await assertVendorUsable(vendorId, companyId);
  await assertItemsUsable(items, companyId);

  const lineTotals = items ? buildLineTotals(items) : [];
  const total = items
    ? sumLineTotals(lineTotals)
    : new Decimal(amount);

  if (total.lte(0)) {
    const err = new Error("Bill total must be greater than zero.");
    err.status = 400;
    throw err;
  }

  const settings = await getSettings({ companyId });
  const issueDate = new Date(billDate);
  const due = dueDate
    ? new Date(dueDate)
    : new Date(issueDate.getTime() + (settings.defaultPaymentTermsDays || 0) * 24 * 60 * 60 * 1000);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const billNumber = await generateDocumentNumber(tx, companyId, "bill");

        const bill = await tx.bill.create({
          data: {
            companyId,
            vendorId,
            billNumber,
            billDate: issueDate,
            dueDate: due,
            category: category?.trim() || null,
            status: "UNPAID",
            total,
            amountPaid: 0,
            amountDue: total,
            currency: settings.currency || "INR",
            notes: notes?.trim() || settings.billNotes || null,
            attachmentUrl: attachmentUrl?.trim() || null,
            createdById: userId,
            ...(lineTotals.length ? { items: { create: buildItemCreates(lineTotals) } } : {}),
          },
          include: { items: true, vendor: { select: { id: true, name: true, email: true } } },
        });

        await tx.vendor.update({
          where: { id: vendorId },
          data: {
            totalPurchased: { increment: total },
            outstandingPayable: { increment: total },
            lastBillDate: issueDate,
          },
        });

        return {
          ...mapMoney(bill, BILL_MONEY_FIELDS),
          items: bill.items.map((item) => mapMoney(item, BILL_ITEM_MONEY_FIELDS)),
        };
      });
    } catch (err) {
      if (!isDocumentNumberUniqueConflict(err, "billNumber")) throw err;
      if (attempt === 3) {
        const conflict = new Error("Bill number conflict, please retry.");
        conflict.status = 409;
        throw conflict;
      }
    }
  }
}

export async function listBills({
  companyId,
  search,
  status,
  vendorId,
  category,
  from,
  to,
  page = 1,
  pageSize = 20,
}) {
  const where = {
    companyId,
    ...(status ? { status } : {}),
    ...(vendorId ? { vendorId } : {}),
    ...(category ? { category } : {}),
    ...(from || to
      ? {
          billDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(search && search.trim()
      ? {
          OR: [
            { billNumber: { contains: search.trim() } },
            { category: { contains: search.trim() } },
            { notes: { contains: search.trim() } },
            { vendor: { name: { contains: search.trim() } } },
          ],
        }
      : {}),
  };

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ billDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        dueDate: true,
        category: true,
        status: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        vendor: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.bill.count({ where }),
  ]);

  return {
    bills: bills.map((bill) => mapMoney(bill, BILL_MONEY_FIELDS)),
    pagination: {
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

export async function getBillSummary({ companyId }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [allBills, outstanding, thisMonth, overdue, billPayments] = await Promise.all([
    // Total billed is every bill the company has, whatever its status — it must
    // not be read off the unpaid-only aggregate below.
    prisma.bill.aggregate({
      where: { companyId },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.bill.aggregate({
      where: { companyId, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      _sum: { total: true, amountDue: true },
      _count: { id: true },
    }),
    prisma.bill.aggregate({
      where: { companyId, billDate: { gte: monthStart, lt: monthEnd } },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.bill.aggregate({
      where: { companyId, status: { in: ["UNPAID", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
      _sum: { amountDue: true },
      _count: { id: true },
    }),
    // Total paid is the real cash movement: payments attached to a bill.
    // `billId: { not: null }` keeps invoice payments out of this figure.
    prisma.payment.aggregate({
      where: { companyId, billId: { not: null } },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  const totalBilled = toNumber(allBills._sum.total);
  const totalPaid = toNumber(billPayments._sum.amount);
  // Outstanding is derived, never stored, so it can never drift from the two
  // figures above. Clamped at 0 in case a payment ever exceeds its bill total.
  const totalOutstanding = Number(Math.max(0, totalBilled - totalPaid).toFixed(2));

  return {
    totalBilled,
    totalPaid,
    totalOutstanding,
    // Unpaid view, kept separate from the totals above.
    totalPayable: toNumber(outstanding._sum.amountDue),
    unpaidCount: outstanding._count.id || 0,
    unpaidAmount: toNumber(outstanding._sum.amountDue),
    billCount: allBills._count.id || 0,
    paymentCount: billPayments._count.id || 0,
    thisMonthExpenses: toNumber(thisMonth._sum.total),
    thisMonthCount: thisMonth._count.id || 0,
    overdueCount: overdue._count.id || 0,
    overdueAmount: toNumber(overdue._sum.amountDue),
  };
}

export async function getBillById({ companyId, billId }) {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, companyId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      payments: {
        orderBy: { paymentDate: "desc" },
        include: { recordedBy: { select: { id: true, fullName: true } } },
      },
      vendor: { select: { id: true, name: true, email: true, phoneNumber: true, taxNumber: true } },
    },
  });

  if (!bill) {
    const err = new Error("Bill not found or access denied.");
    err.status = 404;
    throw err;
  }

  return {
    ...mapMoney(bill, BILL_MONEY_FIELDS),
    items: bill.items.map((item) => mapMoney(item, BILL_ITEM_MONEY_FIELDS)),
    payments: bill.payments.map((payment) => mapMoney(payment, ["amount"])),
  };
}

export async function updateBill({ companyId, billId, payload }) {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, companyId },
    select: { id: true, vendorId: true, total: true, amountPaid: true, status: true },
  });

  if (!bill) {
    const err = new Error("Bill not found or access denied.");
    err.status = 404;
    throw err;
  }

  // Once any money has been recorded against a bill its figures are part of the
  // payment history, so edits are locked rather than silently rewriting them.
  if (bill.status !== "UNPAID" || new Decimal(bill.amountPaid).gt(0)) {
    const err = new Error("This bill has recorded payments and can no longer be edited.");
    err.status = 409;
    throw err;
  }

  const { items, amount, vendorId, billDate, dueDate, ...rest } = payload;

  if (vendorId && vendorId !== bill.vendorId) {
    await assertVendorUsable(vendorId, companyId);
  }
  if (items) {
    await assertItemsUsable(items, companyId);
  }

  // Only include a date when the caller actually sent one, so an update never
  // blanks a value the user did not touch.
  const dateFields = {
    ...(billDate === undefined ? {} : { billDate: toDateTime(billDate) }),
    ...(dueDate === undefined ? {} : { dueDate: toDateTime(dueDate) }),
  };
  const hasDateChange = Object.keys(dateFields).length > 0;

  const lineTotals = items ? buildLineTotals(items) : null;
  const nextTotal = lineTotals ? sumLineTotals(lineTotals) : amount !== undefined ? new Decimal(amount) : null;

  if (nextTotal !== null && nextTotal.lte(0)) {
    const err = new Error("Bill total must be greater than zero.");
    err.status = 400;
    throw err;
  }

  const totalsChanged = nextTotal !== null && !nextTotal.equals(new Decimal(bill.total));
  if (!totalsChanged && !vendorId && !Object.keys(rest).length && !lineTotals && !hasDateChange) {
    return getBillById({ companyId, billId });
  }

  return prisma.$transaction(async (tx) => {
    if (lineTotals) {
      await tx.billItem.deleteMany({ where: { billId } });
      if (lineTotals.length) {
        await tx.billItem.createMany({
          data: buildItemCreates(lineTotals).map((item) => ({ ...item, billId })),
        });
      }
    }

    const targetVendorId = vendorId ?? bill.vendorId;
    const oldTotal = new Decimal(bill.total);
    const vendorChanged = targetVendorId !== bill.vendorId;

    // Reassigning a bill moves the whole liability: the previous vendor is
    // relieved of the original total and the new vendor picks up the new one.
    if (vendorChanged) {
      await tx.vendor.update({
        where: { id: bill.vendorId },
        data: {
          totalPurchased: { decrement: oldTotal },
          outstandingPayable: { decrement: oldTotal },
        },
      });

      await tx.vendor.update({
        where: { id: targetVendorId },
        data: {
          totalPurchased: { increment: nextTotal ?? oldTotal },
          outstandingPayable: { increment: nextTotal ?? oldTotal },
        },
      });
    } else if (totalsChanged) {
      await tx.vendor.update({
        where: { id: targetVendorId },
        data: {
          totalPurchased: { increment: nextTotal.minus(oldTotal) },
          outstandingPayable: { increment: nextTotal.minus(oldTotal) },
        },
      });
    }

    await tx.bill.update({
      where: { id: billId },
      data: {
        ...rest,
        ...dateFields,
        ...(vendorId ? { vendorId } : {}),
        ...(nextTotal !== null ? { total: nextTotal, amountDue: nextTotal } : {}),
      },
    });
  }).then(() => getBillById({ companyId, billId }));
}

export { recordBillPayment, markBillAsPaid };
