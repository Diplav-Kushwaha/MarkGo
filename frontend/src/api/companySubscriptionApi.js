import axiosInstance from "./axiosInstance";

/**
 * Company Admin subscription endpoints. Every call is scoped to the logged-in
 * company on the server — the company is taken from the session, never sent
 * from here. The CSRF header the two POSTs need is attached automatically by
 * the shared axios interceptor.
 */

// GET /api/admin/subscription
export async function getMySubscription() {
  const response = await axiosInstance.get("/api/admin/subscription");
  return response.data;
}

// GET /api/admin/subscription/history?page=&pageSize=
export async function getMySubscriptionHistory({ page = 1, pageSize = 10 } = {}) {
  const response = await axiosInstance.get("/api/admin/subscription/history", {
    params: { page, pageSize },
  });
  return response.data;
}

// POST /api/admin/subscription/purchase
export async function purchasePlan(planId) {
  const response = await axiosInstance.post("/api/admin/subscription/purchase", {
    planId,
  });
  return response.data;
}

// POST /api/admin/subscription/start-free
export async function startFree({ confirm } = {}) {
  const response = await axiosInstance.post("/api/admin/subscription/start-free", {
    ...(confirm ? { confirm: true } : {}),
  });
  return response.data;
}