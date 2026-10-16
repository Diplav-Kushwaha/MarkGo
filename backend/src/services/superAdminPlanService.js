import prisma from "../prisma.js";
import { Decimal, toNumber } from "../utils/money.js";
import { logAuthEvent } from "../utils/auditLogger.js";

/**
 * Super Admin plan management.
 *
 * Editing a plan only ever writes the Plan row. Subscription and
 * SubscriptionPayment rows are never touched here: a subscription snapshots
 * its price and billing cycle when it is created, so changing a plan can never
 * rewrite what an existing company was charged.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PRICE = 10_000_000;
const VALID_CYCLES = ["FREE", "MONTHLY", "YEARLY"];

function httpError(message, status, data) {
  const err = new Error(message);
  err.status = status;
  if (data) err.data = data;
  return err;
}

/** Stored ACTIVE with a past endDate reads as EXPIRED. */
function effectiveStatusOf(subscription, now) {
  if (subscription.status === "ACTIVE" && subscription.endDate) {
    if (new Date(subscription.endDate).getTime() <= now.getTime()) return "EXPIRED";
  }
  return subscription.status;
}

function wholeDaysLeft(endDate) {
  if (!endDate) return null;
  const remaining = new Date(endDate).getTime() - Date.now();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / DAY_MS);
}

/** Shared shape for a plan, so list, create and update all answer alike. */
function planDto(plan, counts = {}) {
  return {
    id: plan.id,
    name: plan.name,
    price: toNumber(plan.price),
    billingCycle: plan.billingCycle,
    durationMonths: plan.durationMonths ?? null,
    description: plan.description ?? null,
    // Null means unlimited.
    limits: {
      users: plan.maxUsers ?? null,
      customers: plan.maxCustomers ?? null,
      vendors: plan.maxVendors ?? null,
      invoices: plan.maxInvoices ?? null,
    },
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    activeSubscriptions: counts.activeSubscriptions ?? 0,
    totalSubscriptions: counts.totalSubscriptions ?? 0,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

/** Shared create/update rules so a plan can never be put in an invalid shape. */
async function assertPlanRules({ name, billingCycle, price, durationMonths }, { currentPlanId } = {}) {
  if (name !== undefined) {
    const trimmed = name.trim();
    // Case-insensitive: MySQL's default collation is already case-insensitive,
    // but checking here keeps the 409 identical on any database. `mode` is
    // deliberately absent - Prisma rejects it on MySQL.
    const clash = await prisma.plan.findFirst({
      where: {
        name: { equals: trimmed },
        ...(currentPlanId ? { id: { not: currentPlanId } } : {}),
      },
      select: { id: true },
    });
    if (clash) throw httpError("A plan with that name already exists.", 409);
  }

  if (billingCycle !== undefined && !VALID_CYCLES.includes(billingCycle)) {
    throw httpError("Billing cycle must be FREE, MONTHLY or YEARLY.", 400);
  }

  if (billingCycle === "FREE") {
    if (price !== undefined && toNumber(price) !== 0) {
      throw httpError("The Free plan must have a price of 0.", 400);
    }
    if (durationMonths !== undefined && durationMonths !== null) {
      throw httpError("The Free plan has no duration.", 400);
    }
  }

  // A paid plan with no duration produces a subscription that never expires,
  // because calculateEndDate returns null for it. `durationMonths` here is always
  // the effective value: createPlan passes the submitted one, updatePlan passes
  // the stored one merged with the patch, so a patch can neither drop the
  // duration nor leave an already-broken paid plan without one.
  if (billingCycle === "MONTHLY" || billingCycle === "YEARLY") {
    if (durationMonths === undefined || durationMonths === null) {
      throw httpError("A paid plan needs a duration of 1 to 120 months.", 400);
    }
  }

  if ((billingCycle === "MONTHLY" || billingCycle === "YEARLY") && price !== undefined) {
    if (toNumber(price) <= 0) {
      throw httpError("A paid plan must have a price greater than 0.", 400);
    }
  }

  if (durationMonths !== undefined && durationMonths !== null) {
    if (!Number.isInteger(durationMonths)) {
      throw httpError("Duration must be a whole number of months.", 400);
    }
    if (billingCycle !== "FREE" && (durationMonths < 1 || durationMonths > 120)) {
      throw httpError("Duration must be between 1 and 120 months.", 400);
    }
  }
}

function assertPriceRange(price) {
  if (price === undefined || price === null) return;
  const value = toNumber(price);
  if (value < 0 || value > MAX_PRICE) {
    throw httpError(`Price must be between 0 and ${MAX_PRICE.toLocaleString("en-IN")}.`, 400);
  }
  if (Math.round(value * 100) !== value * 100) {
    throw httpError("Price may have at most 2 decimal places.", 400);
  }
}

/** GET /api/superadmin/plans — every plan, active or not. */
export async function listPlans() {
  const now = new Date();
  const validWhere = { status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gt: now } }] };

  const [plans, validCounts] = await Promise.all([
    prisma.plan.findMany({
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
      include: { _count: { select: { subscriptions: true } } },
    }),
    prisma.subscription.groupBy({ by: ["planId"], where: validWhere, _count: { _all: true } }),
  ]);

  const validByPlan = new Map(validCounts.map((row) => [row.planId, row._count._all]));

  return {
    plans: plans.map((plan) =>
      planDto(plan, {
        activeSubscriptions: validByPlan.get(plan.id) ?? 0,
        totalSubscriptions: plan._count.subscriptions,
      })
    ),
  };
}

