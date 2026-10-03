import crypto from "crypto";
import prisma from "../prisma.js";
import {
  generateAccessToken,
  generateRefreshTokenValue,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from "../utils/tokens.js";

export async function issueStaffTokenPair({ staffId, companyId, req }) {
  const { token: accessToken } = generateAccessToken({
    userId: staffId,
    role: "STAFF",
    companyId,
  });
  const refreshCookieValue = generateRefreshTokenValue();
  const tokenHash = hashRefreshToken(refreshCookieValue);

  await prisma.staffRefreshToken.create({
    data: {
      staffId,
      tokenHash,
      jti: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      ipAddress: req?.ip,
      userAgent: req?.headers?.["user-agent"],
    },
  });
  return { accessToken, refreshCookieValue };
}

export async function rotateStaffRefreshToken(rawToken, req) {
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.staffRefreshToken.findUnique({
    where: { tokenHash },
    include: { staff: true },
  });
  if (!existing) {
    return { error: "not_found" };
  }
  if (existing.revoked || existing.expiresAt < new Date()) {
    await prisma.staffRefreshToken.updateMany({
      where: { staffId: existing.staffId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
    return { error: "reuse_detected", staffId: existing.staffId };
  }
  await prisma.staffRefreshToken.update({
    where: { id: existing.id },
    data: { revoked: true, revokedAt: new Date() },
  });

  const { accessToken, refreshCookieValue } = await issueStaffTokenPair({
    staffId: existing.staff.id,
    companyId: existing.staff.companyId,
    req,
  });
  return { accessToken, refreshCookieValue, staff: existing.staff };
}

export async function revokeStaffRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.staffRefreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });
}
