import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import * as vendorInviteService from "../services/vendorInviteService.js";
import {
  issueVendorTokenPair,
  rotateVendorRefreshToken,
  revokeVendorRefreshToken,
} from "../services/vendorTokenService.js";
import { getAccessCookieOptions, getRefreshCookieOptions } from "../utils/tokens.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes — same policy as customerAuthController.js

// GET /api/vendor/verify-invite?token=
export async function verifyInvite(req, res) {
  try {
    const invite = await vendorInviteService.verifyInviteToken({ token: req.query.token });
    return res.status(200).json({ success: true, data: invite });
  } catch (err) {
    console.error("verifyInvite error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/vendor/accept-invite
export async function acceptInvite(req, res) {
  try {
    const vendor = await vendorInviteService.acceptInvite(req.body);
    return res.status(200).json({
      success: true,
      message: "Password set. You can now log in.",
      data: { email: vendor.email },
    });
  } catch (err) {
    console.error("acceptInvite error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/vendor/login
export async function loginVendor(req, res) {
  const { companySlug, email, password } = req.body;

  try {
    const company = await prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { companyId_email: { companyId: company.id, email } },
    });

    // No account, or invite never accepted (passwordHash still null) —
    // same generic message either way so we don't leak which is true.
    if (!vendor || !vendor.passwordHash) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (vendor.lockUntil && vendor.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((vendor.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked due to repeated failed login attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const passwordMatches = await bcrypt.compare(password, vendor.passwordHash);
    if (!passwordMatches) {
      const attempts = vendor.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

      await prisma.vendor.update({
        where: { id: vendor.id },
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

    if (vendor.status !== "ACTIVE") {
      return res.status(403).json({ success: false, message: "This account is inactive. Contact the company." });
    }

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { failedLoginAttempts: 0, lockUntil: null },
    });

    const { accessToken, refreshCookieValue } = await issueVendorTokenPair({
      vendorId: vendor.id,
      companyId: vendor.companyId,
      req,
    });

    res.cookie("vendorAccessToken", accessToken, getAccessCookieOptions());
    res.cookie("vendorRefreshToken", refreshCookieValue, getRefreshCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        role: "VENDOR",
        vendor: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
          companyId: vendor.companyId,
        },
      },
    });
  } catch (err) {
    console.error("loginVendor error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during login." });
  }
}

// POST /api/vendor/refresh
export async function refreshVendorTokens(req, res) {
  try {
    const rotated = await rotateVendorRefreshToken(req.cookies?.vendorRefreshToken, req);    res.cookie("vendorAccessToken", rotated.accessToken, getAccessCookieOptions());
    res.cookie("vendorRefreshToken", rotated.refreshCookieValue, getRefreshCookieOptions());
    return res.status(200).json({ success: true, message: "Session refreshed." });
  } catch (err) {
    console.error("refreshVendorTokens error:", err);
    res.clearCookie("vendorAccessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("vendorRefreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });
    return res.status(err.status || 401).json({ success: false, message: err.message || "Unable to refresh session." });
  }
}

// POST /api/vendor/logout
export async function logoutVendor(req, res) {
  try {
    await revokeVendorRefreshToken(req.cookies?.vendorRefreshToken);
    res.clearCookie("vendorAccessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("vendorRefreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });
    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("logoutVendor error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during logout." });
  }
}

// GET /api/vendor/me
export async function getVendorProfile(req, res) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.vendor.vendorId },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        phoneNumber: true,
        status: true,
        isEmailVerified: true,
        createdAt: true,
        companyId: true,
      },
    });
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found." });
    }
    return res.status(200).json({ success: true, data: vendor });
  } catch (err) {
    console.error("getVendorProfile error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}
