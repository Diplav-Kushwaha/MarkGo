// src/controllers/companyAdminAuthController.js

import crypto from "crypto";
import bcrypt from "bcrypt";
import { Decimal, toNumber } from "../utils/money.js";
import prisma from "../prisma.js";
import { issueTokenPair } from "../services/tokenService.js";
import { revokeRefreshToken } from "../services/tokenService.js";
import { getAccessCookieOptions, getRefreshCookieOptions } from "../utils/tokens.js";
import { isPasswordComplexEnough, isPasswordBreached } from "../utils/passwordPolicy.js";
import { logAuthEvent } from "../utils/auditLogger.js";
import { createPayment } from "../services/subscriptionPaymentService.js";
import { normalizePhone, INVALID_PHONE_MESSAGE } from "../utils/phone.js";

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 120 * 60 * 1000; // 120 minutes

/**
 * Converts a company name into a URL-safe, unique-ish base slug.
 * e.g. "Acme Corp!" -> "acme-corp"
 */
// Exported so the Super Admin company-create path can generate slugs with the
// exact same rules instead of copying them. Behaviour is unchanged.
export function slugify(name) {
  return name
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Ensures the generated slug is unique by appending a short random
 * suffix if a collision is found.
 */
// Exported for the same reason as slugify — no behaviour change.
export async function generateUniqueSlug(companyName) {
  const baseSlug = slugify(companyName) || "company";
  let slug = baseSlug;
  let attempt = 0;

  while (await prisma.company.findUnique({ where: { slug } })) {
    attempt += 1;
    const suffix = crypto.randomBytes(3).toString("hex");
    slug = `${baseSlug}-${suffix}`;
    if (attempt > 5) break;
  }

  return slug;
}

/**
 * Resolves the plan a registration should use.
 *
 * With no planId the active FREE plan is chosen, so a caller that never heard of
 * plans still registers exactly as before. The price always comes from the plan
 * row; nothing about money is taken from the request.
 */
async function resolveRegistrationPlan(planId) {
  if (planId) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });

    if (!plan) {
      const err = new Error("The selected plan does not exist.");
      err.status = 400;
      throw err;
    }
    if (!plan.isActive) {
      const err = new Error("The selected plan is not available right now.");
      err.status = 400;
      throw err;
    }
    return plan;
  }

  const freePlan = await prisma.plan.findFirst({
    where: { billingCycle: "FREE", isActive: true },
  });

  if (!freePlan) {
    const err = new Error("Please select a plan");
    err.status = 400;
    throw err;
  }

  return freePlan;
}

/**
 * Decides whether a company blocking this registration is an abandoned
 * pending registration that is safe to remove.
 *
 * ALL of these must hold, so a company that is real, paid or holding any
 * bookkeeping data is never touched:
 *   - status is PENDING_PAYMENT
 *   - no PAID subscription payment
 *   - no ACTIVE subscription
 *   - zero customers, vendors, invoices, bills
 */
async function isCleanablePendingCompany(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { status: true },
  });

  if (!company || company.status !== "PENDING_PAYMENT") return false;

  const [paidPayments, activeSubscriptions, customers, vendors, invoices, bills] =
    await Promise.all([
      prisma.subscriptionPayment.count({ where: { companyId, status: "PAID" } }),
      prisma.subscription.count({ where: { companyId, status: "ACTIVE" } }),
      prisma.customer.count({ where: { companyId } }),
      prisma.vendor.count({ where: { companyId } }),
      prisma.invoice.count({ where: { companyId } }),
      prisma.bill.count({ where: { companyId } }),
    ]);

  return (
    paidPayments === 0 &&
    activeSubscriptions === 0 &&
    customers === 0 &&
    vendors === 0 &&
    invoices === 0 &&
    bills === 0
  );
}

/**
 * POST /api/admin/register
 * req.body is already validated + normalized (trimmed, lowercased emails,
 * uppercased GST number) by the `validate(registerSchema)` middleware
 * mounted on this route.
 */
