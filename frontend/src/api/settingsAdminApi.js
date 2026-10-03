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
