import prisma from "../prisma.js";
import {
  Decimal,
  toNumber,
  mapMoney,
  INVOICE_MONEY_FIELDS,
  INVOICE_ITEM_MONEY_FIELDS,
} from "../utils/money.js";
import { getSettings, generateDocumentNumber, isDocumentNumberUniqueConflict } from "./settingsService.js";
import { recordInvoicePayment } from "./paymentService.js";

// Drafts that were never sent are the only invoices that may be removed, and
// only while they carry no payments. Anything else stays on record.
async function assertRemovableDraft(invoice, verb) {
  if (invoice.status !== "DRAFT") {
    const err = new Error(`Only draft invoices can be ${verb}.`);
    err.status = 409;
    throw err;
  }

  const paymentCount = await prisma.payment.count({ where: { invoiceId: invoice.id } });
  if (paymentCount > 0) {
    const err = new Error("This invoice is linked to a recorded payment and cannot be removed.");
    err.status = 409;
    throw err;
  }
}

/**
 * Preconditions shared by the `cancel` and `void` actions. An invoice may only
 * leave the books unpaid-and-cancelled while nothing has been settled against
 * it, so a paid invoice — or any invoice carrying payments — is refused.
 * `verb` is the past-tense word used in the message ("cancelled" / "voided").
 */
function assertCancellable(invoice, verb) {
  if (invoice.status === "CANCELLED") {
    const err = new Error("This invoice is already cancelled.");
    err.status = 400;
    throw err;
  }
  if (invoice.status === "PAID") {
    const err = new Error(`A paid invoice cannot be ${verb}.`);
    err.status = 400;
    throw err;
  }
  // Covers PARTIALLY_PAID, and any invoice whose payments are still outstanding.
  if (new Decimal(invoice.amountPaid || 0).gt(0)) {
    const err = new Error(
      `An invoice with payments cannot be ${verb}. Reverse the payments first.`
    );
    err.status = 409;
    throw err;
  }
}

/**
 * Applies a signed delta to the customer's denormalised invoice totals.
 *
 * Both deltas go through Prisma's atomic `increment` (a negative value is how
 * you decrement), so two simultaneous writes add up instead of overwriting each
 * other, and no floating-point arithmetic ever touches money — the deltas stay
 * Prisma Decimals.
 */
function adjustCustomerInvoiceTotals(tx, customerId, { totalInvoicedDelta, outstandingBalanceDelta }) {
  return tx.customer.update({
    where: { id: customerId },
    data: {
      totalInvoiced: { increment: new Decimal(totalInvoicedDelta) },
      outstandingBalance: { increment: new Decimal(outstandingBalanceDelta) },
    },
  });
}

/**
 * Calculate totals for invoice items. `defaultTaxPercent` comes from Settings
 * and is applied to any line that does not carry its own rate.
 */
function calculateTotals(items, defaultTaxPercent = 0) {
  let subtotal = new Decimal(0);
  let discountTotal = new Decimal(0);
  let taxTotal = new Decimal(0);

  const processedItems = items.map((item) => {
    const quantity = new Decimal(item.quantity);
    const unitPrice = new Decimal(item.unitPrice);
    const taxRate =
      item.taxRate === null || item.taxRate === undefined || item.taxRate === ""
        ? new Decimal(defaultTaxPercent)
        : new Decimal(item.taxRate);
    const discount = new Decimal(item.discount || 0);

    const baseAmount = quantity.times(unitPrice);
    const amountAfterDiscount = baseAmount.minus(discount);
    const taxAmount = amountAfterDiscount.times(taxRate.dividedBy(100));
    const lineTotal = amountAfterDiscount.plus(taxAmount);

    subtotal = subtotal.plus(baseAmount);
    discountTotal = discountTotal.plus(discount);
    taxTotal = taxTotal.plus(taxAmount);

    return {
      ...item,
      taxRate,
      lineTotal,
    };
  });

  const grandTotal = subtotal.minus(discountTotal).plus(taxTotal);

  return {
    processedItems,
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
  };
}

