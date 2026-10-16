import prisma from "../prisma.js";
import { Decimal, toNumber, mapMoney } from "../utils/money.js";

// Balances are stored as Decimal(12,2), so a remainder below half a cent is
// treated as fully settled rather than leaving a phantom 0.01 balance.
const SETTLED_TOLERANCE = new Decimal("0.01");

const PAYABLE_INVOICE_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"];
const PAYABLE_BILL_STATUSES = ["UNPAID", "PARTIALLY_PAID"];
const PAYMENT_RACE = Symbol("paymentRace");

function paymentConflictError() {
  const err = new Error("Payment conflict, please retry");
  err.status = 409;
  return err;
}

function retryablePaymentRaceError() {
  const err = paymentConflictError();
  err[PAYMENT_RACE] = true;
  return err;
}

async function withPaymentConflictRetry(work) {
  let raced = false;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => work(tx));
    } catch (err) {
      if (err?.[PAYMENT_RACE]) {
        raced = true;
        if (attempt < 3) continue;
        throw paymentConflictError();
      }

      // A retry can observe the competing payment's new state, in which case
      // the normal payable-status check would otherwise hide the lost race.
      if (raced && (err?.status === 400 || err?.status === 404)) {
        throw paymentConflictError();
      }
      throw err;
    }
  }

  throw paymentConflictError();
}

/**
 * Works out the new paid/due amounts and the resulting status for a document
 * after another payment is applied. Returns null when the payment would
 * exceed the outstanding balance.
 */
function applyPayment({ currentPaid, currentDue, documentTotal, paymentAmount }) {
  if (paymentAmount.gt(new Decimal(currentDue || 0))) {
    return null;
  }

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

  return withPaymentConflictRetry(async (tx) => {
    const invoice = await loadInvoiceForPayment(tx, { companyId, invoiceId });

    const result = applyPayment({
      currentPaid: invoice.amountPaid,
      currentDue: invoice.amountDue,
      documentTotal: invoice.grandTotal,
      paymentAmount,
    });

    if (!result) {
      const err = new Error("Payment amount exceeds the outstanding balance.");
      err.status = 400;
      throw err;
    }

    const status = result.isSettled
      ? "PAID"
      : invoice.status === "OVERDUE"
        ? "OVERDUE"
        : "PARTIALLY_PAID";

    const claimed = await tx.invoice.updateMany({
      where: {
        id: invoice.id,
        companyId,
        grandTotal: invoice.grandTotal,
        amountPaid: invoice.amountPaid,
        amountDue: invoice.amountDue,
        status: invoice.status,
      },
      data: { amountPaid: result.amountPaid, amountDue: result.amountDue, status },
    });
    if (claimed.count === 0) throw retryablePaymentRaceError();

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

  return withPaymentConflictRetry(async (tx) => {
    const bill = await loadBillForPayment(tx, { companyId, billId });

    const result = applyPayment({
      currentPaid: bill.amountPaid,
      currentDue: bill.amountDue,
      documentTotal: bill.total,
      paymentAmount,
    });

    if (!result) {
      const err = new Error("Payment amount exceeds the outstanding balance.");
      err.status = 400;
      throw err;
    }

    const status = result.isSettled ? "PAID" : "PARTIALLY_PAID";

    const claimed = await tx.bill.updateMany({
      where: {
        id: bill.id,
        companyId,
        total: bill.total,
        amountPaid: bill.amountPaid,
        amountDue: bill.amountDue,
        status: bill.status,
      },
      data: { amountPaid: result.amountPaid, amountDue: result.amountDue, status },
    });
    if (claimed.count === 0) throw retryablePaymentRaceError();

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
  return withPaymentConflictRetry(async (tx) => {
    const bill = await tx.bill.findFirst({
      where: { id: billId, companyId },
      select: { id: true, companyId: true, vendorId: true, total: true, amountPaid: true, amountDue: true, status: true, billNumber: true },
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

    const claimed = await tx.bill.updateMany({
      where: {
        id: bill.id,
        companyId,
        total: bill.total,
        amountPaid: bill.amountPaid,
        amountDue: bill.amountDue,
        status: bill.status,
      },
      data: { amountPaid: bill.total, amountDue: 0, status: "PAID" },
    });
    if (claimed.count === 0) throw retryablePaymentRaceError();

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
