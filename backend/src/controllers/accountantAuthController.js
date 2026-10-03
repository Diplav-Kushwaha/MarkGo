import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import * as accountantInviteService from "../services/accountantInviteService.js";
import {
  issueAccountantTokenPair,
  rotateAccountantRefreshToken,
  revokeAccountantRefreshToken,
} from "../services/accountantTokenService.js";
import { getAccessCookieOptions, getRefreshCookieOptions } from "../utils/tokens.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes — same policy as customerAuthController.js

// GET /api/accountant/verify-invite?token=
export async function verifyInvite(req, res) {
  try {
    const invite = await accountantInviteService.verifyInviteToken({ token: req.query.token });
    return res.status(200).json({ success: true, data: invite });
  } catch (err) {
    console.error("verifyInvite error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/accountant/accept-invite
export async function acceptInvite(req, res) {
  try {
    const accountant = await accountantInviteService.acceptInvite(req.body);
    return res.status(200).json({
      success: true,
      message: "Password set. You can now log in.",
      data: { email: accountant.email },
    });
  } catch (err) {
    console.error("acceptInvite error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/accountant/login
export async function loginAccountant(req, res) {
  const { companySlug, email, password } = req.body;

  try {
    const company = await prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const accountant = await prisma.accountant.findUnique({
      where: { companyId_email: { companyId: company.id, email } },
    });

    // No account, or invite never accepted (passwordHash still null) —
    // same generic message either way so we don't leak which is true.
    if (!accountant || !accountant.passwordHash) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (accountant.lockUntil && accountant.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((accountant.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked due to repeated failed login attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const passwordMatches = await bcrypt.compare(password, accountant.passwordHash);
    if (!passwordMatches) {
      const attempts = accountant.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

      await prisma.accountant.update({
        where: { id: accountant.id },
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

    if (accountant.status !== "ACTIVE") {
      return res.status(403).json({ success: false, message: "This account is inactive. Contact the company." });
    }

    await prisma.accountant.update({
      where: { id: accountant.id },
      data: { failedLoginAttempts: 0, lockUntil: null },
    });

    const { accessToken, refreshCookieValue } = await issueAccountantTokenPair({
      accountantId: accountant.id,
      companyId: accountant.companyId,
      req,
    });

    res.cookie("accountantAccessToken", accessToken, getAccessCookieOptions());
    res.cookie("accountantRefreshToken", refreshCookieValue, getRefreshCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        role: "ACCOUNTANT",
        accountant: {
          id: accountant.id,
          name: accountant.name,
          email: accountant.email,
          companyId: accountant.companyId,
        },
      },
    });
  } catch (err) {
    console.error("loginAccountant error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during login." });
  }
}

// POST /api/accountant/refresh
export async function refreshAccountantTokens(req, res) {
  try {
    const rotated = await rotateAccountantRefreshToken(req.cookies?.accountantRefreshToken, req);
    res.cookie("accountantAccessToken", rotated.accessToken, getAccessCookieOptions());
    res.cookie("accountantRefreshToken", rotated.refreshCookieValue, getRefreshCookieOptions());
    return res.status(200).json({ success: true, message: "Session refreshed." });
  } catch (err) {
    console.error("refreshAccountantTokens error:", err);
    res.clearCookie("accountantAccessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("accountantRefreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });
    return res.status(err.status || 401).json({ success: false, message: err.message || "Unable to refresh session." });
  }
}

// POST /api/accountant/logout
export async function logoutAccountant(req, res) {
  try {
    await revokeAccountantRefreshToken(req.cookies?.accountantRefreshToken);
    res.clearCookie("accountantAccessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("accountantRefreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });
    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("logoutAccountant error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during logout." });
  }
}

// GET /api/accountant/me
export async function getAccountantProfile(req, res) {
  try {
    const accountant = await prisma.accountant.findUnique({
      where: { id: req.accountant.accountantId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        licenseNumber: true,
        experience: true,
        status: true,
        isEmailVerified: true,
        createdAt: true,
        companyId: true,
      },
    });
    if (!accountant) {
      return res.status(404).json({ success: false, message: "Accountant not found." });
    }
    return res.status(200).json({ success: true, data: accountant });
  } catch (err) {
    console.error("getAccountantProfile error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}