function buildItemCreates(processedItems) {
  return processedItems.map((item) => ({
    itemType: item.itemType,
    itemId: item.itemId,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate,
    discount: item.discount ?? 0,
    lineTotal: item.lineTotal,
  }));
}

function sameInvoiceLine(line, existing) {
  const decimalMatches = (left, right) =>
    new Decimal(left ?? 0).equals(new Decimal(right ?? 0));

  return (
    (line.itemId ?? null) === (existing.itemId ?? null) &&
    line.itemType === existing.itemType &&
    String(line.description ?? "").trim() === String(existing.description ?? "").trim() &&
    decimalMatches(line.quantity, existing.quantity) &&
    decimalMatches(line.unitPrice, existing.unitPrice) &&
    decimalMatches(line.taxRate, existing.taxRate) &&
    decimalMatches(line.discount, existing.discount)
  );
}

function assertInvoiceItemTypes(items, dbItems, existingLines = []) {
  const itemById = new Map(dbItems.map((item) => [item.id, item]));
  const unmatchedExistingLines = [...existingLines];

  items.forEach((line, index) => {
    const unchangedLineIndex = unmatchedExistingLines.findIndex((existing) =>
      sameInvoiceLine(line, existing)
    );

    if (unchangedLineIndex !== -1) {
      unmatchedExistingLines.splice(unchangedLineIndex, 1);
      return;
    }

    if (!line.itemId) return;
    const item = itemById.get(line.itemId);
    if (item && line.itemType !== item.type) {
      const err = new Error(`Line ${index + 1} type does not match the selected product or service.`);
      err.status = 400;
      throw err;
    }
  });
}

export async function createInvoice({ companyId, userId, payload }) {
  const { customerId, items, invoiceDate, dueDate, ...rest } = payload;
  // Invoice currency comes from CompanySettings; the stored value is a
  // snapshot so later settings changes do not rewrite existing invoices.
  delete rest.currency;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId, isDeleted: false },
  });
  if (!customer) {
    const err = new Error("Customer not found or access denied.");
    err.status = 404;
    throw err;
  }

  const itemIds = items.filter((i) => i.itemId).map((i) => i.itemId);
  if (itemIds.length > 0) {
    const dbItems = await prisma.item.findMany({
      where: { id: { in: itemIds }, companyId, isDeleted: false },
      select: { id: true, name: true, salesPrice: true, taxRate: true, type: true },
    });
    if (dbItems.length !== new Set(itemIds).size) {
      const err = new Error("One or more products/services not found or access denied.");
      err.status = 400;
      throw err;
    }
    assertInvoiceItemTypes(items, dbItems);
  }

  const settings = await getSettings({ companyId });
  const issueDate = invoiceDate ? new Date(invoiceDate) : new Date();
  // Fall back to the company's payment terms when the caller omits a due date.
  const due = dueDate
    ? new Date(dueDate)
    : new Date(issueDate.getTime() + (settings.defaultPaymentTermsDays || 0) * 24 * 60 * 60 * 1000);

  const { processedItems, subtotal, discountTotal, taxTotal, grandTotal } = calculateTotals(
    items,
    Number(settings.defaultTaxPercent)
  );

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const invoiceNumber = await generateDocumentNumber(tx, companyId, "invoice");

        const invoice = await tx.invoice.create({
          data: {
            companyId,
            customerId,
            invoiceNumber,
            invoiceDate: issueDate,
            dueDate: due,
            ...rest,
            currency: settings.currency || "INR",
            subtotal,
            discountTotal,
            taxTotal,
            grandTotal,
            amountDue: grandTotal,
            createdById: userId,
            items: { create: buildItemCreates(processedItems) },
          },
          include: { items: true, customer: true },
        });

        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalInvoiced: { increment: grandTotal },
            outstandingBalance: { increment: grandTotal },
            lastInvoiceDate: issueDate,
          },
        });

        return invoice;
      });
    } catch (err) {
      if (!isDocumentNumberUniqueConflict(err, "invoiceNumber")) throw err;
      if (attempt === 3) {
        const conflict = new Error("Invoice number conflict, please retry.");
        conflict.status = 409;
        throw conflict;
      }
    }
  }
}