export async function registerCompanyAdmin(req, res) {
  const {
    // company profile fields
    companyName,
    companyEmail,
    companyAddress,
    state,
    gstNumber,
    city,
    country,
    // owner/admin (User) fields
    fullName,
    phoneNumber,
    email,
    password,
    planId,
  } = req.body;
  const ip = req.ip;

  try {
    if (!isPasswordComplexEnough(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must include upper/lowercase letters, a digit, and a special character.",
      });
    }

    const breached = await isPasswordBreached(password);
    if (breached) {
      return res.status(400).json({
        success: false,
        message: "This password has appeared in known data breaches. Please choose a different one.",
      });
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: INVALID_PHONE_MESSAGE });
    }

    const proposedSlug = slugify(companyName);

    // Which plan this registration is for. Throws 400 when none is usable.
    const plan = await resolveRegistrationPlan(planId || null);
    const isPaidPlan = plan.billingCycle !== "FREE";

    // Check unique fields: phone (global for User), slug, companyEmail, gstNumber
    const [existingUserByPhone, existingCompanyBySlug, existingCompanyByEmail, existingCompanyByGst] =
      await Promise.all([
        prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } }),
        prisma.company.findUnique({ where: { slug: proposedSlug } }),
        companyEmail ? prisma.company.findUnique({ where: { email: companyEmail.toLowerCase() } }) : null,
        gstNumber ? prisma.company.findUnique({ where: { gstNumber } }) : null,
      ]);

    const blockingCompanyIds = new Set();
    if (existingUserByPhone?.companyId) blockingCompanyIds.add(existingUserByPhone.companyId);
    if (existingCompanyBySlug) blockingCompanyIds.add(existingCompanyBySlug.id);
    if (existingCompanyByEmail) blockingCompanyIds.add(existingCompanyByEmail.id);
    if (existingCompanyByGst) blockingCompanyIds.add(existingCompanyByGst.id);

    let cleanableCompanyIds = [];
    if (blockingCompanyIds.size > 0) {
      const verdicts = await Promise.all(
        [...blockingCompanyIds].map((id) => isCleanablePendingCompany(id))
      );
      if (verdicts.every(Boolean)) {
        cleanableCompanyIds = [...blockingCompanyIds];
      }
    }

    if (existingUserByPhone && cleanableCompanyIds.length === 0) {
      logAuthEvent({ event: "REGISTER", success: false, phone: normalizedPhone, ip, reason: "phone_taken" });
      return res.status(409).json({ success: false, message: "An account with this phone number already exists." });
    }

    if (existingCompanyBySlug && cleanableCompanyIds.length === 0) {
      logAuthEvent({ event: "REGISTER", success: false, phone: normalizedPhone, ip, reason: "company_slug_taken" });
      return res.status(409).json({
        success: false,
        message: "A company with a matching name/slug is already registered.",
      });
    }

    if (existingCompanyByEmail && cleanableCompanyIds.length === 0) {
      logAuthEvent({ event: "REGISTER", success: false, phone: normalizedPhone, ip, reason: "company_email_taken" });
      return res.status(409).json({
        success: false,
        message: "A company with this email is already registered.",
      });
    }

    if (existingCompanyByGst && cleanableCompanyIds.length === 0) {
      logAuthEvent({ event: "REGISTER", success: false, phone: normalizedPhone, ip, reason: "gst_taken" });
      return res.status(409).json({
        success: false,
        message: "A company with this GST number is already registered.",
      });
    }

    const slug = await generateUniqueSlug(companyName);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      for (const blockingId of cleanableCompanyIds) {
        await tx.company.delete({ where: { id: blockingId } });
      }

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
          status: isPaidPlan ? "PENDING_PAYMENT" : "ACTIVE",
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

      const subscription = await tx.subscription.create({
        data: {
          companyId: company.id,
          planId: plan.id,
          status: isPaidPlan ? "PENDING" : "ACTIVE",
          billingCycle: plan.billingCycle,
          priceAtPurchase: new Decimal(isPaidPlan ? plan.price : 0),
          startDate: isPaidPlan ? null : now,
          endDate: null,
          createdBy: "SELF",
        },
      });

      const payment = isPaidPlan ? await createPayment(tx, { subscription, companyId: company.id }) : null;

      return { company, user, subscription, payment, plan };
    });

    logAuthEvent({ event: "REGISTER", success: true, phone: normalizedPhone, userId: result.user.id, role: "COMPANY_ADMIN", ip });

    return res.status(201).json({
      success: true,
      message: "Registration successful. You can now log in.",
      data: {
        company: {
          id: result.company.id,
          name: result.company.name,
          slug: result.company.slug,
          email: result.company.email,
          address: result.company.address,
          gstNumber: result.company.gstNumber,
          city: result.company.city,
          country: result.company.country,
        },
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          phoneNumber: result.user.phoneNumber,
        },
        subscription: {
          id: result.subscription.id,
          status: result.subscription.status,
          planName: result.plan.name,
          billingCycle: result.subscription.billingCycle,
        },
        requiresPayment: isPaidPlan,
        ...(isPaidPlan && result.payment
          ? { payment: { id: result.payment.id, amount: toNumber(result.payment.amount) } }
          : {}),
      },
    });
  } catch (err) {
    console.error("registerCompanyAdmin error:", err);

    if (err.code === "P2002") {
      return res.status(409).json({ success: false, message: "Phone, company, or GST number already registered." });
    }

    return res.status(500).json({ success: false, message: "Internal server error during registration." });
  }
}

