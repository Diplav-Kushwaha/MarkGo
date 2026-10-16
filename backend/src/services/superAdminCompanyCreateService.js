import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import { Decimal, toNumber } from "../utils/money.js";
import { isPasswordComplexEnough, isPasswordBreached } from "../utils/passwordPolicy.js";
import { logAuthEvent } from "../utils/auditLogger.js";
import { calculateEndDate } from "./subscriptionService.js";
import { createPayment } from "./subscriptionPaymentService.js";
import { generateUniqueSlug } from "../controllers/companyAdminAuthController.js";
import { normalizePhone, invalidPhoneError } from "../utils/phone.js";

const SALT_ROUNDS = 12;

function httpError(message, status, data) {
  const err = new Error(message);
  err.status = status;
  if (data) err.data = data;
  return err;
}

async function requireUsablePlan(planId) {
  if (!planId) throw httpError("Select a plan.", 400);

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw httpError("The selected plan does not exist.", 400);
  if (!plan.isActive) throw httpError("The selected plan is not available right now.", 400);

  return plan;
}

export async function createCompanyWithPlan(body, { ip, userId } = {}) {
  const {
    companyName,
    companyEmail,
    companyAddress,
    state,
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

  const normalizedPhone = normalizePhone(phoneNumber);
  if (!normalizedPhone) {
    throw invalidPhoneError();
  }

  const plan = await requireUsablePlan(planId);
  const isFree = plan.billingCycle === "FREE";
  const useOnline = !isFree && payment === "ONLINE";

  const [existingUserByPhone, existingCompanyByEmail] = await Promise.all([
    prisma.user.findUnique({ where: { phoneNumber: normalizedPhone }, include: { company: { select: { id: true, status: true } } } }),
    companyEmail ? prisma.company.findUnique({ where: { email: companyEmail.toLowerCase() } }) : null,
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

  if (existingUserByPhone) {
    if (existingUserByPhone.company?.status === "PENDING_PAYMENT") {
      throw httpError(
        "An account with this phone number already exists.",
        409,
        pendingHint(existingUserByPhone.company)
      );
    }
    throw httpError("An account with this phone number already exists.", 409);
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

  const slug = await generateUniqueSlug(companyName);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName.trim(),
          slug,
          email: companyEmail?.toLowerCase() || null,
          address: companyAddress,
          state: state || null,
          gstNumber: gstNumber || null,
          city: city || null,
          country: country || null,
          status: useOnline ? "PENDING_PAYMENT" : "ACTIVE",
        },
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email: email?.toLowerCase() || null,
          passwordHash,
          fullName,
          phoneNumber: normalizedPhone,
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
          billingCycle: plan.billingCycle,
          priceAtPurchase: new Decimal(isFree ? 0 : toNumber(plan.price)),
          startDate: useOnline ? null : now,
          endDate: useOnline ? null : endDate,
          createdBy: "SUPERADMIN",
        },
      });

      let paymentRow = null;

      if (useOnline) {
        paymentRow = await createPayment(tx, { subscription, companyId: company.id });
      } else if (!isFree) {
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
      throw httpError("Phone, company, or GST number already registered.", 409);
    }
    throw err;
  }
}