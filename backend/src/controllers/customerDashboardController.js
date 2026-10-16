import * as customerDashboardService from "../services/customerDashboardService.js";

/**
 * Customer dashboard controllers — every handler is read-only.
 *
 * Identity comes from `req.customer` (set by `authenticateCustomerToken` from
 * the verified token): `customerId` and `companyId` are never taken from the
 * query string, body or URL. Controllers only pass those through to the
 * service's read functions.
 */

// GET /api/customer/profile
export async function getProfile(req, res) {
  try {
    const profile = await customerDashboardService.getCustomerProfile({
      customerId: req.customer.customerId,
    });
    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error("getCustomerProfile error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/customer/purchased-products
export async function getPurchasedProducts(req, res) {
  try {
    const query = req.validatedQuery || req.query;
    const result = await customerDashboardService.listCustomerPurchasedProducts({
      customerId: req.customer.customerId,
      companyId: req.customer.companyId,
      search: query.search,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getCustomerPurchasedProducts error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/customer/invoices
export async function getInvoices(req, res) {
  try {
    const query = req.validatedQuery || req.query;
    const result = await customerDashboardService.listCustomerInvoices({
      customerId: req.customer.customerId,
      companyId: req.customer.companyId,
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
    console.error("getCustomerInvoices error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/customer/invoices/:id
export async function getInvoiceById(req, res) {
  try {
    const invoice = await customerDashboardService.getCustomerInvoiceById({
      customerId: req.customer.customerId,
      companyId: req.customer.companyId,
      id: req.params.id,
    });
    return res.status(200).json({ success: true, data: invoice });
  } catch (err) {
    console.error("getCustomerInvoiceById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/customer/products
export async function getProducts(req, res) {
  try {
    const query = req.validatedQuery || req.query;
    const result = await customerDashboardService.listCompanyProductsForCustomer({
      companyId: req.customer.companyId,
      search: query.search,
      category: query.category,
      availability: query.availability,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getCustomerProducts error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/customer/services
export async function getServices(req, res) {
  try {
    const query = req.validatedQuery || req.query;
    const result = await customerDashboardService.listCompanyServicesForCustomer({
      companyId: req.customer.companyId,
      search: query.search,
      category: query.category,
      availability: query.availability,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getCustomerServices error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
