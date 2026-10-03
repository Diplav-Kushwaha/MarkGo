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
 *   - zero customers, vendors, invoices, bills, staff and accountants
 */
async function isCleanablePendingCompany(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { status: true },
  });

  if (!company || company.status !== "PENDING_PAYMENT") return false;

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

  return (
    paidPayments === 0 &&
    activeSubscriptions === 0 &&
    customers === 0 &&
    vendors === 0 &&
    invoices === 0 &&
    bills === 0 &&
    staff === 0 &&
    accountants === 0
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

    const proposedSlug = slugify(companyName);

    // Which plan this registration is for. Throws 400 when none is usable.
    const plan = await resolveRegistrationPlan(planId || null);
    const isPaidPlan = plan.billingCycle !== "FREE";

    // Check every unique field up front so we can return one clear error
    // instead of relying solely on the Prisma P2002 catch below.
    const [existingUser, existingCompanyBySlug, existingCompanyByEmail, existingCompanyByGst] =
      await Promise.all([
        prisma.user.findUnique({ where: { email } }),
        prisma.company.findUnique({ where: { slug: proposedSlug } }),
        prisma.company.findUnique({ where: { email: companyEmail } }),
        gstNumber ? prisma.company.findUnique({ where: { gstNumber } }) : null,
      ]);

    // Every company that would block this registration. An abandoned paid
    // registration still owns User.email and Company.email, so a retry would hit
    // the duplicate checks below and never get a chance to clean up — unless the
    // blockage is resolved first.
    const blockingCompanyIds = new Set();
    if (existingUser?.companyId) blockingCompanyIds.add(existingUser.companyId);
    if (existingCompanyBySlug) blockingCompanyIds.add(existingCompanyBySlug.id);
    if (existingCompanyByEmail) blockingCompanyIds.add(existingCompanyByEmail.id);
    if (existingCompanyByGst) blockingCompanyIds.add(existingCompanyByGst.id);

    // Only clean up when EVERY blocking company qualifies. If any one of them is
    // real, active, paid or holds data, nothing is deleted and the duplicate
    // checks below answer exactly as they do today.
    let cleanableCompanyIds = [];
    if (blockingCompanyIds.size > 0) {
      const verdicts = await Promise.all(
        [...blockingCompanyIds].map((id) => isCleanablePendingCompany(id))
      );
      if (verdicts.every(Boolean)) {
        cleanableCompanyIds = [...blockingCompanyIds];
      }
    }

    if (existingUser && cleanableCompanyIds.length === 0) {
      logAuthEvent({ event: "REGISTER", success: false, email, ip, reason: "email_taken" });
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    if (existingCompanyBySlug && cleanableCompanyIds.length === 0) {
      logAuthEvent({ event: "REGISTER", success: false, email, ip, reason: "company_slug_taken" });
      return res.status(409).json({
        success: false,
        message: "A company with a matching name/slug is already registered.",
      });
    }

    if (existingCompanyByEmail && cleanableCompanyIds.length === 0) {
      logAuthEvent({ event: "REGISTER", success: false, email, ip, reason: "company_email_taken" });
      return res.status(409).json({
        success: false,
        message: "A company with this email is already registered.",
      });
    }

    if (existingCompanyByGst && cleanableCompanyIds.length === 0) {
      logAuthEvent({ event: "REGISTER", success: false, email, ip, reason: "gst_taken" });
      return res.status(409).json({
        success: false,
        message: "A company with this GST number is already registered.",
      });
    }

    const slug = await generateUniqueSlug(companyName);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Remove abandoned pending registrations first. Every child of Company is
      // onDelete: Cascade, so deleting the company row removes its users,
      // subscriptions and subscription payments in the same statement.
      for (const blockingId of cleanableCompanyIds) {
        await tx.company.delete({ where: { id: blockingId } });
      }

      const company = await tx.company.create({
        data: {
          name: companyName.trim(),
          slug,
          email: companyEmail,
          address: companyAddress,
          gstNumber: gstNumber || null,
          city,
          country,
          // A paid plan waits for its dummy payment; Free is live immediately.
          status: isPaidPlan ? "PENDING_PAYMENT" : "ACTIVE",
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
          isEmailVerified: true, // no email verification for now — intentional scope cut
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          companyId: company.id,
          planId: plan.id,
          status: isPaidPlan ? "PENDING" : "ACTIVE",
          // Snapshotted from the plan row, never from the request.
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

    logAuthEvent({ event: "REGISTER", success: true, email, userId: result.user.id, role: "COMPANY_ADMIN", ip });

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
      return res.status(409).json({ success: false, message: "Email, company, or GST number already registered." });
    }

    return res.status(500).json({ success: false, message: "Internal server error during registration." });
  }
}

/**
 * POST /api/admin/login
 */
export async function loginCompanyAdmin(req, res) {
  const { email, password } = req.body;
  const ip = req.ip;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user || user.role !== "COMPANY_ADMIN") {
      logAuthEvent({ event: "LOGIN", success: false, email, ip, reason: "no_such_account" });
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      logAuthEvent({ event: "LOGIN", success: false, email, userId: user.id, ip, reason: "locked" });
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
        email,
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

    // Successful login: clear any lockout state and issue a fresh token pair.
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

    logAuthEvent({ event: "LOGIN", success: true, email, userId: user.id, role: user.role, ip });

    if (isMobileClient) {
      // No shared browser cookie jar on mobile — return tokens in the body
      // so the app can store them in secure/encrypted storage.
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
