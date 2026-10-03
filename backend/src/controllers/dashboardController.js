import * as dashboardService from "../services/dashboardService.js";

export async function getDashboard(req, res) {
  try {
    const data = await dashboardService.getDashboardStats({
      companyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("getDashboard error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}