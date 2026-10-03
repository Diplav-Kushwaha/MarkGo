import crypto from "crypto";
import prisma from "../prisma.js";
import {
  generateAccessToken,
  generateRefreshTokenValue,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from "../utils/tokens.js";

export async function issueVendorTokenPair({ vendorId, companyId, req }) {
  const { token: accessToken } = generateAccessToken({
    userId: vendorId,
    role: "VENDOR",
    companyId,
  });
  const refreshCookieValue = generateRefreshTokenValue();
  const tokenHash = hashRefreshToken(refreshCookieValue);

  await prisma.vendorRefreshToken.create({
    data: {
      vendorId,
      tokenHash,
      jti: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      ipAddress: req?.ip,
      userAgent: req?.headers?.["user-agent"],
    },
  });
  return { accessToken, refreshCookieValue };
}

export async function rotateVendorRefreshToken(rawToken, req) {
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.vendorRefreshToken.findUnique({
    where: { tokenHash },
    include: { vendor: true },
  });
  if (!existing) {
    return { error: "not_found" };
  }
  if (existing.revoked || existing.expiresAt < new Date()) {
    await prisma.vendorRefreshToken.updateMany({
      where: { vendorId: existing.vendorId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
    return { error: "reuse_detected", vendorId: existing.vendorId };
  }
  await prisma.vendorRefreshToken.update({
    where: { id: existing.id },
    data: { revoked: true, revokedAt: new Date() },
  });

  const { accessToken, refreshCookieValue } = await issueVendorTokenPair({
    vendorId: existing.vendor.id,
    companyId: existing.vendor.companyId,
    req,
  });
  return { accessToken, refreshCookieValue, vendor: existing.vendor };
}

export async function revokeVendorRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.vendorRefreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });
}
