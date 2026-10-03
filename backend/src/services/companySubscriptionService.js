import prisma from "../prisma.js";
import { Decimal, toNumber } from "../utils/money.js";
import {
  getCurrentSubscription,
  getSubscriptionLimits,
  getSubscriptionState,
} from "./subscriptionService.js";
import { createPayment } from "./subscriptionPaymentService.js";
import { getUsage } from "./subscriptionUsageService.js";
import { logAuthEvent } from "../utils/auditLogger.js";

/**
 * Company-admin facing subscription operations.
 *
 * Every function takes the companyId of the logged-in user. Nothing here reads a
 * company id from a request, so one company can never see or change another's
 * subscription. Nothing here enforces plan limits or blocks anything — that is a
 * later step, behind ENFORCE_SUBSCRIPTION.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_PAYMENT_STATUS = "FAILED";
const INACTIVE_COMPANY_MESSAGE = "Your company is inactive. Please contact platform support.";

function httpError(message, status, data) {
  const err = new Error(message);
  err.status = status;
  if (data) err.data = data;
  return err;
}

/** Whole days left, rounded up. Null when it never expires. */
function wholeDaysLeft(endDate) {
  if (!endDate) return null;
  const remaining = new Date(endDate).getTime() - Date.now();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / DAY_MS);
}

/** Stored ACTIVE with a past endDate reads as EXPIRED. */
function effectiveStatusOf(subscription) {
  if (subscription.status === "ACTIVE" && subscription.endDate) {
    if (new Date(subscription.endDate).getTime() <= Date.now()) return "EXPIRED";
  }
  return subscription.status;
}

/** Closes a set of subscriptions and any payments still pending against them. */
async function closeSubscriptions(tx, subscriptions) {
  for (const subscription of subscriptions) {
    await tx.subscriptionPayment.updateMany({
      where: { subscriptionId: subscription.id, status: "PENDING" },
      data: { status: CLOSED_PAYMENT_STATUS },
    });
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED" },
    });
  }
}

/** GET /api/admin/subscription — the company's current subscription. */
export async function getMySubscription({ companyId }) {
  const state = await getSubscriptionState(companyId);
  const usage = await getUsage(companyId);

  return {
    state: state.state,
    subscription: state.subscription
      ? {
          id: state.subscription.id,
          status: state.subscription.status,
          planId: state.subscription.planId,
          planName: state.subscription.plan?.name ?? null,
          billingCycle: state.subscription.billingCycle,
          priceAtPurchase: toNumber(state.subscription.priceAtPurchase),
          startDate: state.subscription.startDate,
          endDate: state.subscription.endDate,
          daysLeft: wholeDaysLeft(state.subscription.endDate),
        }
      : null,
    limits: getSubscriptionLimits(state.plan),
    usage,
  };
}

