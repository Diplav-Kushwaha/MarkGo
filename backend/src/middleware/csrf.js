import crypto from "crypto";

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * GET /api/csrf-token
 * Issues a random token as a *readable* (non-httpOnly) cookie and also
 * returns it in the body. The frontend should call this once (e.g. on app
 * load) and echo the value back in the `x-csrf-token` header on every
 * state-changing request. Because it's a double-submit pattern, no server
 * secret or session store is required — the browser's same-origin policy is
 * what prevents an attacker's page from reading the cookie to forge the header.
 */
export function issueCsrfToken(req, res) {
  const token = crypto.randomBytes(32).toString("hex");

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
    path: "/",
  });

  return res.status(200).json({ success: true, csrfToken: token });
}

export function verifyCsrfToken(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ success: false, message: "CSRF token missing." });
  }

  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(String(headerToken));

  if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
    return res.status(403).json({ success: false, message: "CSRF token invalid." });
  }

  next();
}
