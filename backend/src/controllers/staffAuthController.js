import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import * as staffInviteService from "../services/staffInviteService.js";
import {
  issueStaffTokenPair,
  rotateStaffRefreshToken,
  revokeStaffRefreshToken,
} from "../services/staffTokenService.js";
import { getAccessCookieOptions, getRefreshCookieOptions } from "../utils/tokens.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes — same policy as customerAuthController.js

// GET /api/staff/verify-invite?token=
export async function verifyInvite(req, res) {
  try {
    const invite = await staffInviteService.verifyInviteToken({ token: req.query.token });
    return res.status(200).json({ success: true, data: invite });
  } catch (err) {
    console.error("verifyInvite error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/staff/accept-invite
export async function acceptInvite(req, res) {
  try {
    const staff = await staffInviteService.acceptInvite(req.body);
    return res.status(200).json({
      success: true,
      message: "Password set. You can now log in.",
      data: { email: staff.email },
    });
  } catch (err) {
    console.error("acceptInvite error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/staff/login
export async function loginStaff(req, res) {
  const { companySlug, email, password } = req.body;

  try {
    const company = await prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const staff = await prisma.staff.findUnique({
      where: { companyId_email: { companyId: company.id, email } },
    });

    // No account, or invite never accepted (passwordHash still null) —
    // same generic message either way so we don't leak which is true.
    if (!staff || !staff.passwordHash) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (staff.lockUntil && staff.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((staff.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked due to repeated failed login attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const passwordMatches = await bcrypt.compare(password, staff.passwordHash);
    if (!passwordMatches) {
      const attempts = staff.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

      await prisma.staff.update({
        where: { id: staff.id },
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

    if (staff.status !== "ACTIVE") {
      return res.status(403).json({ success: false, message: "This account is inactive. Contact the company." });
    }

    await prisma.staff.update({
      where: { id: staff.id },
      data: { failedLoginAttempts: 0, lockUntil: null },
    });

    const { accessToken, refreshCookieValue } = await issueStaffTokenPair({
      staffId: staff.id,
      companyId: staff.companyId,
      req,
    });

    res.cookie("staffAccessToken", accessToken, getAccessCookieOptions());
    res.cookie("staffRefreshToken", refreshCookieValue, getRefreshCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        role: "STAFF",
        staff: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          companyId: staff.companyId,
        },
      },
    });
  } catch (err) {
    console.error("loginStaff error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during login." });
  }
}

// POST /api/staff/refresh
export async function refreshStaffTokens(req, res) {
  try {
    const rotated = await rotateStaffRefreshToken(req.cookies?.staffRefreshToken, req);
    res.cookie("staffAccessToken", rotated.accessToken, getAccessCookieOptions());
    res.cookie("staffRefreshToken", rotated.refreshCookieValue, getRefreshCookieOptions());
    return res.status(200).json({ success: true, message: "Session refreshed." });
  } catch (err) {
    console.error("refreshStaffTokens error:", err);
    res.clearCookie("staffAccessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("staffRefreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });
    return res.status(err.status || 401).json({ success: false, message: err.message || "Unable to refresh session." });
  }
}

// POST /api/staff/logout
export async function logoutStaff(req, res) {
  try {
    await revokeStaffRefreshToken(req.cookies?.staffRefreshToken);
    res.clearCookie("staffAccessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("staffRefreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });
    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("logoutStaff error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during logout." });
  }
}

// GET /api/staff/me
export async function getStaffProfile(req, res) {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: req.staff.staffId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        designation: true,
        department: true,
        status: true,
        isEmailVerified: true,
        createdAt: true,
        companyId: true,
      },
    });
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }
    return res.status(200).json({ success: true, data: staff });
  } catch (err) {
    console.error("getStaffProfile error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}
