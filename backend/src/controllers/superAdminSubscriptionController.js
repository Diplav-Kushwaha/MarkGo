import * as superAdminPlanService from "../services/superAdminPlanService.js";
import * as superAdminCompanyService from "../services/superAdminCompanyService.js";
import * as superAdminCompanyCreateService from "../services/superAdminCompanyCreateService.js";
import * as superAdminSubscriptionService from "../services/superAdminSubscriptionService.js";

/**
 * Super Admin plan, company-status and subscription endpoints.
 * All are read-only apart from plan create/update and company status, and all
 * are restricted to the SUPERADMIN role by the router.
 */

/** GET /api/superadmin/plans */
export async function listPlans(req, res) {
  try {
    const result = await superAdminPlanService.listPlans();
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("listPlans error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message || "Internal server error." });
  }
}

/** POST /api/superadmin/plans */
export async function createPlan(req, res) {
  try {
    const plan = await superAdminPlanService.createPlan(
      { ...req.body, createdByUserId: req.user?.userId },
      { ip: req.ip }
    );
    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    console.error("createPlan error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message || "Internal server error." });
  }
}

/** PATCH /api/superadmin/plans/:id */
export async function updatePlan(req, res) {
  try {
    const plan = await superAdminPlanService.updatePlan(
      req.params.id,
      { ...req.body, updatedByUserId: req.user?.userId },
      { ip: req.ip }
    );
    return res.status(200).json({ success: true, data: plan });
  } catch (err) {
    console.error("updatePlan error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message || "Internal server error." });
  }
}

/** PATCH /api/superadmin/companies/:id/status */
export async function setCompanyStatus(req, res) {
  try {
    const result = await superAdminCompanyService.setCompanyStatus(
      req.params.id,
      req.body.status,
      { ip: req.ip, userId: req.user?.userId }
    );
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("setCompanyStatus error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message || "Internal server error." });
  }
}

/** GET /api/superadmin/subscriptions */
export async function listSubscriptions(req, res) {
  try {
    const { state, planId, companyId, search, days, page, pageSize } =
      req.validatedQuery || {};

    const result = await superAdminSubscriptionService.listSubscriptions({
      state,
      planId,
      companyId,
      search,
      days,
      page,
      pageSize,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("listSubscriptions error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message || "Internal server error." });
  }
}

/** GET /api/superadmin/subscriptions/summary */
export async function getSubscriptionSummary(req, res) {
  try {
    const result = await superAdminSubscriptionService.getSubscriptionSummary();
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getSubscriptionSummary error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message || "Internal server error." });
  }
}

/**
 * POST /api/superadmin/companies
 * Creates a company plus its first admin and subscription in one transaction.
 * No token or cookie is issued, so the Super Admin session is untouched.
 */
export async function createCompany(req, res) {
  try {
    const result = await superAdminCompanyCreateService.createCompanyWithPlan(
      req.body,
      { ip: req.ip, userId: req.user?.userId }
    );
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("createCompany error:", err);
    return res
      .status(err.status || 500)
      .json({
        success: false,
        message: err.message || "Internal server error.",
        ...(err.data ? { data: err.data } : {}),
      });
  }
}

/** POST /api/superadmin/companies/:id/subscription */
export async function assignSubscription(req, res) {
  try {
    const result = await superAdminCompanyService.assignPlanToCompany(
      req.params.id,
      req.body,
      { ip: req.ip, userId: req.user?.userId }
    );
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("assignSubscription error:", err);
    return res
      .status(err.status || 500)
      .json({
        success: false,
        message: err.message || "Internal server error.",
        ...(err.data ? { data: err.data } : {}),
      });
  }
}

/** DELETE /api/superadmin/companies/:id/pending */
export async function deletePendingCompany(req, res) {
  try {
    const result = await superAdminCompanyService.deletePendingCompany(
      req.params.id,
      { ip: req.ip, userId: req.user?.userId }
    );
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("deletePendingCompany error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message || "Internal server error." });
  }
}