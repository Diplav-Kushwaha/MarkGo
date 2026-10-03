import axiosInstance from "./axiosInstance";

/**
 * Fetch admin dashboard cards and recent invoices.
 * GET /admin/dashboard
 */
export async function getDashboard() {
  const response = await axiosInstance.get("/api/admin/dashboard");
  return response.data;
}
