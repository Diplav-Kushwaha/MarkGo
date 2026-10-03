import prisma from "../prisma.js";
import { Decimal, toNumber } from "../utils/money.js";
import { calculateEndDate } from "./subscriptionService.js";
import { logAuthEvent } from "../utils/auditLogger.js";

/**
 * Super Admin company status changes.
 *
 * Only ACTIVE and SUSPENDED can be set from here. Changing status never touches
 * subscriptions, users or any other company data — the login check that reads
 * this flag arrives in a later step, behind ENFORCE_SUBSCRIPTION.
 */

const SETTABLE_STATUSES = ["ACTIVE", "SUSPENDED"];

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * PATCH /api/superadmin/companies/:id/status
 * Returns { id, name, status, changed }.
 */
export async function setCompanyStatus(companyId, status, { ip, userId } = {}) {
  if (!SETTABLE_STATUSES.includes(status)) {
    throw httpError("Status must be ACTIVE or SUSPENDED.", 400);
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, status: true },
  });

  if (!company) throw httpError("Company not found.", 404);

  // Pending-payment companies are cleaned up elsewhere, and a cancelled company
  // is a final state — neither is flipped from here.
  if (company.status === "PENDING_PAYMENT" || company.status === "CANCELLED") {
    throw httpError(
      company.status === "PENDING_PAYMENT"
        ? "This company has a payment pending and cannot be changed here."
        : "A cancelled company cannot be changed.",
      409
    );
  }

  if (company.status === status) {
    return { id: company.id, name: company.name, status: company.status, changed: false };
  }

  // Conditional update on the status that was read, so two simultaneous
  // requests cannot both win.
  const updated = await prisma.company.updateMany({
    where: { id: companyId, status: company.status },
    data: { status },
  });

  if (updated.count === 0) {
    throw httpError("Company was changed, please reload", 409);
  }

  logAuthEvent({
    event: "COMPANY_STATUS_CHANGE",
    success: true,
    userId,
    ip,
    reason: `${company.name}:${company.status}->${status}`,
  });

  return { id: company.id, name: company.name, status, changed: true };
}

/** Statuses a plan can be assigned to. ACTIVE and SUSPENDED are left alone. */
const ASSIGNABLE_STATUSES = ["ACTIVE", "SUSPENDED", "PENDING_PAYMENT"];

/** Whole days left on a subscription, rounded up. Null when it never expires. */
function wholeDaysLeft(endDate) {
  if (!endDate) return null;
  const remaining = new Date(endDate).getTime() - Date.now();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / DAY_MS);
}

/**
 * POST /api/superadmin/companies/:id/subscription
 *
 * Puts an existing company on a plan with a fresh period starting today, so any
 * remaining days on the old one are lost — `replaced.daysLost` reports that so
 * the Super Admin can see it before confirming.
 *
 * A PENDING_PAYMENT company becomes ACTIVE here: this is how a company that
 * could not pay online is activated.
 */
export async function assignPlanToCompany(
  companyId,
  { planId, payment = "MANUAL", paymentNote },
  { ip, userId } = {}
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, status: true },
  });
  if (!company) throw httpError("Company not found.", 404);
  if (company.status === "CANCELLED") {
    throw httpError("A cancelled company cannot be given a plan.", 409);
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw httpError("The selected plan does not exist.", 400);
  if (!plan.isActive) throw httpError("The selected plan is not available right now.", 400);

  const isFree = plan.billingCycle === "FREE";
  const isComplimentary = !isFree && payment === "NONE";

  const now = new Date();
  const endDate = calculateEndDate(plan, now);

  const result = await prisma.$transaction(async (tx) => {
    // Re-check the company inside the transaction with a conditional update, so a
    // payment confirmed at the same moment cannot slip past.
    const companyWrite = await tx.company.updateMany({
      where: { id: companyId, status: { in: ASSIGNABLE_STATUSES } },
      // Only a pending company is activated; ACTIVE and SUSPENDED keep their status.
      data: { status: "ACTIVE" },
    });

    if (companyWrite.count === 0) {
      throw httpError("Company was changed, please reload", 409);
    }
    const refreshed = await tx.company.findUnique({
      where: { id: companyId },
      select: { status: true },
    });
    const nextCompanyStatus = refreshed?.status ?? "ACTIVE";

    // What is being replaced, so the Super Admin can see what is lost.
    const current = await tx.subscription.findFirst({
      where: {
        companyId,
        status: "ACTIVE",
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true } } },
    });
    const replaced = current
      ? { planName: current.plan?.name ?? null, daysLost: wholeDaysLeft(current.endDate) }
      : null;

    // Cancel every open subscription and close its pending payments.
    const open = await tx.subscription.findMany({
      where: { companyId, status: { in: ["ACTIVE", "PENDING"] } },
      select: { id: true },
    });
    for (const subscription of open) {
      await tx.subscriptionPayment.updateMany({
        where: { subscriptionId: subscription.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: "CANCELLED" },
      });
    }

    const subscription = await tx.subscription.create({
      data: {
        companyId,
        planId: plan.id,
        status: "ACTIVE",
        billingCycle: plan.billingCycle,
        // Database price, except a complimentary grant which is worth nothing.
        priceAtPurchase: new Decimal(isComplimentary ? 0 : toNumber(plan.price)),
        startDate: now,
        endDate,
        createdBy: "SUPERADMIN",
      },
    });

    let paymentRow = null;
    // Only a paid plan recorded by hand produces a payment row.
    if (!isFree && !isComplimentary) {
      paymentRow = await tx.subscriptionPayment.create({
        data: {
          companyId,
          planId: plan.id,
          subscriptionId: subscription.id,
          amount: new Decimal(toNumber(plan.price)),
          status: "PAID",
          paidAt: now,
          paymentMethod: "MANUAL",
          note: paymentNote || null,
        },
      });
    }

    return { subscription, paymentRow, replaced, companyStatus: nextCompanyStatus };
  });

  logAuthEvent({
    event: "SUBSCRIPTION_ASSIGN",
    success: true,
    userId,
    ip,
    reason: `${company.name}:${plan.name}`,
  });

  return {
    company: { id: company.id, name: company.name, status: result.companyStatus },
    subscription: {
      id: result.subscription.id,
      status: result.subscription.status,
      planName: plan.name,
      billingCycle: result.subscription.billingCycle,
      priceAtPurchase: toNumber(result.subscription.priceAtPurchase),
      startDate: result.subscription.startDate,
      endDate: result.subscription.endDate,
    },
    payment: result.paymentRow
      ? {
          id: result.paymentRow.id,
          amount: toNumber(result.paymentRow.amount),
          paymentMethod: result.paymentRow.paymentMethod,
        }
      : null,
    replaced: result.replaced,
  };
}

