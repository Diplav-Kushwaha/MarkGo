import prisma from "../prisma.js";
import { toNumber } from "../utils/money.js";

const SALES_STATUSES = ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"];

export async function getDashboardStats({ companyId }) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  // A CANCELLED invoice is neither money owed nor a realised sale, so it is
  // excluded from totalReceivable (via the status list below) and from
  // thisMonthSales. Bills carry no CANCELLED status in the current schema
  // (BillStatus is UNPAID / PARTIALLY_PAID / PAID), so thisMonthExpenses
  // needs no such exclusion.
  const [receivableAgg, payableAgg, monthSalesAgg, monthExpensesAgg, recentInvoices] = await Promise.all([
    prisma.invoice.aggregate({
      where: { companyId, status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
      _sum: { amountDue: true },
    }),
    prisma.bill.aggregate({
      where: { companyId, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      _sum: { amountDue: true },
    }),
    prisma.invoice.aggregate({
      where: {
        companyId,
        invoiceDate: { gte: monthStart, lt: nextMonthStart },
        status: { in: SALES_STATUSES },
      },
      _sum: { grandTotal: true },
    }),
    prisma.bill.aggregate({
      where: { companyId, billDate: { gte: monthStart, lt: nextMonthStart } },
      _sum: { total: true },
    }),
    prisma.invoice.findMany({
      where: { companyId },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        status: true,
        grandTotal: true,
        amountDue: true,
        customer: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    cards: {
      totalReceivable: toNumber(receivableAgg._sum.amountDue),
      totalPayable: toNumber(payableAgg._sum.amountDue),
      thisMonthSales: toNumber(monthSalesAgg._sum.grandTotal),
      thisMonthExpenses: toNumber(monthExpensesAgg._sum.total),
    },
    recentInvoices: recentInvoices.map((inv) => ({
      ...inv,
      grandTotal: toNumber(inv.grandTotal),
      amountDue: toNumber(inv.amountDue),
    })),
  };
}