/** GET /api/admin/subscription/history — every subscription, newest first. */
export async function getMyHistory({ companyId, page = 1, pageSize = 10 }) {
  const where = { companyId };

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        plan: { select: { name: true } },
        payments: {
          orderBy: { createdAt: "asc" },
          select: {
            amount: true,
            status: true,
            paymentMethod: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.subscription.count({ where }),
  ]);

  return {
    items: subscriptions.map((subscription) => ({
      id: subscription.id,
      planName: subscription.plan?.name ?? null,
      billingCycle: subscription.billingCycle,
      priceAtPurchase: toNumber(subscription.priceAtPurchase),
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      createdBy: subscription.createdBy,
      status: subscription.status,
      effectiveStatus: effectiveStatusOf(subscription),
      daysLeft: wholeDaysLeft(subscription.endDate),
      payments: subscription.payments.map((payment) => ({
        amount: toNumber(payment.amount),
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      })),
    })),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

/**
 * POST /api/admin/subscription/purchase — buy or renew a paid plan.
 *
 * Nothing is activated here: the new subscription stays PENDING and the public
 * dummy payment page settles it. The subscription already in force keeps running
 * until that payment succeeds, so the company is never left without access.
 */
export async function purchasePlan({ companyId, userId, planId }) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, status: true },
  });
  if (!company) throw httpError("Company not found.", 404);
  if (company.status !== "ACTIVE") throw httpError(INACTIVE_COMPANY_MESSAGE, 403);

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw httpError("The selected plan does not exist.", 400);
  if (!plan.isActive) throw httpError("The selected plan is not available right now.", 400);
  if (plan.billingCycle === "FREE") {
    throw httpError("To move to the Free plan, use the start-free option instead.", 400);
  }

  // What the buyer is giving up, so the frontend can warn them first.
  const current = await getCurrentSubscription(companyId);
  const replacesActiveSubscription = Boolean(
    current && current.plan?.billingCycle !== "FREE"
  );
  const daysLost = replacesActiveSubscription ? wholeDaysLeft(current.endDate) : null;

  const result = await prisma.$transaction(async (tx) => {
    // Buying again replaces an earlier unpaid attempt rather than stacking up.
    const stalePending = await tx.subscription.findMany({
      where: { companyId, status: "PENDING" },
      select: { id: true },
    });
    await closeSubscriptions(tx, stalePending);

    const subscription = await tx.subscription.create({
      data: {
        companyId,
        planId: plan.id,
        status: "PENDING",
        billingCycle: plan.billingCycle,
        // Price always copied from the plan row.
        priceAtPurchase: new Decimal(plan.price),
        startDate: null,
        endDate: null,
        createdBy: "SELF",
      },
    });

    const payment = await createPayment(tx, { subscription, companyId });

    return { subscription, payment };
  });

  logAuthEvent({
    event: "SUBSCRIPTION_PURCHASE",
    success: true,
    userId,
    reason: `plan:${plan.name}`,
  });

  return {
    subscription: {
      id: result.subscription.id,
      status: result.subscription.status,
      planName: plan.name,
      billingCycle: result.subscription.billingCycle,
    },
    payment: { id: result.payment.id, amount: toNumber(result.payment.amount) },
    requiresPayment: true,
    replacesActiveSubscription,
    daysLost,
  };
}

/**
 * POST /api/admin/subscription/start-free — move onto the Free plan.
 *
 * Existing company data is never touched, even when the company is already over
 * the Free limits: enforcement is a separate, switchable step.
 */
export async function startFree({ companyId, userId, confirm = false }) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, status: true },
  });
  if (!company) throw httpError("Company not found.", 404);
  if (company.status !== "ACTIVE") throw httpError(INACTIVE_COMPANY_MESSAGE, 403);

  const freePlan = await prisma.plan.findFirst({
    where: { billingCycle: "FREE", isActive: true },
  });
  if (!freePlan) throw httpError("The Free plan is not available right now.", 400);

  const current = await getCurrentSubscription(companyId);

  if (current && current.plan?.billingCycle === "FREE") {
    throw httpError("You are already on the Free plan.", 409);
  }

  if (current && confirm !== true) {
    const days = wholeDaysLeft(current.endDate);
    if (days !== null && days > 0) {
      throw httpError(
        `You still have ${days} days left on ${current.plan.name}. ` +
          "Switching to Free ends it now. Send confirm: true to continue.",
        409,
        { daysLeft: days, planName: current.plan.name }
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const open = await tx.subscription.findMany({
      where: { companyId, status: { in: ["ACTIVE", "PENDING"] } },
      select: { id: true },
    });
    await closeSubscriptions(tx, open);

    // Re-check inside the transaction so two simultaneous requests cannot both
    // believe they are the first to put this company on Free.
    const now = new Date();
    const alreadyFree = await tx.subscription.findFirst({
      where: {
        companyId,
        status: "ACTIVE",
        plan: { billingCycle: "FREE" },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      select: { id: true },
    });
    if (alreadyFree) throw httpError("You are already on the Free plan.", 409);

    const subscription = await tx.subscription.create({
      data: {
        companyId,
        planId: freePlan.id,
        status: "ACTIVE",
        billingCycle: "FREE",
        priceAtPurchase: new Decimal(0),
        startDate: now,
        endDate: null,
        createdBy: "SELF",
      },
    });

    return { subscription };
  });

  logAuthEvent({
    event: "SUBSCRIPTION_START_FREE",
    success: true,
    userId,
    reason: `plan:${freePlan.name}`,
  });

  return {
    subscription: {
      id: result.subscription.id,
      status: result.subscription.status,
      planName: freePlan.name,
      billingCycle: result.subscription.billingCycle,
    },
    requiresPayment: false,
  };
}