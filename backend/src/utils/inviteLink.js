/**
 * Invite links are opened in a browser by a human, so they must point at the
 * frontend origin (the `/accept-*` routes), not the API. `FRONTEND_URL` is the
 * authoritative value and falls back to `APP_URL` for deployments that only
 * configured the latter.
 */
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.APP_URL || "";

/** Frontend route that accepts each role's invite token. */
export const INVITE_PATHS = {
  customer: "/accept-invite",
  staff: "/accept-staff-invite",
  vendor: "/accept-vendor-invite",
  accountant: "/accept-accountant-invite",
};

export function buildInviteLink(role, rawToken) {
  const path = INVITE_PATHS[role];
  if (!path) {
    throw new Error(`Unknown invite role: ${role}`);
  }
  return `${FRONTEND_URL.replace(/\/+$/, "")}${path}?token=${encodeURIComponent(rawToken)}`;
}
