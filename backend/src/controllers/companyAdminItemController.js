import * as itemService from "../services/itemService.js";

// POST /api/admin/items
export async function createItem(req, res) {
  try {
    const item = await itemService.createItem({
      companyId: req.user.companyId,
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Product or service created.", data: item });
  } catch (err) {
    console.error("createItem error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/items?search=&type=&status=&category=&stockLevel=&page=&pageSize=
export async function getItems(req, res) {
  try {
    const { search, type, status, category, stockLevel, page, pageSize, sortBy, sortOrder } = req.query;
    const result = await itemService.listItems({
      companyId: req.user.companyId,
      search,
      type,
      status,
      category,
      stockLevel,
      sortBy,
      sortOrder,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return res.status(200).json({ success: true, data: result });
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
    const items = await itemService.getItemsForExport({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: items });
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
    return res.status(200).json({ success: true, data: item });
  } catch (err) {
    console.error("getItemById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/items/:id
export async function updateItem(req, res) {
  try {
    const item = await itemService.updateItem({
      companyId: req.user.companyId,
      itemId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Product or service updated.", data: item });
  } catch (err) {
    console.error("updateItem error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/items/:id/status
export async function updateItemStatus(req, res) {
  try {
    const item = await itemService.updateItemStatus({
      companyId: req.user.companyId,
      itemId: req.params.id,
      status: req.body.status,
    });
    return res.status(200).json({ success: true, message: "Status updated.", data: item });
  } catch (err) {
    console.error("updateItemStatus error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// DELETE /api/admin/items/:id — soft delete, the row is kept for invoice history
export async function deleteItem(req, res) {
  try {
    await itemService.deleteItem({
      companyId: req.user.companyId,
      itemId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Product or service removed from catalog." });
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
