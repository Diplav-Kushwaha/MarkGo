import * as staffService from "../services/staffService.js";
import * as staffInviteService from "../services/staffInviteService.js";
import { buildInviteLink } from "../utils/inviteLink.js";

// POST /api/admin/staff
export async function createStaff(req, res) {
  try {
    const staff = await staffService.createStaff({
      companyId: req.user.companyId,
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Staff member created.", data: staff });
  } catch (err) {
    console.error("createStaff error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/staff?search=&status=&page=&pageSize=
export async function getStaff(req, res) {
  try {
    const { search, status, page, pageSize } = req.query;
    const result = await staffService.listStaff({
      companyId: req.user.companyId,
      search,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getStaff error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/staff/:id
export async function getStaffById(req, res) {
  try {
    const staff = await staffService.getStaffById({
      companyId: req.user.companyId,
      staffId: req.params.id,
    });
    return res.status(200).json({ success: true, data: staff });
  } catch (err) {
    console.error("getStaffById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/staff/:id
export async function updateStaff(req, res) {
  try {
    const staff = await staffService.updateStaff({
      companyId: req.user.companyId,
      staffId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Staff member updated.", data: staff });
  } catch (err) {
    console.error("updateStaff error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/staff/:id/status
export async function updateStaffStatus(req, res) {
  try {
    const staff = await staffService.updateStaffStatus({
      companyId: req.user.companyId,
      staffId: req.params.id,
      status: req.body.status,
    });
    return res.status(200).json({ success: true, message: "Staff status updated.", data: staff });
  } catch (err) {
    console.error("updateStaffStatus error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/admin/staff/:id/invite
export async function inviteStaff(req, res) {
  try {
    // Confirms the staff member exists AND belongs to this admin's company
    // before an invite can be sent for it.
    await staffService.getStaffById({
      companyId: req.user.companyId,
      staffId: req.params.id,
    });

    const { rawToken } = await staffInviteService.createInvite({ staffId: req.params.id });

    return res.status(200).json({
      success: true,
      message: "Invite created.",
      data: {
        // TODO: remove inviteLink from the response once email sending is
        // wired up — kept here for now so you can test the flow by hand.
        inviteLink: buildInviteLink("staff", rawToken),
      },
    });
  } catch (err) {
    console.error("inviteStaff error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// DELETE /api/admin/staff/:id
export async function deleteStaff(req, res) {
  try {
    await staffService.deleteStaff({
      companyId: req.user.companyId,
      staffId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Staff member removed." });
  } catch (err) {
    console.error("deleteStaff error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
