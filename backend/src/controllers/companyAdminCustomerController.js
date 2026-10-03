import * as customerService from "../services/customerService.js";
import * as customerInviteService from "../services/customerInviteService.js";
import { buildInviteLink } from "../utils/inviteLink.js";

// POST /api/admin/customers
export async function createCustomer(req, res) {
  try {
    const customer = await customerService.createCustomer({
      companyId: req.user.companyId,
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Customer created.", data: customer });
  } catch (err) {
    console.error("createCustomer error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/customers?search=&status=&page=&pageSize=
export async function getCustomers(req, res) {
  try {
    const { search, status, page, pageSize } = req.query;
    const result = await customerService.listCustomers({
      companyId: req.user.companyId,
      search,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getCustomers error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/customers/:id
export async function getCustomerById(req, res) {
  try {
    const customer = await customerService.getCustomerById({
      companyId: req.user.companyId,
      customerId: req.params.id,
    });
    return res.status(200).json({ success: true, data: customer });
  } catch (err) {
    console.error("getCustomerById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/customers/:id
export async function updateCustomer(req, res) {
  try {
    const customer = await customerService.updateCustomer({
      companyId: req.user.companyId,
      customerId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Customer updated.", data: customer });
  } catch (err) {
    console.error("updateCustomer error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/customers/:id/status
export async function updateCustomerStatus(req, res) {
  try {
    const customer = await customerService.updateCustomerStatus({
      companyId: req.user.companyId,
      customerId: req.params.id,
      status: req.body.status,
    });
    return res.status(200).json({ success: true, message: "Customer status updated.", data: customer });
  } catch (err) {
    console.error("updateCustomerStatus error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/customers/stats
export async function getCustomerStats(req, res) {
  try {
    const stats = await customerService.getCustomerStats({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error("getCustomerStats error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/customers/export
export async function exportCustomers(req, res) {
  try {
    const customers = await customerService.getCustomersForExport({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: customers });
  } catch (err) {
    console.error("exportCustomers error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/customers/lookup-gstin?gstin=
export async function lookupGstin(req, res) {
  try {
    const result = await customerService.lookupGstin(req.query.gstin);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("lookupGstin error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/admin/customers/:id/invite
export async function inviteCustomer(req, res) {
  try {
    // Confirms the customer exists AND belongs to this admin's company
    // before an invite can be sent for it.
    await customerService.getCustomerById({
      companyId: req.user.companyId,
      customerId: req.params.id,
    });

    const { rawToken } = await customerInviteService.createInvite({ customerId: req.params.id });

    return res.status(200).json({
      success: true,
      message: "Invite created.",
      data: {
        // TODO: remove inviteLink from the response once email sending is
        // wired up — kept here for now so you can test the flow by hand.
        inviteLink: buildInviteLink("customer", rawToken),
      },
    });
  } catch (err) {
    console.error("inviteCustomer error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// DELETE /api/admin/customers/:id
export async function deleteCustomer(req, res) {
  try {
    await customerService.deleteCustomer({
      companyId: req.user.companyId,
      customerId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Customer removed." });
  } catch (err) {
    console.error("deleteCustomer error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// POST /api/admin/customers/bulk
export async function bulkActionCustomers(req, res) {
  try {
    const { customerIds, action } = req.body;
    const result = await customerService.bulkActionCustomers({
      companyId: req.user.companyId,
      customerIds,
      action,
    });
    return res.status(200).json({ success: true, message: "Bulk action completed.", data: result });
  } catch (err) {
    console.error("bulkActionCustomers error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
