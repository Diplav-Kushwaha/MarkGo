import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import * as customerInviteService from "../services/customerInviteService.js";
import { issueCustomerTokenPair, rotateCustomerRefreshToken, revokeCustomerRefreshToken } from "../services/customerTokenService.js";
import { getAccessCookieOptions, getRefreshCookieOptions } from "../utils/tokens.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes — same policy as companyAdminAuthController.js

// GET /api/customer/verify-invite?token=
export async function verifyInvite(req, res) {
  try {
    const invite = await customerInviteService.verifyInviteToken({ token: req.query.token });
    return res.status(200).json({ success: true, data: invite });
  } catch (err) {
    console.error("verifyInvite error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/customer/accept-invite
export async function acceptInvite(req, res) {
  try {
    const customer = await customerInviteService.acceptInvite(req.body);
    return res.status(200).json({
      success: true,
      message: "Password set. You can now log in.",
      data: { email: customer.email },
    });
  } catch (err) {
    console.error("acceptInvite error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/customer/login
export async function loginCustomer(req, res) {
  const { companySlug, email, password } = req.body;

  try {
    const company = await prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const customer = await prisma.customer.findUnique({
      where: { companyId_email: { companyId: company.id, email } },
    });

    // No account, or invite never accepted (passwordHash still null) —
    // same generic message either way so we don't leak which is true.
    if (!customer || !customer.passwordHash) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (customer.lockUntil && customer.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((customer.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked due to repeated failed login attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const passwordMatches = await bcrypt.compare(password, customer.passwordHash);
    if (!passwordMatches) {
      const attempts = customer.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        },
      });

      if (shouldLock) {
        return res.status(423).json({
          success: false,
          message: "Too many failed attempts. Account locked for 15 minutes.",
        });
      }
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (customer.status !== "ACTIVE") {
      return res.status(403).json({ success: false, message: "This account is inactive. Contact the company." });
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { failedLoginAttempts: 0, lockUntil: null },
    });

    const { accessToken, refreshCookieValue } = await issueCustomerTokenPair({
      customerId: customer.id,
      companyId: customer.companyId,
      req,
    });

    res.cookie("customerAccessToken", accessToken, getAccessCookieOptions());
    res.cookie("customerRefreshToken", refreshCookieValue, getRefreshCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        role: "CUSTOMER",
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          companyId: customer.companyId,
        },
      },
    });
  } catch (err) {
    console.error("loginCustomer error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during login." });
  }
}

// POST /api/customer/refresh
export async function refreshCustomerTokens(req, res) {
  try {
    const rotated = await rotateCustomerRefreshToken(req.cookies?.customerRefreshToken, req);
    res.cookie("customerAccessToken", rotated.accessToken, getAccessCookieOptions());
    res.cookie("customerRefreshToken", rotated.refreshCookieValue, getRefreshCookieOptions());
    return res.status(200).json({ success: true, message: "Session refreshed." });
  } catch (err) {
    console.error("refreshCustomerTokens error:", err);
    res.clearCookie("customerAccessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("customerRefreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });
    return res.status(err.status || 401).json({ success: false, message: err.message || "Unable to refresh session." });
  }
}

// POST /api/customer/logout
export async function logoutCustomer(req, res) {  try {
    await revokeCustomerRefreshToken(req.cookies?.customerRefreshToken);
    res.clearCookie("customerAccessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("customerRefreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });
    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("logoutCustomer error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during logout." });
  }
}

// GET /api/customer/me
export async function getCustomerProfile(req, res) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.customer.customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        status: true,
        isEmailVerified: true,
        createdAt: true,
        companyId: true,
      },
    });
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found." });
    }
    return res.status(200).json({ success: true, data: customer });
  } catch (err) {
    console.error("getCustomerProfile error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}
