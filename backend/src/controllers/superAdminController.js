import * as superAdminService from "../services/superAdminService.js";

/**
 * GET /api/superadmin/companies
 * Protected by authenticateToken + requireSuperAdmin.
 * Read-only platform-wide company list. Query params are validated by
 * listSuperAdminCompaniesQuerySchema before reaching the service.
 */
export async function listCompanies(req, res) {
  try {
    const { search, status, sortBy, sortOrder, page, pageSize } =
      req.validatedQuery || {};

    const result = await superAdminService.listCompanies({
      search,
      status,
      sortBy,
      sortOrder,
      page,
      pageSize,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("listCompanies error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

/**
 * GET /api/superadmin/dashboard
 * Protected by authenticateToken + requireSuperAdmin.
 * Read-only platform-wide totals. No single company's internal records are
 * exposed, only aggregates.
 */
export async function getPlatformDashboard(req, res) {
  try {
    const dashboard = await superAdminService.getPlatformDashboard();
    return res.status(200).json({ success: true, data: dashboard });
  } catch (err) {
    console.error("getPlatformDashboard error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

/**
 * GET /api/superadmin/companies/:id
 * Protected by authenticateToken + requireSuperAdmin.
 * Read-only: company profile, profit/loss and headcount. No company-internal
 * records (customers, invoices, bills, payments) are returned.
 */
export async function getCompanyDetails(req, res) {
  try {
    const details = await superAdminService.getCompanyDetails({ companyId: req.params.id });
    return res.status(200).json({ success: true, data: details });
  } catch (err) {
    console.error("getCompanyDetails error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message || "Internal server error." });
  }
}
