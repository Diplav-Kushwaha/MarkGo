/**
 * Shared phone rules for frontend forms.
 *
 * Mirrors backend/src/utils/phone.js so a value that passes here also
 * passes server-side validation: trim, remove spaces, dashes and a
 * leading +91 or 0, then require exactly 10 digits. Only the
 * normalized 10-digit value is ever sent to the API.
 */

export const PHONE_REGEX = /^\d{10}$/;

export const PHONE_HINT = "10 digits. No spaces, dashes, or +91.";

/** Same message the backend returns for any invalid phone number. */
export const INVALID_PHONE_MESSAGE = "Enter a valid 10-digit phone number";

export function normalizePhone(input) {
  if (input === null || input === undefined) return "";

  return String(input)
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/^\+91/, "")
    .replace(/^91/, "")
    .replace(/^0/, "");
}

export function isValidPhone(input) {
  return PHONE_REGEX.test(normalizePhone(input));
}

/**
 * Returns { valid, normalized, error }. An empty input is reported as
 * "required" so required fields can use one call; callers that allow an
 * empty value should check for emptiness first.
 */
export function validatePhone(input) {
  const normalized = normalizePhone(input);

  if (!normalized) {
    return { valid: false, normalized, error: "Phone number is required." };
  }

  if (!PHONE_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: INVALID_PHONE_MESSAGE,
    };
  }

  return { valid: true, normalized, error: null };
}