export async function listInvoices({
  companyId,
  status,
  customerId,
  from,
  to,
  overdue,
  search,
  page = 1,
  pageSize = 20,
}) {
  const where = {
    companyId,
    ...(status ? { status } : {}),
    ...(customerId ? { customerId } : {}),
    ...(overdue === "true"
      ? { status: { in: ["SENT", "PARTIALLY_PAID"] }, dueDate: { lt: new Date() } }
      : {}),
    ...(from || to
      ? {
          invoiceDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(search && search.trim()
      ? {
          OR: [
            { invoiceNumber: { contains: search.trim() } },
            { notes: { contains: search.trim() } },
            { customer: { name: { contains: search.trim() } } },
            { customer: { email: { contains: search.trim() } } },
          ],
        }
      : {}),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    prisma.invoice.count({ where }),
  ]);

  return {
    invoices: invoices.map((inv) => mapMoney(inv, INVOICE_MONEY_FIELDS)),
    pagination: {
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

export async function getInvoiceSummary({ companyId }) {
  const now = new Date();

  const [aggregates, outstanding, overdueAggregates] = await Promise.all([
    prisma.invoice.aggregate({
      where: { companyId, status: { not: "CANCELLED" } },
      _sum: { grandTotal: true, amountPaid: true, amountDue: true },
      _count: { id: true },
    }),
    prisma.invoice.aggregate({
      where: { companyId, status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
      _sum: { amountDue: true },
      _count: { id: true },
    }),
    prisma.invoice.aggregate({
      where: {
        companyId,
        status: { in: ["SENT", "PARTIALLY_PAID"] },
        dueDate: { lt: now },
      },
      _sum: { amountDue: true },
      _count: { id: true },
    }),
  ]);

  return {
    totalInvoiced: toNumber(aggregates._sum.grandTotal),
    totalPaid: toNumber(aggregates._sum.amountPaid),
    totalOutstanding: toNumber(outstanding._sum.amountDue),
    outstandingCount: outstanding._count.id || 0,
    overdueCount: overdueAggregates._count.id || 0,
    overdueAmount: toNumber(overdueAggregates._sum.amountDue),
  };
}

export async function getInvoiceById({ companyId, id }) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      payments: {
        orderBy: { paymentDate: "desc" },
        include: { recordedBy: { select: { id: true, fullName: true } } },
      },
      customer: true,
      company: true,
    },
  });

  if (!invoice) {
    const err = new Error("Invoice not found.");
    err.status = 404;
    throw err;
  }

  return {
    ...mapMoney(invoice, INVOICE_MONEY_FIELDS),
    items: invoice.items.map((item) => mapMoney(item, INVOICE_ITEM_MONEY_FIELDS)),
    payments: invoice.payments.map((p) => mapMoney(p, ["amount"])),
  };
}

export async function updateInvoice({ companyId, id, payload }) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId },
  });

  if (!invoice) {
    const err = new Error("Invoice not found.");
    err.status = 404;
    throw err;
  }

  if (invoice.status !== "DRAFT") {
    const err = new Error("Only draft invoices can be edited.");
    err.status = 409;
    throw err;
  }

  const { items, ...rest } = payload;
  const updateData = { ...rest };
  // Currency is a document snapshot and cannot be changed through invoice edit.
  delete updateData.currency;
  // Status belongs to handleStatusAction only. updateInvoiceSchema already omits
  // it, so this is defence in depth for any caller that reaches the service
  // directly.
  delete updateData.status;

  // A draft may be re-pointed at another customer of this company. When that
  // happens the old customer is reversed in full and the new one is credited in
  // full, rather than applying a difference.
  const targetCustomerId = updateData.customerId ?? invoice.customerId;
  const customerChanged = targetCustomerId !== invoice.customerId;

  // Runs inside the transaction below, before the invoice write.
  const assertTargetCustomer = async (tx) => {
    if (!customerChanged) return;
    const target = await tx.customer.findFirst({
      where: { id: targetCustomerId, companyId, isDeleted: false },
      select: { id: true },
    });
    if (!target) {
      const err = new Error("Customer not found or access denied.");
      err.status = 404;
      throw err;
    }
  };

  // A draft never carries payments, so its contribution to the customer's
  // outstandingBalance is always its grandTotal and the same delta applies to
  // both totals.
  const settleTotals = async (tx, newGrandTotal) => {
    const oldTotal = new Decimal(invoice.grandTotal);
    const nextTotal = new Decimal(newGrandTotal);

    if (customerChanged) {
      await adjustCustomerInvoiceTotals(tx, invoice.customerId, {
        totalInvoicedDelta: oldTotal.negated(),
        outstandingBalanceDelta: oldTotal.negated(),
      });
      await adjustCustomerInvoiceTotals(tx, targetCustomerId, {
        totalInvoicedDelta: nextTotal,
        outstandingBalanceDelta: nextTotal,
      });
      return;
    }

    const delta = nextTotal.minus(oldTotal);
    // Nothing moved — leave the customer completely untouched.
    if (delta.isZero()) return;

    await adjustCustomerInvoiceTotals(tx, invoice.customerId, {
      totalInvoicedDelta: delta,
      outstandingBalanceDelta: delta,
    });
  };

  if (items) {
    const settings = await getSettings({ companyId });
    const { processedItems, subtotal, discountTotal, taxTotal, grandTotal } = calculateTotals(
      items,
      Number(settings.defaultTaxPercent)
    );

    return prisma.$transaction(async (tx) => {
      await assertTargetCustomer(tx);

      if (items.some((i) => i.itemId)) {
        const itemIds = [...new Set(items.filter((i) => i.itemId).map((i) => i.itemId))];
        const dbItems = await tx.item.findMany({
          where: { id: { in: itemIds }, companyId, isDeleted: false },
          select: { id: true, type: true },
        });
        if (dbItems.length !== itemIds.length) {
          const err = new Error("One or more products/services not found or access denied.");
          err.status = 400;
          throw err;
        }

        const existingLines = await tx.invoiceItem.findMany({
          where: { invoiceId: id },
          select: {
            itemType: true,
            itemId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            taxRate: true,
            discount: true,
          },
        });
        assertInvoiceItemTypes(items, dbItems, existingLines);
      }

      // Conditional write on the totals we computed. Two edits of the same draft
      // would otherwise each measure their difference from the same old
      // grandTotal and both apply it. This only matches while the row still holds
      // the grandTotal we read, and locks it for the rest of the transaction.
      const claimed = await tx.invoice.updateMany({
        where: {
          id,
          companyId,
          status: "DRAFT",
          grandTotal: invoice.grandTotal,
        },
        data: {
          ...updateData,
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          amountDue: grandTotal,
        },
      });

      // Lost the race: someone else saved this draft first. Nothing was written
      // and no balance moved.
      if (claimed.count === 0) {
        const err = new Error("Invoice was changed by someone else. Please reload.");
        err.status = 409;
        throw err;
      }

      // We hold the row lock now, so replacing the line items cannot interleave.
      if (items) {
        await tx.invoice.update({
          where: { id },
          data: {
            items: {
              deleteMany: {},
              create: buildItemCreates(processedItems),
            },
          },
        });
      }

      await settleTotals(tx, grandTotal);

      return tx.invoice.findFirst({ where: { id }, include: { items: true } });
    });
  }

  // Without items the total cannot change, but the customer can still be
  // re-pointed, so this path still needs the guard, the conditional write and
  // the move.
  return prisma.$transaction(async (tx) => {
    await assertTargetCustomer(tx);

    const claimed = await tx.invoice.updateMany({
      where: {
        id,
        companyId,
        status: "DRAFT",
        grandTotal: invoice.grandTotal,
      },
      data: updateData,
    });

    if (claimed.count === 0) {
      const err = new Error("Invoice was changed by someone else. Please reload.");
      err.status = 409;
      throw err;
    }

    await settleTotals(tx, invoice.grandTotal);

    return tx.invoice.findFirst({ where: { id }, include: { items: true } });
  });
}

