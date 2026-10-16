/**
 * Public (unauthenticated) navigation links.
 *
 * Single source of truth for the marketing navbar, the footer and the public
 * pages, so the four can never drift apart. Only routes that already exist in
 * the router are listed here — nothing is invented:
 *
 *   /                     Home
 *   /about                About
 *   /plans                new-company flow (pick a plan, then register)
 *   /register             register form, needs a ?plan= id (redirects to /plans
 *                         without one, which is why the shared Register links
 *                         point at /plans)
 *   /admin/login          Company Admin
 *   /customer/login       Customer
 *   /vendor/login         Vendor
 */

/** Public pages shown in the navbar and the footer. */
export const MARKETING_LINKS = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
];

/**
 * Login destinations, one per role that has a login route in App.jsx. The Super
 * Admin login (/superadmin/login) is deliberately absent: it is an internal
 * operator route and is not part of the public dropdown.
 */
export const LOGIN_OPTIONS = [
  { label: "Login as Admin", to: "/admin/login" },
  { label: "Login as Customer", to: "/customer/login" },
  { label: "Login as Vendor", to: "/vendor/login" },
];

/**
 * Start of the existing new-company flow. `/register` on its own redirects to
 * `/plans`, so public Register buttons point here and land the user directly on
 * the plan picker.
 */
export const REGISTER_PATH = "/plans";

/**
 * Register form for one specific plan. Same URL the plans page builds, so
 * choosing a plan here behaves exactly like choosing it there.
 */
export const registerPathForPlan = (planId) => `/register?plan=${planId}`;

/** Where the "already have an account" hints point. */
export const ADMIN_LOGIN_PATH = "/admin/login";
