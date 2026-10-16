import axiosInstance from "./axiosInstance";

/**
 * Fetch admin dashboard cards and recent invoices.
 * GET /admin/dashboard
 */
export async function getDashboard() {
  const response = await axiosInstance.get("/api/admin/dashboard");
  return response.data;
}

/**
 * Dashboard summary cards: the six money cards and four count cards.
 * GET /admin/dashboard/summary?range=month&from=&to=
 *
 * `range` is today | week | month | year | custom (default month). `from`/`to`
 * are optional YYYY-MM-DD dates for a custom range. Empty strings and "all" are
 * treated as "use the default"; unknown extra params are ignored. The company
 * always comes from the session token, so none of these calls sends one.
 */
export async function getDashboardSummary(params = {}) {
  const response = await axiosInstance.get("/api/admin/dashboard/summary", { params });
  return response.data;
}

/**
 * Dashboard charts: sales vs purchases, profit trend, top products and income
 * vs expense.
 * GET /admin/dashboard/charts?range=month&from=&to=&months=6
 *
 * `months` is 6 or 12 (default 6) for the two monthly charts; any other value
 * is normalised to 6 server-side rather than rejected.
 */
export async function getDashboardCharts(params = {}) {
  const response = await axiosInstance.get("/api/admin/dashboard/charts", { params });
  return response.data;
}
