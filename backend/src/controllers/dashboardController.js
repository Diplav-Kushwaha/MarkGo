import * as dashboardService from "../services/dashboardService.js";
import * as dashboardDataService from "../services/dashboardDataService.js";

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

// Dashboard cards and charts (read-only). The company is taken from the
// verified token; the tolerantly-validated query reaches us on req.validatedQuery.
async function send(req, res, handler, validated) {
  try {
    const data = await handler({ companyId: req.user.companyId, ...validated });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error(`${handler.name} error:`, err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal server error.",
      ...(Array.isArray(err.errors) && err.errors.length ? { errors: err.errors } : {}),
    });
  }
}

export async function getDashboardSummary(req, res) {
  const q = req.validatedQuery || req.query;
  return send(req, res, dashboardDataService.getDashboardSummary, {
    range: q.range,
    from: q.from,
    to: q.to,
  });
}

export async function getDashboardCharts(req, res) {
  const q = req.validatedQuery || req.query;
  return send(req, res, dashboardDataService.getDashboardCharts, {
    range: q.range,
    from: q.from,
    to: q.to,
    months: q.months,
  });
}