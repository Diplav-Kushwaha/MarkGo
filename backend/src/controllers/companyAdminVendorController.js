import * as vendorService from "../services/vendorService.js";
import * as vendorInviteService from "../services/vendorInviteService.js";
import { buildInviteLink } from "../utils/inviteLink.js";

// POST /api/admin/vendors
export async function createVendor(req, res) {
  try {
    const vendor = await vendorService.createVendor({
      companyId: req.user.companyId,
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Vendor created.", data: vendor });
  } catch (err) {
    console.error("createVendor error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/vendors?search=&status=&page=&pageSize=
export async function getVendors(req, res) {
  try {
    const { search, status, page, pageSize } = req.query;
    const result = await vendorService.listVendors({
      companyId: req.user.companyId,
      search,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getVendors error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/vendors/stats
export async function getVendorStats(req, res) {
  try {
    const stats = await vendorService.getVendorStats({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error("getVendorStats error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/vendors/export
export async function exportVendors(req, res) {
  try {
    const { rows, truncated } = await vendorService.getVendorsForExport({ companyId: req.user.companyId });
    res.set("X-Export-Truncated", String(truncated));
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("exportVendors error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/vendors/:id
export async function getVendorById(req, res) {
  try {
    const vendor = await vendorService.getVendorById({
      companyId: req.user.companyId,
      vendorId: req.params.id,
    });
    return res.status(200).json({ success: true, data: vendor });
  } catch (err) {
    console.error("getVendorById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/vendors/:id
export async function updateVendor(req, res) {
  try {
    const vendor = await vendorService.updateVendor({
      companyId: req.user.companyId,
      vendorId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Vendor updated.", data: vendor });
  } catch (err) {
    console.error("updateVendor error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/vendors/:id/status
export async function updateVendorStatus(req, res) {
  try {
    const vendor = await vendorService.updateVendorStatus({
      companyId: req.user.companyId,
      vendorId: req.params.id,
      status: req.body.status,
    });
    return res.status(200).json({ success: true, message: "Vendor status updated.", data: vendor });
  } catch (err) {
    console.error("updateVendorStatus error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/admin/vendors/:id/invite
export async function inviteVendor(req, res) {
  try {
    // Confirms the vendor exists AND belongs to this admin's company
    // before an invite can be sent for it.
    await vendorService.getVendorById({
      companyId: req.user.companyId,
      vendorId: req.params.id,
    });

    const { rawToken } = await vendorInviteService.createInvite({ vendorId: req.params.id });

    return res.status(200).json({
      success: true,
      message: "Invite created.",
      data: {
        // TODO: remove inviteLink from the response once email sending is
        // wired up — kept here for now so you can test the flow by hand.
        inviteLink: buildInviteLink("vendor", rawToken),
      },
    });
  } catch (err) {
    console.error("inviteVendor error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// DELETE /api/admin/vendors/:id
export async function deleteVendor(req, res) {
  try {
    await vendorService.deleteVendor({
      companyId: req.user.companyId,
      vendorId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Vendor removed." });
  } catch (err) {
    console.error("deleteVendor error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/admin/vendors/bulk
export async function bulkActionVendors(req, res) {
  try {
    const { vendorIds, action } = req.body;
    const result = await vendorService.bulkActionVendors({
      companyId: req.user.companyId,
      vendorIds,
      action,
    });
    return res.status(200).json({ success: true, message: "Bulk action completed.", data: result });
  } catch (err) {
    console.error("bulkActionVendors error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
