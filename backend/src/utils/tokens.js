import crypto from "crypto";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
function parseAccessTokenTtlMs(value) {
  if (typeof value === "number") return value * 1000;

  const match = String(value).trim().match(/^(-?(?:\d+\.?\d*|\.\d+))\s*([a-z]+)?$/i);
  if (!match) throw new Error("ACCESS_TOKEN_TTL must be a valid JWT time span.");

  const amount = Number(match[1]);
  const unit = (match[2] || "ms").toLowerCase();
  const multipliers = {
    ms: 1, msec: 1, msecs: 1, millisecond: 1, milliseconds: 1,
    s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
    m: 60_000, min: 60_000, mins: 60_000, minute: 60_000, minutes: 60_000,
    h: 3_600_000, hr: 3_600_000, hrs: 3_600_000, hour: 3_600_000, hours: 3_600_000,
    d: 86_400_000, day: 86_400_000, days: 86_400_000,
    w: 604_800_000, week: 604_800_000, weeks: 604_800_000,
    month: 2_592_000_000, months: 2_592_000_000,
    y: 31_557_600_000, yr: 31_557_600_000, yrs: 31_557_600_000,
    year: 31_557_600_000, years: 31_557_600_000,
  };
  const multiplier = multipliers[unit] ?? multipliers[unit.toLowerCase()];
  if (!multiplier || !Number.isFinite(amount)) {
    throw new Error("ACCESS_TOKEN_TTL must be a valid JWT time span.");
  }
  return amount * multiplier;
}

const ACCESS_TOKEN_TTL_MS = parseAccessTokenTtlMs(ACCESS_TOKEN_TTL);
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
