import * as accountantService from "../services/accountantService.js";
import * as accountantInviteService from "../services/accountantInviteService.js";
import { buildInviteLink } from "../utils/inviteLink.js";

// POST /api/admin/accountants
export async function createAccountant(req, res) {
  try {
    const accountant = await accountantService.createAccountant({
      companyId: req.user.companyId,
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Accountant created.", data: accountant });
  } catch (err) {
    console.error("createAccountant error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/accountants?search=&status=&page=&pageSize=
export async function getAccountants(req, res) {
  try {
    const { search, status, page, pageSize } = req.query;
    const result = await accountantService.listAccountants({
      companyId: req.user.companyId,
      search,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getAccountants error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/accountants/:id
export async function getAccountantById(req, res) {
  try {
    const accountant = await accountantService.getAccountantById({
      companyId: req.user.companyId,
      accountantId: req.params.id,
    });
    return res.status(200).json({ success: true, data: accountant });
  } catch (err) {
    console.error("getAccountantById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/accountants/:id
export async function updateAccountant(req, res) {
  try {
    const accountant = await accountantService.updateAccountant({
      companyId: req.user.companyId,
      accountantId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Accountant updated.", data: accountant });
  } catch (err) {
    console.error("updateAccountant error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/accountants/:id/status
export async function updateAccountantStatus(req, res) {
  try {
    const accountant = await accountantService.updateAccountantStatus({
      companyId: req.user.companyId,
      accountantId: req.params.id,
      status: req.body.status,
    });
    return res.status(200).json({ success: true, message: "Accountant status updated.", data: accountant });
  } catch (err) {
    console.error("updateAccountantStatus error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/admin/accountants/:id/invite
export async function inviteAccountant(req, res) {
  try {
    // Confirms the accountant exists AND belongs to this admin's company
    // before an invite can be sent for it.
    await accountantService.getAccountantById({
      companyId: req.user.companyId,
      accountantId: req.params.id,
    });

    const { rawToken } = await accountantInviteService.createInvite({ accountantId: req.params.id });

    return res.status(200).json({
      success: true,
      message: "Invite created.",
      data: {
        // TODO: remove inviteLink from the response once email sending is
        // wired up — kept here for now so you can test the flow by hand.
        inviteLink: buildInviteLink("accountant", rawToken),
      },
    });
  } catch (err) {
    console.error("inviteAccountant error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// DELETE /api/admin/accountants/:id
export async function deleteAccountant(req, res) {
  try {
    await accountantService.deleteAccountant({
      companyId: req.user.companyId,
      accountantId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Accountant removed." });
  } catch (err) {
    console.error("deleteAccountant error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