export async function deleteInvoice({ companyId, id }) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId },
  });

  if (!invoice) {
    const err = new Error("Invoice not found.");
    err.status = 404;
    throw err;
  }

  await assertRemovableDraft(invoice, "deleted");

  // A draft contributes its full grandTotal to the customer's totals (see
  // createInvoice), so removing it has to take that contribution back out.
  //
  // deleteMany matches only while the row still holds the values we read, and
  // takes an exclusive row lock, so two simultaneous deletes cannot both remove
  // the invoice or both decrement the customer. InvoiceItem rows go with it via
  // the onDelete: Cascade on the relation.
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.invoice.deleteMany({
      where: {
        id,
        companyId,
        status: "DRAFT",
        grandTotal: invoice.grandTotal,
        amountDue: invoice.amountDue,
      },
    });

    // Lost the race, or the row is already gone. Nothing was written and no
    // balance moved.
    if (deleted.count === 0) {
      const err = new Error("Invoice was changed or already deleted.");
      err.status = 409;
      throw err;
    }

    await adjustCustomerInvoiceTotals(tx, invoice.customerId, {
      totalInvoicedDelta: new Decimal(invoice.grandTotal).negated(),
      outstandingBalanceDelta: new Decimal(invoice.amountDue).negated(),
    });

    return invoice;
  });
}

