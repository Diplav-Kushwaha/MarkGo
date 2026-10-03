import axiosInstance from "./axiosInstance";

/**
 * Fetch the sales report for a required date range.
 * GET /admin/reports/sales?from=&to=
 */
export async function getSalesReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/sales", { params });
  return response.data;
}

/**
 * Fetch outstanding receivables and payables.
 * GET /admin/reports/outstanding
 */
export async function getOutstandingReport() {
  const response = await axiosInstance.get("/api/admin/reports/outstanding");
  return response.data;
}