/**
 * POST /api/admin/login
 */
export async function loginCompanyAdmin(req, res) {
  const { phoneNumber, password } = req.body;
  const ip = req.ip;

  try {
    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: INVALID_PHONE_MESSAGE });
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
      include: { company: true },
    });

    if (!user || user.role !== "COMPANY_ADMIN") {
      logAuthEvent({ event: "LOGIN", success: false, phone: normalizedPhone, ip, reason: "no_such_account" });
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (user.isActive === false) {
      logAuthEvent({ event: "LOGIN", success: false, phone: normalizedPhone, userId: user.id, ip, reason: "inactive_account" });
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      logAuthEvent({ event: "LOGIN", success: false, phone: normalizedPhone, userId: user.id, ip, reason: "locked" });
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked due to repeated failed login attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        },
      });

      logAuthEvent({
        event: "LOGIN",
        success: false,
        phone: normalizedPhone,
        userId: user.id,
        ip,
        reason: shouldLock ? "locked_out" : "bad_password",
      });

      if (shouldLock) {
        return res.status(423).json({
          success: false,
          message: "Too many failed attempts. Account locked for 15 minutes.",
        });
      }

      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockUntil: null },
    });

    const { accessToken, refreshCookieValue } = await issueTokenPair({
      userId: user.id,
      role: user.role,
      companyId: user.companyId,
      req,
    });

    const isMobileClient = req.headers["x-client-type"] === "mobile";
    const responseUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role,
    };
    const responseCompany = user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
          email: user.company.email,
          address: user.company.address,
          gstNumber: user.company.gstNumber,
          city: user.company.city,
          country: user.company.country,
        }
      : null;

    logAuthEvent({ event: "LOGIN", success: true, phone: normalizedPhone, userId: user.id, role: user.role, ip });

    if (isMobileClient) {
      return res.status(200).json({
        success: true,
        message: "Login successful.",
        data: {
          user: responseUser,
          company: responseCompany,
          accessToken,
          refreshToken: refreshCookieValue,
        },
      });
    }

    res.cookie("accessToken", accessToken, getAccessCookieOptions());
    res.cookie("refreshToken", refreshCookieValue, getRefreshCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: { user: responseUser, company: responseCompany },
    });
  } catch (err) {
    console.error("loginCompanyAdmin error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during login." });
  }
}

/**
 * POST /api/admin/logout
 */
export async function logoutCompanyAdmin(req, res) {
  try {
    await revokeRefreshToken(req.cookies?.refreshToken);

    res.clearCookie("accessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("refreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });

    logAuthEvent({ event: "LOGOUT", success: true, userId: req.user?.userId, ip: req.ip });

    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("logoutCompanyAdmin error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during logout." });
  }
}

/**
 * GET /api/admin/me
 * Protected by authenticateToken + requireCompanyAdmin
 */
export async function getCompanyAdminProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            address: true,
            gstNumber: true,
            city: true,
            country: true,
            currency: true,
            financialYearStart: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Company Admin not found." });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
        },
        company: user.company,
      },
    });
  } catch (err) {
    console.error("getCompanyAdminProfile error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}