export async function handleStatusAction({ companyId, userId, id, action }) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId },
  });

  if (!invoice) {
    const err = new Error("Invoice not found.");
    err.status = 404;
    throw err;
  }

  let newStatus = invoice.status;

  if (action === "send") {
    if (invoice.status !== "DRAFT") {
      const err = new Error("Only draft invoices can be sent.");
      err.status = 400;
      throw err;
    }
    newStatus = "SENT";
  } else if (action === "cancel" || action === "void") {
    const verb = action === "void" ? "voided" : "cancelled";

    // The guard and the write share one transaction, and the invoice is re-read
    // inside it, so a payment recorded between the initial read above and this
    // write cannot slip past the check.
    return prisma.$transaction(async (tx) => {
      const current = await tx.invoice.findFirst({
        where: { id, companyId },
        select: { customerId: true, status: true, amountPaid: true, grandTotal: true, amountDue: true },
      });

      if (!current) {
        const err = new Error("Invoice not found.");
        err.status = 404;
        throw err;
      }

      // Runs before any balance change, so an already-cancelled invoice can never
      // be reversed twice.
      assertCancellable(current, verb);

      // Conditional write. It only matches while the row still holds exactly the
      // values we just read, and the UPDATE takes an exclusive row lock for the
      // rest of this transaction. A cancel racing us blocks here, then matches
      // zero rows, so the customer balance is reversed exactly once.
      const claimed = await tx.invoice.updateMany({
        where: {
          id,
          companyId,
          status: { not: "CANCELLED" },
          amountPaid: new Decimal(0),
          grandTotal: current.grandTotal,
          amountDue: current.amountDue,
        },
        // A cancelled invoice is not owed, so its balance is cleared. Without
        // this the invoice list keeps showing a full "Amount due" for an invoice
        // the receivables report correctly excludes, which reads as a missing
        // total on the dashboard.
        data: { status: "CANCELLED", amountDue: 0 },
      });

      // Lost the race: another request changed this invoice first. Nothing was
      // written and no balance moved.
      if (claimed.count === 0) {
        const err = new Error("This invoice was changed by someone else. Please reload and try again.");
        err.status = 409;
        throw err;
      }

      // Give the money back to the customer this invoice inflated when it was
      // created.
      await adjustCustomerInvoiceTotals(tx, current.customerId, {
        totalInvoicedDelta: new Decimal(current.grandTotal).negated(),
        outstandingBalanceDelta: new Decimal(current.amountDue).negated(),
      });

      return tx.invoice.findUnique({ where: { id } });
    });
  } else if (action === "mark_paid") {
    return prisma.$transaction(async (tx) => {
      // Re-read inside the transaction: the amount settled below has to be the
      // balance still on the row, not the one from the initial read.
      const current = await tx.invoice.findFirst({
        where: { id, companyId },
        select: { id: true, customerId: true, status: true, grandTotal: true, amountDue: true },
      });

      if (!current) {
        const err = new Error("Invoice not found.");
        err.status = 404;
        throw err;
      }

      // An invoice that was cancelled or already settled cannot be settled again.
      if (current.status === "CANCELLED") {
        const err = new Error("A cancelled invoice cannot be marked as paid.");
        err.status = 400;
        throw err;
      }
      if (current.status === "PAID") {
        const err = new Error("This invoice is already marked as paid.");
        err.status = 400;
        throw err;
      }

      const outstanding = new Decimal(current.amountDue);
      if (outstanding.lte(0)) {
        const err = new Error("This invoice has no outstanding balance.");
        err.status = 400;
        throw err;
      }

      // Conditional write on the status and balance we just read. Two requests
      // settling at once would otherwise both create a payment and both move the
      // customer; only one can match, and it locks the row for the transaction.
      const settled = await tx.invoice.updateMany({
        where: {
          id,
          companyId,
          status: current.status,
          grandTotal: current.grandTotal,
          amountDue: current.amountDue,
        },
        data: { status: "PAID", amountPaid: current.grandTotal, amountDue: 0 },
      });

      // Lost the race: nothing was written and no balance moved.
      if (settled.count === 0) {
        const err = new Error("Invoice was changed, please reload.");
        err.status = 409;
        throw err;
      }

      // Record the settlement as a real payment for the remaining balance, the
      // same way markBillAsPaid settles a bill, so sum(payments) keeps matching
      // the invoice. Any earlier partial payments are left untouched.
      await tx.payment.create({
        data: {
          companyId,
          invoiceId: current.id,
          amount: outstanding,
          method: "OTHER",
          note: "Marked as paid",
          paymentDate: new Date(),
          recordedById: userId,
        },
      });

      await tx.customer.update({
        where: { id: current.customerId },
        data: {
          totalPaid: { increment: outstanding },
          outstandingBalance: { decrement: outstanding },
        },
      });

      return tx.invoice.findUnique({ where: { id } });
    });
  }

  return prisma.invoice.update({ where: { id }, data: { status: newStatus } });
}

