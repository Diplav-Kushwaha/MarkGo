/**
 * Subscription feature switches.
 *
 * Read from the environment and normalised here so the rest of the codebase has
 * a single, predictable place to ask "is dummy payment on?" and "is
 * subscription blocking on?".
 *
 * Nothing imports this file yet, so it has no effect on the running app. Both
 * switches default to the permissive value, which means a missing (or malformed)
 * variable can never change behaviour.
 */

/** Payment integration mode. Lower-cased so "Dummy" and "dummy" behave alike. */
export const paymentMode = String(process.env.PAYMENT_MODE || "dummy").toLowerCase();

/**
 * True only when PAYMENT_MODE is "dummy". Any other value means the dummy
 * payment endpoints must refuse to run until a real integration replaces them.
 */
export const isDummyPayment = paymentMode === "dummy";

/**
 * True only when ENFORCE_SUBSCRIPTION is exactly "true", ignoring case.
 * Anything else — "false", "1", "yes", an empty value, or the variable being
 * absent — leaves enforcement off.
 */
export const enforceSubscription =
  String(process.env.ENFORCE_SUBSCRIPTION || "").trim().toLowerCase() === "true";