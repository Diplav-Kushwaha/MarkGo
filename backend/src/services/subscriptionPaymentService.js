import prisma from "../prisma.js";
import { Decimal, toNumber } from "../utils/money.js";
import { calculateEndDate } from "./subscriptionService.js";
import { isDummyPayment } from "../config/subscription.js";
import { logAuthEvent } from "../utils/auditLogger.js";

/**
 * Subscription payment logic, kept apart from the invoice/bill
 * paymentService.js on purpose so a real gateway can replace this file later.
 *
 * Every amount is copied from the plan row that is already in the database; no
 * amount ever arrives from a request body.
 */

const CLOSED_PAYMENT_STATUS = "FAILED";

/** Payment detail safe to show on the public dummy payment page. */
export async function getPaymentSummary(paymentId) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: {
      plan: { select: { name: true, billingCycle: true } },
      company: { select: { name: true } },
      // Same query, one more relation: lets the page say up front that this link
      // is stale instead of waiting for the user to press "Pay now".
      subscription: { select: { status: true } },
    },
  });

  if (!payment) {
    const err = new Error("Payment not found.");
    err.status = 404;
    throw err;
  }

  return {
    id: payment.id,
    status: payment.status,
    amount: toNumber(payment.amount),
    planName: payment.plan?.name ?? null,
    billingCycle: payment.plan?.billingCycle ?? null,
    companyName: payment.company?.name ?? null,
    // Mirrors the 409 confirmPayment raises, so the page can disable the buttons
    // on a link whose subscription is gone. A FAILED payment whose subscription
    // is still PENDING is NOT replaced: that one can be retried.
    replaced:
      payment.status !== "PAID" &&
      (!payment.subscription || payment.subscription.status !== "PENDING"),
  };
}

/**
 * Creates the PENDING payment for a subscription. Takes the caller's
 * transaction client so it joins whatever the caller is already doing, and is
 * never called with the global client.
 */
export async function createPayment(tx, { subscription, companyId }) {
  return tx.subscriptionPayment.create({
    data: {
      companyId,
      planId: subscription.planId,
      subscriptionId: subscription.id,
      amount: new Decimal(subscription.priceAtPurchase),
      status: "PENDING",
      paymentMethod: "DUMMY",
      note: "Subscription payment",
    },
  });
}

/**
 * Marks a pending payment as paid and activates the subscription.
 *
 * Idempotent: confirming an already-paid payment succeeds and changes nothing.
 * The conditional update means two simultaneous confirmations can only settle
 * the payment once.
 */
