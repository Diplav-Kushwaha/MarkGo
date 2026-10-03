import axiosInstance from "./axiosInstance";

/**
 * Super Admin subscription endpoints: plan management, the platform-wide
 * subscription list and the revenue summary.
 *
 * The CSRF header the two write calls need is attached automatically by the
 * shared axios interceptor on every non-GET request.
 */

// GET /api/superadmin/plans
export const getSuperAdminPlans = async () => {
  const response = await axiosInstance.get("/api/superadmin/plans");
  return response.data;
};

// POST /api/superadmin/plans
export const createSuperAdminPlan = async (body) => {
  const response = await axiosInstance.post("/api/superadmin/plans", body);
  return response.data;
};

// PATCH /api/superadmin/plans/:id — partial; billingCycle is never sent.
export const updateSuperAdminPlan = async (id, body) => {
  const response = await axiosInstance.patch(`/api/superadmin/plans/${id}`, body);
  return response.data;
};

// GET /api/superadmin/subscriptions — all filtering and paging is server-side.
export const getSuperAdminSubscriptions = async (params = {}) => {
  const response = await axiosInstance.get("/api/superadmin/subscriptions", { params });
  return response.data;
};

// GET /api/superadmin/subscriptions/summary
export const getSuperAdminSubscriptionSummary = async () => {
  const response = await axiosInstance.get("/api/superadmin/subscriptions/summary");
  return response.data;
};

// PATCH /api/superadmin/companies/:id/status — ACTIVE <-> SUSPENDED only.
export const setSuperAdminCompanyStatus = async (id, status) => {
  const response = await axiosInstance.patch(`/api/superadmin/companies/${id}/status`, {
    status,
  });
  return response.data;
};

// POST /api/superadmin/companies — creates the company, its admin and its plan.
export const createSuperAdminCompany = async (body) => {
  const response = await axiosInstance.post("/api/superadmin/companies", body);
  return response.data;
};

// POST /api/superadmin/companies/:id/subscription — assigns a plan.
export const assignSuperAdminCompanyPlan = async (id, body) => {
  const response = await axiosInstance.post(
    `/api/superadmin/companies/${id}/subscription`,
    body
  );
  return response.data;
};

// DELETE /api/superadmin/companies/:id/pending — abandoned pending registrations.
export const deleteSuperAdminPendingCompany = async (id) => {
  const response = await axiosInstance.delete(`/api/superadmin/companies/${id}/pending`);
  return response.data;
};