/**
 * Every reason a pending company may not be deleted. Returns null when it is
 * safe to remove. Same conditions as the registration path's
 * isCleanablePendingCompany, but reporting which one failed.
 */
async function pendingBlockReason(companyId) {
  const [paidPayments, activeSubscriptions, customers, vendors, invoices, bills, staff, accountants] =
    await Promise.all([
      prisma.subscriptionPayment.count({ where: { companyId, status: "PAID" } }),
      prisma.subscription.count({ where: { companyId, status: "ACTIVE" } }),
      prisma.customer.count({ where: { companyId } }),
      prisma.vendor.count({ where: { companyId } }),
      prisma.invoice.count({ where: { companyId } }),
      prisma.bill.count({ where: { companyId } }),
      prisma.staff.count({ where: { companyId } }),
      prisma.accountant.count({ where: { companyId } }),
    ]);

  if (paidPayments > 0) return "it has a paid subscription payment";
  if (activeSubscriptions > 0) return "it has an active subscription";
  if (customers > 0) return `it has ${customers} customer record(s)`;
  if (vendors > 0) return `it has ${vendors} vendor record(s)`;
  if (invoices > 0) return `it has ${invoices} invoice(s)`;
  if (bills > 0) return `it has ${bills} bill(s)`;
  if (staff > 0) return `it has ${staff} staff member(s)`;
  if (accountants > 0) return `it has ${accountants} accountant(s)`;
  return null;
}

/**
 * DELETE /api/superadmin/companies/:id/pending
 *
 * Removes an abandoned pending registration. One company.delete does the whole
 * job: every child of Company is onDelete Cascade, so SubscriptionPayment,
 * Subscription, User, Customer, Vendor, Staff, Accountant, Item, Invoice, Bill,
 * Payment and CompanySettings all go with it.
 */
export async function deletePendingCompany(companyId, { ip, userId } = {}) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, status: true },
  });
  if (!company) throw httpError("Company not found.", 404);

  if (company.status !== "PENDING_PAYMENT") {
    throw httpError(
      `This company cannot be deleted because it is not awaiting payment (status ${company.status}).`,
      409
    );
  }

  const reason = await pendingBlockReason(companyId);
  if (reason) {
    throw httpError(`This pending company cannot be deleted because ${reason}.`, 409);
  }

  // Re-check inside the transaction so a payment confirmed a moment ago cannot
  // be deleted along with the company.
  const deleted = await prisma.$transaction(async (tx) => {
    const blocked = await pendingBlockReason(companyId);
    if (blocked) {
      throw httpError(`This pending company cannot be deleted because ${blocked}.`, 409);
    }

    const result = await tx.company.deleteMany({
      where: { id: companyId, status: "PENDING_PAYMENT" },
    });

    if (result.count === 0) {
      throw httpError("Company was changed, please reload", 409);
    }

    return result.count === 1;
  });

  if (!deleted) throw httpError("Company was changed, please reload", 409);

  logAuthEvent({
    event: "COMPANY_PENDING_DELETE",
    success: true,
    userId,
    ip,
    reason: `company:${companyId}`,
  });

  return { id: companyId, deleted: true };
}