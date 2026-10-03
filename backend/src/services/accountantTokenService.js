import crypto from "crypto";
import prisma from "../prisma.js";
import {
  generateAccessToken,
  generateRefreshTokenValue,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from "../utils/tokens.js";

export async function issueAccountantTokenPair({ accountantId, companyId, req }) {
  const { token: accessToken } = generateAccessToken({
    userId: accountantId,
    role: "ACCOUNTANT",
    companyId,
  });
  const refreshCookieValue = generateRefreshTokenValue();
  const tokenHash = hashRefreshToken(refreshCookieValue);

  await prisma.accountantRefreshToken.create({
    data: {
      accountantId,
      tokenHash,
      jti: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      ipAddress: req?.ip,
      userAgent: req?.headers?.["user-agent"],
    },
  });
  return { accessToken, refreshCookieValue };
}

export async function rotateAccountantRefreshToken(rawToken, req) {
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.accountantRefreshToken.findUnique({
    where: { tokenHash },
    include: { accountant: true },
  });
  if (!existing) {
    return { error: "not_found" };
  }
  if (existing.revoked || existing.expiresAt < new Date()) {
    await prisma.accountantRefreshToken.updateMany({
      where: { accountantId: existing.accountantId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
    return { error: "reuse_detected", accountantId: existing.accountantId };
  }
  await prisma.accountantRefreshToken.update({
    where: { id: existing.id },
    data: { revoked: true, revokedAt: new Date() },
  });

  const { accessToken, refreshCookieValue } = await issueAccountantTokenPair({
    accountantId: existing.accountant.id,
    companyId: existing.accountant.companyId,
    req,
  });
  return { accessToken, refreshCookieValue, accountant: existing.accountant };
}

export async function revokeAccountantRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.accountantRefreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });
}
