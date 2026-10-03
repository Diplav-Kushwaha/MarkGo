import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import { Decimal, toNumber } from "../utils/money.js";
import { isPasswordComplexEnough, isPasswordBreached } from "../utils/passwordPolicy.js";
import { logAuthEvent } from "../utils/auditLogger.js";
import { calculateEndDate } from "./subscriptionService.js";
import { createPayment } from "./subscriptionPaymentService.js";
import { generateUniqueSlug } from "../controllers/companyAdminAuthController.js";

/**
 * Super Admin creates a company and puts it on a plan in one go.
 *
 * The company/admin creation mirrors the public registration exactly — same slug
 * rules, same password policy, same COMPANY_ADMIN role — by reusing its exported
 * helpers rather than copying them, so the two paths cannot drift apart. What
 * this service does NOT do is the public path's abandoned-pending cleanup: a
 * Super Admin deleting a tenant is an explicit, audited action.
 *
 * Nothing here ever issues a token or cookie, so the Super Admin's own session
 * is untouched and the new admin is never signed in by this API.
 */

const SALT_ROUNDS = 12;

function httpError(message, status, data) {
  const err = new Error(message);
  err.status = status;
  if (data) err.data = data;
  return err;
}

/**
 * Resolves the plan from the database. Money is never taken from the request.
 */
async function requireUsablePlan(planId) {
  if (!planId) throw httpError("Select a plan.", 400);

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw httpError("The selected plan does not exist.", 400);
  if (!plan.isActive) throw httpError("The selected plan is not available right now.", 400);

  return plan;
}

/**
 * POST /api/superadmin/companies
 */
export async function createCompanyWithPlan(body, { ip, userId } = {}) {
  const {
    companyName,
    companyEmail,
    companyAddress,
    gstNumber,
    city,
    country,
    fullName,
    phoneNumber,
    email,
    password,
    planId,
    payment = "MANUAL",
    paymentNote,
  } = body;

  // Same strength rules as public registration, applied before anything is written.
  if (!isPasswordComplexEnough(password)) {
    throw httpError(
      "Password must include upper/lowercase letters, a digit, and a special character.",
      400
    );
  }
  if (await isPasswordBreached(password)) {
    throw httpError(
      "This password has appeared in known data breaches. Please choose a different one.",
      400
    );
  }

  const plan = await requireUsablePlan(planId);
  const isFree = plan.billingCycle === "FREE";
  // A Free plan is always live; payment only decides how a paid plan is settled.
  const useOnline = !isFree && payment === "ONLINE";

  // Duplicate checks, same order and messages as public registration. Nothing is
  // auto-deleted here; a pending blocker is reported instead.
  const [existingUser, existingCompanyByEmail] = await Promise.all([
    prisma.user.findUnique({ where: { email }, include: { company: { select: { id: true, status: true } } } }),
    prisma.company.findUnique({ where: { email: companyEmail } }),
  ]);

  let existingCompanyByGst = null;
  if (gstNumber) {
    existingCompanyByGst = await prisma.company.findUnique({ where: { gstNumber } });
  }

  const pendingHint = (company) => ({
    message:
      "A pending company with this email exists. Delete it first or activate it from the Super Admin screen.",
    companyId: company.id,
  });

  if (existingUser) {
    if (existingUser.company?.status === "PENDING_PAYMENT") {
      throw httpError(
        "An account with this email already exists.",
        409,
        pendingHint(existingUser.company)
      );
    }
    throw httpError("An account with this email already exists.", 409);
  }

  if (existingCompanyByEmail) {
    if (existingCompanyByEmail.status === "PENDING_PAYMENT") {
      throw httpError(
        "A company with this email is already registered.",
        409,
        pendingHint(existingCompanyByEmail)
      );
    }
    throw httpError("A company with this email is already registered.", 409);
  }

  if (existingCompanyByGst) {
    if (existingCompanyByGst.status === "PENDING_PAYMENT") {
      throw httpError(
        "A company with this GST number is already registered.",
        409,
        pendingHint(existingCompanyByGst)
      );
    }
    throw httpError("A company with this GST number is already registered.", 409);
  }

  // Slug collisions are resolved the same way public registration does, so the
  // friendly "matching name/slug" 409 there is covered by the unique index here.
  const slug = await generateUniqueSlug(companyName);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName.trim(),
          slug,
          email: companyEmail,
          address: companyAddress,
          gstNumber: gstNumber || null,
          city,
          country,
          // Online payment waits on the public dummy payment page; everything else
          // is live straight away.
          status: useOnline ? "PENDING_PAYMENT" : "ACTIVE",
        },
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email,
          passwordHash,
          fullName,
          phoneNumber,
          role: "COMPANY_ADMIN",
          isEmailVerified: true,
        },
      });

      const endDate = isFree ? null : calculateEndDate(plan, now);

      const subscription = await tx.subscription.create({
        data: {
          companyId: company.id,
          planId: plan.id,
          status: useOnline ? "PENDING" : "ACTIVE",
          // Snapshotted from the plan row.
          billingCycle: plan.billingCycle,
          priceAtPurchase: new Decimal(isFree ? 0 : toNumber(plan.price)),
          startDate: useOnline ? null : now,
          endDate: useOnline ? null : endDate,
          createdBy: "SUPERADMIN",
        },
      });

      let paymentRow = null;

      if (useOnline) {
        // Same dummy payment row the public paid registration creates.
        paymentRow = await createPayment(tx, { subscription, companyId: company.id });
      } else if (!isFree) {
        // Recorded by hand: paid on the spot, at the plan's database price.
        paymentRow = await tx.subscriptionPayment.create({
          data: {
            companyId: company.id,
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

      return { company, user, subscription, paymentRow, endDate };
    });

    logAuthEvent({
      event: "COMPANY_CREATE",
      success: true,
      userId,
      ip,
      reason: `plan:${plan.name}`,
    });

    return {
      company: {
        id: result.company.id,
        name: result.company.name,
        slug: result.company.slug,
        status: result.company.status,
      },
      subscription: {
        id: result.subscription.id,
        status: result.subscription.status,
        planName: plan.name,
        billingCycle: result.subscription.billingCycle,
        startDate: result.subscription.startDate,
        endDate: result.subscription.endDate,
      },
      payment: result.paymentRow
        ? {
            id: result.paymentRow.id,
            status: result.paymentRow.status,
            amount: toNumber(result.paymentRow.amount),
            paymentMethod: result.paymentRow.paymentMethod,
          }
        : null,
      requiresPayment: useOnline,
    };
  } catch (err) {
    if (err.code === "P2002") {
      throw httpError("Email, company, or GST number already registered.", 409);
    }
    throw err;
  }
}