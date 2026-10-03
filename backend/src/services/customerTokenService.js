import crypto from "crypto";
import prisma from "../prisma.js";
import {
  generateAccessToken,
  generateRefreshTokenValue,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from "../utils/tokens.js";

// Same shape as issueTokenPair / rotateRefreshToken / revokeRefreshToken in
// tokenService.js, but backed by CustomerRefreshToken + Customer instead of
// RefreshToken + User. Kept as a separate file rather than parameterizing
// the existing service, matching how companyAdminAuthController.js and
// superAdminAuthController.js are already kept separate rather than merged.

export async function issueCustomerTokenPair({ customerId, companyId, req }) {
  // generateAccessToken's param is named `userId`, but it's just the JWT
  // subject claim — passing a customer id here is fine, no change needed
  // in tokens.js.
  const { token: accessToken } = generateAccessToken({
    userId: customerId,
    role: "CUSTOMER",
    companyId,
  });
  const refreshCookieValue = generateRefreshTokenValue();
  const tokenHash = hashRefreshToken(refreshCookieValue);

  await prisma.customerRefreshToken.create({
    data: {
      customerId,
      tokenHash,
      jti: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      ipAddress: req?.ip,
      userAgent: req?.headers?.["user-agent"],
    },
  });
  return { accessToken, refreshCookieValue };
}

export async function rotateCustomerRefreshToken(rawToken, req) {
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.customerRefreshToken.findUnique({
    where: { tokenHash },
    include: { customer: true },
  });
  if (!existing) {
    return { error: "not_found" };
  }
  if (existing.revoked || existing.expiresAt < new Date()) {
    await prisma.customerRefreshToken.updateMany({
      where: { customerId: existing.customerId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
    return { error: "reuse_detected", customerId: existing.customerId };
  }
  await prisma.customerRefreshToken.update({
    where: { id: existing.id },
    data: { revoked: true, revokedAt: new Date() },
  });

  const { accessToken, refreshCookieValue } = await issueCustomerTokenPair({
    customerId: existing.customer.id,
    companyId: existing.customer.companyId,
    req,
  });
  return { accessToken, refreshCookieValue, customer: existing.customer };
}

export async function revokeCustomerRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.customerRefreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });
}
