import * as serviceService from "../services/serviceService.js";

/**
 * Service controllers.
 *
 * Services keep using the shared `/api/admin/items/...` paths: `companyAdminItemController`
 * delegates to these functions for every request that is not a product one, and
 * the new summary endpoint has its own route file. The response envelope
 * (`{ success, message, data }`) is exactly the one the item endpoints already
 * use, so nothing the frontend reads changes.
 */

// POST /api/admin/items
export async function createService(req, res) {
  try {
    const service = await serviceService.createService({
      companyId: req.user.companyId,
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Service created.", data: service });
  } catch (err) {
    console.error("createService error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/items?search=&status=&sort=&page=&pageSize=
export async function getServices(req, res) {
  try {
    // `search`, `status`, `sort`, `page` and `pageSize` are the only filters the
    // service contract has; the schema has already dropped anything else
    // (`type`, `stock`, `category`, ...) from the query.
    const query = req.validatedQuery || req.query;
    const result = await serviceService.listServices({
      companyId: req.user.companyId,
      search: query.search,
      status: query.status,
      sort: query.sort,
      // Aliases the existing pages still send; the service maps them onto the
      // new vocabulary.
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      page: query.page,
      pageSize: query.pageSize,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getServices error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/services/summary
export async function getServiceSummary(req, res) {
  try {
    const summary = await serviceService.getServiceSummary({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    console.error("getServiceSummary error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/items/:id
export async function getServiceDetails(req, res) {
  try {
    const service = await serviceService.getServiceDetails({
      companyId: req.user.companyId,
      serviceId: req.params.id,
    });
    return res.status(200).json({ success: true, data: service });
  } catch (err) {
    console.error("getServiceDetails error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/items/:id
export async function updateService(req, res) {
  try {
    const service = await serviceService.updateService({
      companyId: req.user.companyId,
      serviceId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Service updated.", data: service });
  } catch (err) {
    console.error("updateService error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/items/:id/status
export async function setServiceStatus(req, res) {
  try {
    const service = await serviceService.setServiceStatus({
      companyId: req.user.companyId,
      serviceId: req.params.id,
      status: req.body.status,
    });
    return res.status(200).json({ success: true, message: "Status updated.", data: service });
  } catch (err) {
    console.error("setServiceStatus error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// DELETE /api/admin/items/:id
export async function deleteService(req, res) {
  try {
    await serviceService.deleteService({
      companyId: req.user.companyId,
      serviceId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Service removed from catalog." });
  } catch (err) {
    console.error("deleteService error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
