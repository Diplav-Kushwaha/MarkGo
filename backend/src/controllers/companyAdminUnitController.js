import * as unitService from "../services/unitService.js";

// POST /api/admin/units
export async function createUnit(req, res) {
  try {
    const unit = await unitService.createUnit({
      companyId: req.user.companyId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Unit created.", data: unit });
  } catch (err) {
    console.error("createUnit error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error.", ...(err.existing ? { existing: err.existing } : {}) });
  }
}

// GET /api/admin/units?search=&source=&type=&page=&pageSize=
export async function getUnits(req, res) {
  try {
    const { search, source, type, page, pageSize, sortBy, sortOrder } = req.query;
    const result = await unitService.listUnits({
      companyId: req.user.companyId,
      search,
      source,
      type,
      sortBy,
      sortOrder,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getUnits error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/units/options
export async function getUnitOptions(req, res) {
  try {
    const options = await unitService.getUnitOptions({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: options });
  } catch (err) {
    console.error("getUnitOptions error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/units/:id
export async function getUnitById(req, res) {
  try {
    const unit = await unitService.getUnitById({
      companyId: req.user.companyId,
      unitId: req.params.id,
    });
    return res.status(200).json({ success: true, data: unit });
  } catch (err) {
    console.error("getUnitById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/units/:id
export async function updateUnit(req, res) {
  try {
    const unit = await unitService.updateUnit({
      companyId: req.user.companyId,
      unitId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Unit updated.", data: unit });
  } catch (err) {
    console.error("updateUnit error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// DELETE /api/admin/units/:id
export async function deleteUnit(req, res) {
  try {
    await unitService.deleteUnit({
      companyId: req.user.companyId,
      unitId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Unit deleted." });
  } catch (err) {
    console.error("deleteUnit error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
