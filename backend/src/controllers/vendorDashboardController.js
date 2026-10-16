import * as vendorDashboardService from "../services/vendorDashboardService.js";

/**
 * Vendor dashboard controllers — every handler is read-only.
 *
 * Identity comes from `req.vendor` (set by `authenticateVendorToken` from
 * the verified token): `vendorId` and `companyId` are never taken from the
 * query string, body or URL. Controllers only pass those through to the
 * service's read functions.
 */

// GET /api/vendor/profile
export async function getProfile(req, res) {
  try {
    const profile = await vendorDashboardService.getVendorProfile({
      vendorId: req.vendor.vendorId,
    });
    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error("getVendorProfile error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/vendor/sold-products
export async function getSoldProducts(req, res) {
  try {
    const query = req.validatedQuery || req.query;
    const result = await vendorDashboardService.listVendorSoldProducts({
      vendorId: req.vendor.vendorId,
      companyId: req.vendor.companyId,
      search: query.search,
      type: query.type,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getVendorSoldProducts error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/vendor/bills
export async function getBills(req, res) {
  try {
    const query = req.validatedQuery || req.query;
    const result = await vendorDashboardService.listVendorBills({
      vendorId: req.vendor.vendorId,
      companyId: req.vendor.companyId,
      search: query.search,
      status: query.status,
      from: query.from,
      to: query.to,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getVendorBills error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/vendor/bills/:id
export async function getBillById(req, res) {
  try {
    const bill = await vendorDashboardService.getVendorBillById({
      vendorId: req.vendor.vendorId,
      companyId: req.vendor.companyId,
      id: req.params.id,
    });
    return res.status(200).json({ success: true, data: bill });
  } catch (err) {
    console.error("getVendorBillById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/vendor/products
export async function getProducts(req, res) {
  try {
    const query = req.validatedQuery || req.query;
    const result = await vendorDashboardService.listVendorProducts({
      companyId: req.vendor.companyId,
      search: query.search,
      category: query.category,
      availability: query.availability,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getVendorProducts error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/vendor/services
export async function getServices(req, res) {
  try {
    const query = req.validatedQuery || req.query;
    const result = await vendorDashboardService.listVendorServices({
      companyId: req.vendor.companyId,
      search: query.search,
      category: query.category,
      availability: query.availability,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getVendorServices error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