/** POST /api/superadmin/plans */
export async function createPlan(data, { ip } = {}) {
  const {
    name,
    billingCycle,
    price,
    durationMonths,
    description,
    maxUsers,
    maxCustomers,
    maxVendors,
    maxInvoices,
    isActive,
    sortOrder,
  } = data;

  if (!billingCycle) throw httpError("Select a billing cycle.", 400);
  if (price === undefined || price === null) throw httpError("Enter a price.", 400);
  assertPriceRange(price);

  if (billingCycle === "FREE") {
    const existingFree = await prisma.plan.findFirst({ where: { billingCycle: "FREE" } });
    if (existingFree) {
      throw httpError("A Free plan already exists. Edit it instead of adding another.", 409);
    }
  }

  await assertPlanRules(
    { name, billingCycle, price: toNumber(price), durationMonths: durationMonths ?? null },
    {}
  );

  const isFree = billingCycle === "FREE";

  try {
    const plan = await prisma.plan.create({
      data: {
        name: name.trim(),
        price: new Decimal(isFree ? 0 : toNumber(price)),
        description: description || null,
        billingCycle,
        durationMonths: isFree ? null : durationMonths,
        maxUsers: maxUsers ?? null,
        maxCustomers: maxCustomers ?? null,
        maxVendors: maxVendors ?? null,
        maxInvoices: maxInvoices ?? null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    logAuthEvent({
      event: "PLAN_CREATE",
      success: true,
      userId: data.createdByUserId,
      ip,
      reason: `plan:${plan.name}`,
    });

    return planDto(plan);
  } catch (err) {
    // Backstop for the name collision, in case it slipped past the check above.
    if (err.code === "P2002") {
      throw httpError("A plan with that name already exists.", 409);
    }
    throw err;
  }
}

/** PATCH /api/superadmin/plans/:id */
export async function updatePlan(id, data, { ip } = {}) {
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) throw httpError("Plan not found.", 404);

  const {
    name,
    price,
    durationMonths,
    description,
    maxUsers,
    maxCustomers,
    maxVendors,
    maxInvoices,
    isActive,
    sortOrder,
  } = data;

  const hasChange = [
    name,
    price,
    durationMonths,
    description,
    maxUsers,
    maxCustomers,
    maxVendors,
    maxInvoices,
    isActive,
    sortOrder,
  ].some((value) => value !== undefined);

  if (!hasChange) {
    throw httpError("Provide at least one field to update.", 400);
  }

  assertPriceRange(price);

  const isFree = plan.billingCycle === "FREE";

  // Rules are checked against the plan's stored cycle, since billingCycle can
  // never be changed here. durationMonths falls back to the stored value so the
  // rules below judge the plan as it would be after this patch, not just the
  // fields the patch happens to mention.
  await assertPlanRules(
    {
      name,
      billingCycle: plan.billingCycle,
      price: price === undefined ? undefined : toNumber(price),
      durationMonths: durationMonths === undefined ? plan.durationMonths : durationMonths,
    },
    { currentPlanId: plan.id }
  );

  const update = {};
  if (name !== undefined) update.name = name.trim();
  if (description !== undefined) update.description = description || null;
  if (isActive !== undefined) update.isActive = isActive;
  if (sortOrder !== undefined) update.sortOrder = sortOrder;
  if (maxUsers !== undefined) update.maxUsers = maxUsers;
  if (maxCustomers !== undefined) update.maxCustomers = maxCustomers;
  if (maxVendors !== undefined) update.maxVendors = maxVendors;
  if (maxInvoices !== undefined) update.maxInvoices = maxInvoices;

  if (price !== undefined) {
    update.price = new Decimal(isFree ? 0 : toNumber(price));
  }
  if (durationMonths !== undefined) {
    update.durationMonths = isFree ? null : durationMonths;
  }

  const updated = await prisma.plan.update({ where: { id }, data: update });

  logAuthEvent({
    event: "PLAN_UPDATE",
    success: true,
    userId: data.updatedByUserId,
    ip,
    reason: `plan:${updated.name}`,
  });

  const validCount = await prisma.subscription.count({
    where: {
      planId: id,
      status: "ACTIVE",
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
    },
  });

  return {
    ...planDto(updated, { activeSubscriptions: validCount }),
    note: "Existing subscriptions are not affected.",
  };
}