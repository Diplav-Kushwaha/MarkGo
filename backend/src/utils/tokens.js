import crypto from "crypto";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // keep in sync with ACCESS_TOKEN_TTL above if you change it
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
export const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

 // Short-lived JWT access token. Carries a jti so it can later be cross-checked
 
export function generateAccessToken({ userId, role, companyId }) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { userId, role, companyId: companyId ?? null, jti },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
  return { token, jti };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function generateRefreshTokenValue() {
  return crypto.randomBytes(64).toString("hex");
}

export function hashRefreshToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function getAccessCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: ACCESS_TOKEN_TTL_MS,
    path: "/",
  };
}

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: "/api",
  };
}
