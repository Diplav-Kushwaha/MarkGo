import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import { issueTokenPair, revokeRefreshToken } from "../services/tokenService.js";
import { getAccessCookieOptions, getRefreshCookieOptions } from "../utils/tokens.js";
import { logAuthEvent } from "../utils/auditLogger.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes — same policy as companyAdminAuthController.js

/**
 * POST /api/superadmin/login
 */
export async function loginSuperAdmin(req, res) {
  const { email, password } = req.body;
  const ip = req.ip;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== "SUPERADMIN") {
      logAuthEvent({ event: "LOGIN", success: false, email, ip, reason: "no_such_account" });
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (user.isActive === false) {
      logAuthEvent({ event: "LOGIN", success: false, email, userId: user.id, ip, reason: "inactive_account" });
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

    res.cookie("accessToken", accessToken, getAccessCookieOptions());
    res.cookie("refreshToken", refreshCookieValue, getRefreshCookieOptions());

    logAuthEvent({ event: "LOGIN", success: true, email, userId: user.id, role: user.role, ip });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        company: null,
      },
    });
  } catch (err) {
    console.error("loginSuperAdmin error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during login." });
  }
}

/**
 * POST /api/superadmin/logout
 */
export async function logoutSuperAdmin(req, res) {
  try {
    await revokeRefreshToken(req.cookies?.refreshToken);

    res.clearCookie("accessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("refreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });

    logAuthEvent({ event: "LOGOUT", success: true, userId: req.user?.userId, ip: req.ip });

    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("logoutSuperAdmin error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during logout." });
  }
}

/**
 * GET /api/superadmin/me
 * Protected by authenticateToken + requireSuperAdmin
 */
export async function getSuperAdminProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, fullName: true, phoneNumber: true, role: true, isEmailVerified: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const [totalCompanies, totalUsers] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
    ]);

    return res.status(200).json({
      success: true,
      data: { user, company: null, stats: { totalCompanies, totalUsers } },
    });
  } catch (err) {
    console.error("getSuperAdminProfile error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

// The companies list lives in superAdminController.js / superAdminService.js
// alongside the rest of the platform-wide reads.

