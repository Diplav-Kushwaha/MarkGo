import * as itemService from "../services/itemService.js";
import * as productService from "../services/productService.js";
import * as serviceController from "./companyAdminServiceController.js";

// Products and Services share the Item model and these routes.
//
// Which path a request takes is decided by the type the caller DECLARED, not by
// the validated body: the shared item schema injects `type: "PRODUCT"` as its
// default, and that injected value must never route a service update into the
// product rules. The routes therefore snapshot the raw declaration onto
// `req.declaredItemType` before validating, and `isProductPayload` below reads
// it.
//
// The service half of that split lives in companyAdminServiceController.js: the
// functions in this file only decide which controller a request belongs to, so
// the product behaviour and the status/stats/export/bulk behaviour are
// unchanged while the service behaviour follows the new service contract.
function isProductPayload(req) {
  if (req.declaredItemType) return req.declaredItemType === "PRODUCT";
  return String(req.body?.type || "").toUpperCase() === "PRODUCT";
}

/** The list endpoint decides the same way, but from the query string. */
function isProductListRequest(req) {
  return String(req.query?.type || "").toUpperCase() === "PRODUCT";
}

// ---------------------------------------------------------------------------
// Product endpoints (type = PRODUCT only)
// ---------------------------------------------------------------------------

// POST /api/admin/items  (body type = PRODUCT)
export async function createProduct(req, res) {
  try {
    const product = await productService.createProduct({
      companyId: req.user.companyId,
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Product created.", data: product });
  } catch (err) {
    console.error("createProduct error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/items?type=PRODUCT&search=&status=&stock=&sort=&page=&pageSize=
export async function listProducts(req, res) {
  try {
    const query = req.validatedQuery || req.query;
    const result = await productService.listProducts({
      companyId: req.user.companyId,
      search: query.search,
      status: query.status,
      stock: query.stock,
      // Aliases the existing catalogue pages still send; the product service
      // maps them onto the new vocabulary.
      stockLevel: query.stockLevel,
      sort: query.sort,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      page: query.page,
      pageSize: query.pageSize,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("listProducts error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/items/summary
export async function getProductSummary(req, res) {
  try {
    const summary = await productService.getProductSummary({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    console.error("getProductSummary error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/items/:id  (when the row is a product)
export async function getProductDetails(req, res) {
  try {
    const product = await productService.getProductDetails({
      companyId: req.user.companyId,
      productId: req.params.id,
    });
    return res.status(200).json({ success: true, data: product });
  } catch (err) {
    console.error("getProductDetails error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/items/:id  (body type = PRODUCT)
export async function updateProduct(req, res) {
  try {
    const product = await productService.updateProduct({
      companyId: req.user.companyId,
      productId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Product updated.", data: product });
  } catch (err) {
    console.error("updateProduct error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/items/:id/status  (when the row is a product)
export async function setProductStatus(req, res) {
  try {
    const product = await productService.setProductStatus({
      companyId: req.user.companyId,
      productId: req.params.id,
      status: req.body.status,
    });
    return res.status(200).json({ success: true, message: "Status updated.", data: product });
  } catch (err) {
    console.error("setProductStatus error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// DELETE /api/admin/items/:id  (when the row is a product)
export async function deleteProduct(req, res) {
  try {
    await productService.deleteProduct({
      companyId: req.user.companyId,
      productId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Product removed from catalog." });
  } catch (err) {
    console.error("deleteProduct error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/admin/items
export async function createItem(req, res) {
  try {
    if (isProductPayload(req)) {
      return createProduct(req, res);
    }
    // Everything that is not a declared product is a service.
    return serviceController.createService(req, res);
  } catch (err) {
    console.error("createItem error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/items?type=PRODUCT... (product list) / ?type=SERVICE... (service list)
export async function getItems(req, res) {
  try {
    // type=PRODUCT switches to the product list (search/status/stock/sort +
    // pagination); every other value is a service list, which only ever returns
    // services and ignores the filters services do not have.
    if (isProductListRequest(req)) {
      return listProducts(req, res);
    }
    return serviceController.getServices(req, res);
  } catch (err) {
    console.error("getItems error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/items/stats
export async function getItemStats(req, res) {
  try {
    const stats = await itemService.getItemStats({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error("getItemStats error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/items/export
export async function exportItems(req, res) {
  try {
    const { rows, truncated } = await itemService.getItemsForExport({ companyId: req.user.companyId });
    res.set("X-Export-Truncated", String(truncated));
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("exportItems error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/items/:id
export async function getItemById(req, res) {
  try {
    const item = await itemService.getItemById({
      companyId: req.user.companyId,
      itemId: req.params.id,
    });

    // Products get the unit/category relations and the profit/loss block;
    // services get the service contract (unit and category, no profit/loss).
    if (item.type === "PRODUCT") {
      return getProductDetails(req, res);
    }

    return serviceController.getServiceDetails(req, res);
  } catch (err) {
    console.error("getItemById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/items/:id
export async function updateItem(req, res) {
  try {
    // An explicit type=PRODUCT goes through the product rules (duplicate code,
    // tax-mode coherence, unit/category ownership). Services, and updates that
    // send no type at all, go through the new service rules.
    if (isProductPayload(req)) {
      return updateProduct(req, res);
    }
    return serviceController.updateService(req, res);
  } catch (err) {
    console.error("updateItem error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/items/:id/status
export async function updateItemStatus(req, res) {
  try {
    // The row's own type decides the path: a product gains the "no stock,
    // cannot be Available" rule, a service keeps a plain active/inactive toggle.
    const existing = await itemService.getItemById({
      companyId: req.user.companyId,
      itemId: req.params.id,
    });
    if (existing.type === "PRODUCT") {
      return setProductStatus(req, res);
    }
    return serviceController.setServiceStatus(req, res);
  } catch (err) {
    console.error("updateItemStatus error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// DELETE /api/admin/items/:id — soft delete, the row is kept for invoice history
export async function deleteItem(req, res) {
  try {
    // Scoped single-row soft delete. The product path additionally asserts
    // type = PRODUCT so a service id can never be removed through it; the
    // service path asserts type = SERVICE and the same way, and both only ever
    // delete one row of the logged-in company.
    const existing = await itemService.getItemById({
      companyId: req.user.companyId,
      itemId: req.params.id,
    });
    if (existing.type === "PRODUCT") {
      return deleteProduct(req, res);
    }
    return serviceController.deleteService(req, res);
  } catch (err) {
    console.error("deleteItem error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/admin/items/bulk
export async function bulkActionItems(req, res) {
  try {
    const { itemIds, action, category } = req.body;
    const result = await itemService.bulkActionItems({
      companyId: req.user.companyId,
      itemIds,
      action,
      category,
    });
    return res.status(200).json({ success: true, message: "Bulk action completed.", data: result });
  } catch (err) {
    console.error("bulkActionItems error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
