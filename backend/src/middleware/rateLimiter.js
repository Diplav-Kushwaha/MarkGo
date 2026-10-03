import rateLimit from "express-rate-limit";

/**
 * NOTE: these use the default in-memory store, which is fine for a single
 * Node process. If you ever run multiple instances behind a load balancer,
 * swap in `rate-limit-redis` (or similar) so limits are shared across
 * instances instead of being trivially bypassed by hitting a different node.
 */

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again in 15 minutes." },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many registration attempts. Please try again later." },
});

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many token refresh attempts. Please slow down." },
});

// Public dummy subscription-payment routes. Their own limiter so they do not
// share a counter with registration: the payment page polls for the payment
// summary and the buyer may retry, which the 10/hour registration budget is too
// small for.
export const subscriptionPaymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many payment requests. Please try again in 15 minutes." },
});
