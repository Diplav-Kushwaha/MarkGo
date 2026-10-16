import axiosInstance from "./axiosInstance";

/**
 * Fetch company invoicing/billing settings.
 * GET /admin/settings
 */
export async function getSettings() {
  const response = await axiosInstance.get("/api/admin/settings");
  return response.data;
}

/**
 * Update company invoicing/billing settings.
 * PATCH /admin/settings
 */
export async function updateSettings(payload) {
  const response = await axiosInstance.patch("/api/admin/settings", payload);
  return response.data;
}

/**
 * Fetch the company's own details (name, address, state, country,
 * company mail, GST number, currency, financial year start).
 * GET /admin/settings/company
 */
export async function getCompanyDetails() {
  const response = await axiosInstance.get("/api/admin/settings/company");
  return response.data;
}

/**
 * Update the company's own details.
 * PATCH /admin/settings/company
 */
export async function updateCompanyDetails(payload) {
  const response = await axiosInstance.patch("/api/admin/settings/company", payload);
  return response.data;
}

/**
 * Fetch the company admin's own profile (full name, phone, personal mail).
 * GET /admin/settings/profile
 */
export async function getAdminProfile() {
  const response = await axiosInstance.get("/api/admin/settings/profile");
  return response.data;
}

/**
 * Update the company admin's own profile. Changing the phone changes
 * the login, so the backend enforces global phone uniqueness.
 * PATCH /admin/settings/profile
 */
export async function updateAdminProfile(payload) {
  const response = await axiosInstance.patch("/api/admin/settings/profile", payload);
  return response.data;
}
