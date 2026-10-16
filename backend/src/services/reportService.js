import prisma from "../prisma.js";
import { toNumber } from "../utils/money.js";

// Realised-sales statuses. DRAFT invoices are not yet sent to the customer and
// CANCELLED invoices represent voided transactions, so neither counts toward
// sales for the period.
const SALES_STATUSES = ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"];

// Invoices where the customer still owes money, and bills where we still owe
// the vendor money.
const RECEIVABLE_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"];
const PAYABLE_STATUSES = ["UNPAID", "PARTIALLY_PAID"];

const sumMoney = (rows, field) =>
  toNumber(rows.reduce((total, row) => total + toNumber(row[field]), 0));

function resolveUtcDateRange(from, to) {
  const startOfDay = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  };

  return {
    start: from ? startOfDay(from) : undefined,
    end: to ? new Date(startOfDay(to).getTime() + 24 * 60 * 60 * 1000 - 1) : undefined,
  };
}

export async function getSalesReport({ companyId, from, to }) {
  const range = resolveUtcDateRange(from, to);
  const where = {
    companyId,
    status: { in: SALES_STATUSES },
    invoiceDate: { gte: range.start, lte: range.end },
  };

  const [invoices, groups] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        status: true,
        subtotal: true,
        discountTotal: true,
        taxTotal: true,
        grandTotal: true,
        amountPaid: true,
        amountDue: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.invoice.groupBy({
      by: ["customerId"],
      where,
      _sum: { grandTotal: true, amountPaid: true, amountDue: true },
      _count: { _all: true },
    }),
  ]);

  const customerIds = groups.map((g) => g.customerId);
  const customers = customerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds }, companyId },
        select: { id: true, name: true },
      })
    : [];
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  const byCustomer = groups
    .map((g) => ({
      customer: { id: g.customerId, name: customerMap.get(g.customerId) || "Unknown" },
      invoiceCount: g._count._all,
      grandTotal: toNumber(g._sum.grandTotal),
      amountPaid: toNumber(g._sum.amountPaid),
      amountDue: toNumber(g._sum.amountDue),
    }))
    .sort((a, b) => b.grandTotal - a.grandTotal);

  return {
    from,
    to,
    totals: {
      invoiceCount: invoices.length,
      subtotal: sumMoney(invoices, "subtotal"),
      discountTotal: sumMoney(invoices, "discountTotal"),
      taxTotal: sumMoney(invoices, "taxTotal"),
      grandTotal: sumMoney(invoices, "grandTotal"),
      amountPaid: sumMoney(invoices, "amountPaid"),
      amountDue: sumMoney(invoices, "amountDue"),
    },
    invoices: invoices.map((row) => ({
      ...row,
      subtotal: toNumber(row.subtotal),
      discountTotal: toNumber(row.discountTotal),
      taxTotal: toNumber(row.taxTotal),
      grandTotal: toNumber(row.grandTotal),
      amountPaid: toNumber(row.amountPaid),
      amountDue: toNumber(row.amountDue),
    })),
    byCustomer,
  };
}

export async function getOutstandingReport({ companyId }) {
  const [invoiceGroups, billGroups] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["customerId"],
      where: {
        companyId,
        status: { in: RECEIVABLE_STATUSES },
        amountDue: { gt: 0 },
      },
      _sum: { grandTotal: true, amountPaid: true, amountDue: true },
      _count: { _all: true },
      _min: { dueDate: true },
    }),
    prisma.bill.groupBy({
      by: ["vendorId"],
      where: {
        companyId,
        status: { in: PAYABLE_STATUSES },
        amountDue: { gt: 0 },
      },
      _sum: { total: true, amountPaid: true, amountDue: true },
      _count: { _all: true },
      _min: { dueDate: true },
    }),
  ]);

  const customerIds = invoiceGroups.map((g) => g.customerId);
  const vendorIds = billGroups.map((g) => g.vendorId);

  const [customers, vendors] = await Promise.all([
    customerIds.length
      ? prisma.customer.findMany({ where: { id: { in: customerIds }, companyId }, select: { id: true, name: true } })
      : [],
    vendorIds.length
      ? prisma.vendor.findMany({ where: { id: { in: vendorIds }, companyId }, select: { id: true, name: true } })
      : [],
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c.name]));
  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

  const receivables = invoiceGroups
    .map((g) => ({
      customerId: g.customerId,
      customerName: customerMap.get(g.customerId) || "Unknown",
      invoiceCount: g._count._all,
      totalInvoiced: toNumber(g._sum.grandTotal),
      totalPaid: toNumber(g._sum.amountPaid),
      outstanding: toNumber(g._sum.amountDue),
      oldestDueDate: g._min.dueDate,
    }))
    .sort((a, b) => b.outstanding - a.outstanding);

  const payables = billGroups
    .map((g) => ({
      vendorId: g.vendorId,
      vendorName: vendorMap.get(g.vendorId) || "Unknown",
      billCount: g._count._all,
      totalBilled: toNumber(g._sum.total),
      totalPaid: toNumber(g._sum.amountPaid),
      outstanding: toNumber(g._sum.amountDue),
      oldestDueDate: g._min.dueDate,
    }))
    .sort((a, b) => b.outstanding - a.outstanding);

  const totalReceivable = toNumber(receivables.reduce((s, r) => s + r.outstanding, 0));
  const totalPayable = toNumber(payables.reduce((s, p) => s + p.outstanding, 0));

  return {
    receivables,
    payables,
    totals: {
      totalReceivable,
      totalPayable,
      netPosition: Number((totalReceivable - totalPayable).toFixed(2)),
    },
  };
}