/**
 * Records a payment against an invoice and recomputes its balance and status.
 * Delegates to the shared payment service so invoices and bills behave
 * identically and both write to the single `payments` table.
 */
export async function recordPayment({ companyId, userId, id, payload }) {
  return recordInvoicePayment({ companyId, userId, invoiceId: id, payload });
}

export async function duplicateInvoice({ companyId, userId, id }) {
  const original = await prisma.invoice.findFirst({
    where: { id, companyId },
    include: { items: true },
  });

  if (!original) {
    const err = new Error("Invoice not found.");
    err.status = 404;
    throw err;
  }

  const settings = await getSettings({ companyId });
  const invoiceDate = new Date();
  const dueDate = new Date(
    invoiceDate.getTime() + (settings.defaultPaymentTermsDays || 0) * 24 * 60 * 60 * 1000
  );

  return prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateDocumentNumber(tx, companyId, "invoice");

    const duplicate = await tx.invoice.create({
      data: {
        companyId,
        customerId: original.customerId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        status: "DRAFT",
        subtotal: original.subtotal,
        discountTotal: original.discountTotal,
        taxTotal: original.taxTotal,
        grandTotal: original.grandTotal,
        amountPaid: 0,
        amountDue: original.grandTotal,
        currency: original.currency,
        notes: original.notes,
        termsAndConditions: original.termsAndConditions,
        createdById: userId,
        items: {
          create: buildItemCreates(
            original.items.map((item) => ({
              itemType: item.itemType,
              itemId: item.itemId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              discount: item.discount,
              lineTotal: item.lineTotal,
            }))
          ),
        },
      },
      include: { items: true },
    });

    // The duplicate is a real, unpaid invoice, so the customer is credited for
    // it exactly the way createInvoice credits a new one. Its own payments are
    // not copied — amountPaid stays 0.
    await adjustCustomerInvoiceTotals(tx, original.customerId, {
      totalInvoicedDelta: duplicate.grandTotal,
      outstandingBalanceDelta: duplicate.grandTotal,
    });

    return duplicate;
  });
}
