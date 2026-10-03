import * as reportService from "../services/reportService.js";

export async function getSalesReport(req, res) {
  try {
    const { from, to } = req.validatedQuery || req.query;
    const data = await reportService.getSalesReport({
      companyId: req.user.companyId,
      from,
      to,
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("getSalesReport error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getOutstandingReport(req, res) {
  try {
    const data = await reportService.getOutstandingReport({
      companyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("getOutstandingReport error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
