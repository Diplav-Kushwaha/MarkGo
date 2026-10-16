export const INVALID_PHONE_MESSAGE = "Enter a valid 10-digit phone number";

export function normalizePhone(input) {
  if (!input || typeof input !== "string") {
    return null;
  }

  const phone = input
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/^\+91/, "")
    .replace(/^91/, "")
    .replace(/^0/, "");

  if (!/^\d{10}$/.test(phone)) {
    return null;
  }

  return phone;
}

export function invalidPhoneError() {
  const err = new Error(INVALID_PHONE_MESSAGE);
  err.status = 400;
  return err;
}

export function validatePhone(phone) {
  const normalized = normalizePhone(phone);
  if (normalized) {
    return { valid: true, normalized };
  }
  return { valid: false, error: INVALID_PHONE_MESSAGE };
}

export const PHONE_REGEX = /^\d{10}$/;
