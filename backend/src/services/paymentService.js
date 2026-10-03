import prisma from "../prisma.js";
import { Decimal, toNumber, mapMoney } from "../utils/money.js";

// Balances are stored as Decimal(12,2), so a remainder below half a cent is
// treated as fully settled rather than leaving a phantom 0.01 balance.
const SETTLED_TOLERANCE = new Decimal("0.01");

const PAYABLE_INVOICE_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"];
const PAYABLE_BILL_STATUSES = ["UNPAID", "PARTIALLY_PAID"];

/**
 * Works out the new paid/due amounts and the resulting status for a document
 * after another payment is applied. Returns null when the payment would
 * exceed the outstanding balance.
 */
function applyPayment({ currentPaid, documentTotal, paymentAmount }) {
  const newPaid = new Decimal(currentPaid || 0).plus(paymentAmount);
  const remaining = new Decimal(documentTotal).minus(newPaid);

  if (remaining.lt(new Decimal(0))) {
    return null;
  }

  const settled = remaining.abs().lte(SETTLED_TOLERANCE);

  return {
    amountPaid: newPaid,
    amountDue: settled ? new Decimal(0) : remaining,
    isSettled: settled,
  };
}

async function loadInvoiceForPayment(tx, { companyId, invoiceId }) {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { id: true, companyId: true, customerId: true, invoiceNumber: true, grandTotal: true, amountPaid: true, amountDue: true, status: true },
  });

  if (!invoice) {
    const err = new Error("Invoice not found or access denied.");
    err.status = 404;
    throw err;
  }

  if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
    const err = new Error(`Cannot record a payment against an invoice with status ${invoice.status}.`);
    err.status = 400;
    throw err;
  }

  return invoice;
}

async function loadBillForPayment(tx, { companyId, billId }) {
  const bill = await tx.bill.findFirst({
    where: { id: billId, companyId },
    select: { id: true, companyId: true, vendorId: true, billNumber: true, total: true, amountPaid: true, amountDue: true, status: true },
  });

  if (!bill) {
    const err = new Error("Bill not found or access denied.");
    err.status = 404;
    throw err;
  }

  if (!PAYABLE_BILL_STATUSES.includes(bill.status)) {
    const err = new Error(`Cannot record a payment against a bill with status ${bill.status}.`);
    err.status = 400;
    throw err;
  }

  return bill;
}

export async function recordInvoicePayment({ companyId, userId, invoiceId, payload }) {
  const paymentAmount = new Decimal(payload.amount);

  return prisma.$transaction(async (tx) => {
    const invoice = await loadInvoiceForPayment(tx, { companyId, invoiceId });

    const result = applyPayment({
      currentPaid: invoice.amountPaid,
      documentTotal: invoice.grandTotal,
      paymentAmount,
    });

    if (!result) {
      const err = new Error("Payment amount exceeds the outstanding balance.");
      err.status = 400;
      throw err;
    }

    const payment = await tx.payment.create({
      data: {
        companyId,
        invoiceId: invoice.id,
        amount: paymentAmount,
        method: payload.method,
        reference: payload.reference ?? null,
        note: payload.note ?? null,
        paymentDate: payload.paymentDate,
        recordedById: userId,
      },
    });

    const status = result.isSettled
      ? "PAID"
      : invoice.status === "OVERDUE"
        ? "OVERDUE"
        : "PARTIALLY_PAID";

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: result.amountPaid, amountDue: result.amountDue, status },
    });

    await tx.customer.update({
      where: { id: invoice.customerId },
      data: {
        totalPaid: { increment: paymentAmount },
        outstandingBalance: { decrement: result.isSettled ? invoice.amountDue : paymentAmount },
        lastPaymentDate: payload.paymentDate,
      },
    });

    return {
      ...mapMoney(payment, ["amount"]),
      invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, status },
      amountDue: toNumber(result.amountDue),
    };
  });
}

