import crypto from "crypto";
import prisma from "../prisma.js";
import {
  generateAccessToken,
  generateRefreshTokenValue,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from "../utils/tokens.js";

 // Issues a fresh access token (JWT) + refresh token (opaque, stored hashed)

export async function issueTokenPair({ userId, role, companyId, req }) {

  const { token: accessToken } = generateAccessToken({ userId, role, companyId });
  const refreshCookieValue = generateRefreshTokenValue();
  const tokenHash = hashRefreshToken(refreshCookieValue);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      jti: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      ipAddress: req?.ip,
      userAgent: req?.headers?.["user-agent"],
    },
  });
  return { accessToken, refreshCookieValue };
}

 // Validates + rotates a refresh token. 

export async function rotateRefreshToken(rawToken, req) {

  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!existing) {
    return { error: "not_found" };
  }
  if (existing.user?.isActive === false) {
    return { error: "user_inactive" };
  }
  if (existing.revoked || existing.expiresAt < new Date()) {
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
    return { error: "reuse_detected", userId: existing.userId };
  }
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revoked: true, revokedAt: new Date() },
  });

  const { accessToken, refreshCookieValue } = await issueTokenPair({
    userId: existing.user.id,
    role: existing.user.role,
    companyId: existing.user.companyId,
    req,
  });
  return { accessToken, refreshCookieValue, user: existing.user };
}

 // Revokes a single refresh token (used on logout). 
 
export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });
}