export async function confirmPayment(paymentId, { ip } = {}) {
  if (!isDummyPayment) {
    const err = new Error("Dummy payments are disabled.");
    err.status = 403;
    throw err;
  }

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: {
      plan: true,
      subscription: { include: { plan: true } },
      company: { select: { id: true, name: true, status: true } },
    },
  });

  if (!payment) {
    const err = new Error("Payment not found.");
    err.status = 404;
    throw err;
  }

  if (payment.status === "PAID") {
    // Already settled — confirm twice is safe and changes nothing.
    return {
      alreadyPaid: true,
      payment: { id: payment.id, status: payment.status },
      subscription: payment.subscription
        ? { id: payment.subscription.id, status: payment.subscription.status, endDate: payment.subscription.endDate }
        : null,
      companyStatus: payment.company?.status ?? null,
      endDate: payment.subscription?.endDate ?? null,
    };
  }

  if (!["PENDING", "FAILED"].includes(payment.status)) {
    const err = new Error("This payment cannot be confirmed.");
    err.status = 409;
    throw err;
  }

  if (!payment.subscription || payment.subscription.status !== "PENDING") {
    // Almost always a stale link: "Buy plan" again cancels the earlier pending
    // subscription (see closeSubscriptions), so this payment can never settle.
    const err = new Error(
      "This payment link has been replaced by a newer purchase or is no longer valid. Please start again from your Subscription page."
    );
    err.status = 409;
    throw err;
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Conditional settle: only one caller can flip PENDING/FAILED -> PAID.
    const claimed = await tx.subscriptionPayment.updateMany({
      where: { id: paymentId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PAID", paidAt: now },
    });

    if (claimed.count === 0) {
      const current = await tx.subscriptionPayment.findUnique({ where: { id: paymentId } });
      if (current?.status === "PAID") {
        return { alreadyPaid: true, paymentId, subscriptionId: payment.subscription.id };
      }
      const err = new Error("This payment is no longer confirmable.");
      err.status = 409;
      throw err;
    }

    const endDate = calculateEndDate(payment.subscription.plan, now);

    const subscription = await tx.subscription.update({
      where: { id: payment.subscription.id },
      data: { status: "ACTIVE", startDate: now, endDate },
    });

    // Only ever moves a company out of PENDING_PAYMENT. A suspended or
    // cancelled company is never silently reactivated by a payment.
    const activated = await tx.company.updateMany({
      where: { id: payment.companyId, status: "PENDING_PAYMENT" },
      data: { status: "ACTIVE" },
    });

    // The subscription being bought replaces whatever was open; remaining days on
    // the old ones are intentionally not carried over. Their ids are collected
    // first so the payments below can be closed with a flat `in` filter: a Prisma
    // filter object can never contain the field it filters on, and `not: null` is
    // not needed here because SQL already excludes NULL from an `in` list.
    const supersededIds = (
      await tx.subscription.findMany({
        where: {
          companyId: payment.companyId,
          status: { in: ["ACTIVE", "PENDING"] },
          id: { not: subscription.id },
        },
        select: { id: true },
      })
    ).map((row) => row.id);

    if (supersededIds.length > 0) {
      await tx.subscription.updateMany({
        where: { id: { in: supersededIds } },
        data: { status: "CANCELLED" },
      });

      // Only the payments of the subscriptions cancelled just above, so the
      // payment being confirmed here is never touched.
      await tx.subscriptionPayment.updateMany({
        where: {
          companyId: payment.companyId,
          status: "PENDING",
          subscriptionId: { in: supersededIds },
        },
        data: { status: CLOSED_PAYMENT_STATUS },
      });
    }

    const company = await tx.company.findUnique({
      where: { id: payment.companyId },
      select: { status: true },
    });

    return {
      alreadyPaid: false,
      paymentId,
      subscription,
      supersededCount: supersededIds.length,
      companyActivated: activated.count > 0,
      companyStatus: company?.status ?? null,
      endDate,
    };
  });

  if (result.alreadyPaid) {
    logAuthEvent({ event: "SUBSCRIPTION_PAYMENT_CONFIRM", success: true, ip, reason: `already_paid subscription:${result.subscriptionId}` });
    return {
      alreadyPaid: true,
      payment: { id: payment.id, status: "PAID" },
      subscription: { id: payment.subscription.id, status: payment.subscription.status, endDate: payment.subscription.endDate },
      companyStatus: payment.company?.status ?? null,
      endDate: payment.subscription.endDate ?? null,
    };
  }

  logAuthEvent({
    event: "SUBSCRIPTION_PAYMENT_CONFIRM",
    success: true,
    ip,
    reason: `${result.companyActivated ? "company_activated" : "company_not_pending"} subscription:${result.subscription.id}`,
  });

  return {
    alreadyPaid: false,
    payment: { id: payment.id, status: "PAID" },
    subscription: {
      id: result.subscription.id,
      status: result.subscription.status,
      endDate: result.endDate,
    },
    companyStatus: result.companyStatus,
    endDate: result.endDate,
  };
}

/**
 * Marks a pending payment as failed. The subscription stays PENDING so the user
 * can try the dummy payment page again.
 */
export async function failPayment(paymentId, { ip } = {}) {
  if (!isDummyPayment) {
    const err = new Error("Dummy payments are disabled.");
    err.status = 403;
    throw err;
  }

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { subscription: { select: { id: true, status: true } } },
  });

  if (!payment) {
    const err = new Error("Payment not found.");
    err.status = 404;
    throw err;
  }

  if (payment.status === "PAID") {
    const err = new Error("A paid payment cannot be failed.");
    err.status = 409;
    throw err;
  }

  if (payment.status === "FAILED") {
    logAuthEvent({ event: "SUBSCRIPTION_PAYMENT_FAIL", success: true, ip, reason: `already_failed subscription:${payment.subscription?.id ?? "none"}` });
    return {
      alreadyFailed: true,
      payment: { id: payment.id, status: "FAILED" },
      subscriptionStatus: payment.subscription?.status ?? null,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const closed = await tx.subscriptionPayment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: CLOSED_PAYMENT_STATUS },
    });

    if (closed.count === 0) {
      const current = await tx.subscriptionPayment.findUnique({ where: { id: paymentId } });
      if (current?.status === "FAILED") {
        return { alreadyFailed: true, status: "FAILED" };
      }
      const err = new Error("This payment is no longer pending.");
      err.status = 409;
      throw err;
    }

    const subscription = payment.subscription
      ? await tx.subscription.findUnique({ where: { id: payment.subscription.id }, select: { status: true } })
      : null;

    return { alreadyFailed: false, status: "FAILED", subscriptionStatus: subscription?.status ?? null };
  });

  logAuthEvent({
    event: "SUBSCRIPTION_PAYMENT_FAIL",
    success: true,
    ip,
    reason: `${result.alreadyFailed ? "already_failed" : "payment_failed"} subscription:${payment.subscription?.id ?? "none"}`,
  });

  return {
    alreadyFailed: result.alreadyFailed,
    payment: { id: payment.id, status: result.status },
    subscriptionStatus: result.subscriptionStatus,
  };
}