export async function recordBillPayment({ companyId, userId, billId, payload }) {
  const paymentAmount = new Decimal(payload.amount);

  return prisma.$transaction(async (tx) => {
    const bill = await loadBillForPayment(tx, { companyId, billId });

    const result = applyPayment({
      currentPaid: bill.amountPaid,
      documentTotal: bill.total,
      paymentAmount,
    });

    if (!result) {
      const err = new Error("Payment amount exceeds the outstanding balance.");
      err.status = 400;
      throw err;
    }

    const payment = await tx.payment.create({
      data: {
        companyId,
        billId: bill.id,
        amount: paymentAmount,
        method: payload.method,
        reference: payload.reference ?? null,
        note: payload.note ?? null,
        paymentDate: payload.paymentDate,
        recordedById: userId,
      },
    });

    const status = result.isSettled ? "PAID" : "PARTIALLY_PAID";

    await tx.bill.update({
      where: { id: bill.id },
      data: { amountPaid: result.amountPaid, amountDue: result.amountDue, status },
    });

    await tx.vendor.update({
      where: { id: bill.vendorId },
      data: {
        totalPaid: { increment: paymentAmount },
        outstandingPayable: { decrement: result.isSettled ? bill.amountDue : paymentAmount },
        lastPaymentDate: payload.paymentDate,
      },
    });

    return {
      ...mapMoney(payment, ["amount"]),
      bill: { id: bill.id, billNumber: bill.billNumber, status },
      amountDue: toNumber(result.amountDue),
    };
  });
}

/**
 * Marks a bill fully paid without recording a payment row. Used for settling a
 * bill in one go where the individual transfers are not itemised.
 */
export async function markBillAsPaid({ companyId, userId, billId, paymentDate, method = "OTHER", note }) {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, companyId },
    select: { id: true, vendorId: true, total: true, amountPaid: true, amountDue: true, status: true, billNumber: true },
  });

  if (!bill) {
    const err = new Error("Bill not found or access denied.");
    err.status = 404;
    throw err;
  }

  if (bill.status === "PAID") {
    const err = new Error("This bill is already marked as paid.");
    err.status = 400;
    throw err;
  }

  const outstanding = new Decimal(bill.amountDue);
  if (outstanding.lte(0)) {
    const err = new Error("This bill has no outstanding balance.");
    err.status = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        companyId,
        billId: bill.id,
        amount: outstanding,
        method,
        note: note ?? "Marked as paid",
        paymentDate: paymentDate ?? new Date(),
        recordedById: userId,
      },
    });

    await tx.bill.update({
      where: { id: bill.id },
      data: { amountPaid: bill.total, amountDue: 0, status: "PAID" },
    });

    await tx.vendor.update({
      where: { id: bill.vendorId },
      data: {
        totalPaid: { increment: outstanding },
        outstandingPayable: { decrement: outstanding },
        lastPaymentDate: paymentDate ?? new Date(),
      },
    });

    return {
      ...mapMoney(payment, ["amount"]),
      bill: { id: bill.id, billNumber: bill.billNumber, status: "PAID" },
      amountDue: 0,
    };
  });
}

export async function listPayments({ companyId, search, direction, from, to, page = 1, pageSize = 20 }) {
  const where = {
    companyId,
    ...(direction === "IN" ? { invoiceId: { not: null } } : {}),
    ...(direction === "OUT" ? { billId: { not: null } } : {}),
    ...(from || to
      ? {
          paymentDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(search && search.trim()
      ? {
          OR: [
            { note: { contains: search.trim() } },
            { reference: { contains: search.trim() } },
            { invoice: { invoiceNumber: { contains: search.trim() } } },
            { bill: { billNumber: { contains: search.trim() } } },
            { invoice: { customer: { name: { contains: search.trim() } } } },
            { bill: { vendor: { name: { contains: search.trim() } } } },
          ],
        }
      : {}),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            grandTotal: true,
            customer: { select: { id: true, name: true } },
          },
        },
        bill: {
          select: {
            id: true,
            billNumber: true,
            status: true,
            total: true,
            vendor: { select: { id: true, name: true } },
          },
        },
        recordedBy: { select: { id: true, fullName: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments: payments.map((payment) => ({
      ...mapMoney(payment, ["amount"]),
      direction: payment.invoiceId ? "IN" : "OUT",
      party: payment.invoice?.customer?.name ?? payment.bill?.vendor?.name ?? null,
    })),
    pagination: {
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

export async function getPaymentSummary({ companyId, from, to }) {
  const dateFilter =
    from || to
      ? {
          paymentDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {};

  const [inbound, outbound] = await Promise.all([
    prisma.payment.aggregate({
      where: { companyId, invoiceId: { not: null }, ...dateFilter },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.payment.aggregate({
      where: { companyId, billId: { not: null }, ...dateFilter },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  const totalIn = toNumber(inbound._sum.amount);
  const totalOut = toNumber(outbound._sum.amount);

  return {
    totalIn,
    totalOut,
    net: Number((totalIn - totalOut).toFixed(2)),
    paymentCount: (inbound._count.id || 0) + (outbound._count.id || 0),
  };
}
