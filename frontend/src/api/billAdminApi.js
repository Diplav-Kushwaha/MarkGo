import axiosInstance from "./axiosInstance";

/**
 * Fetch bills (vendor expenses) with optional filters and pagination.
 * GET /admin/bills
 */
export async function getBills(params = {}) {
  const response = await axiosInstance.get("/api/admin/bills", { params });
  return response.data;
}

/**
 * Fetch bill financial summary.
 * GET /admin/bills/summary
 */
export async function getBillSummary() {
  const response = await axiosInstance.get("/api/admin/bills/summary");
  return response.data;
}

/**
 * Fetch a single bill with items and payments.
 * GET /admin/bills/:id
 */
export async function getBillById(id) {
  const response = await axiosInstance.get(`/api/admin/bills/${id}`);
  return response.data;
}

/**
 * Create a new bill.
 * POST /admin/bills
 */
export async function createBill(payload) {
  const response = await axiosInstance.post("/api/admin/bills", payload);
  return response.data;
}

/**
 * Update an existing bill.
 * PUT /admin/bills/:id
 */
export async function updateBill(id, payload) {
  const response = await axiosInstance.put(`/api/admin/bills/${id}`, payload);
  return response.data;
}

/**
 * Record a payment against a bill.
 * POST /admin/bills/:id/payments
 */
export async function recordBillPayment(id, payload) {
  const response = await axiosInstance.post(`/api/admin/bills/${id}/payments`, payload);
  return response.data;
}

/**
 * Mark a bill fully paid.
 * POST /admin/bills/:id/mark-paid
 */
export async function markBillPaid(id) {
  const response = await axiosInstance.post(`/api/admin/bills/${id}/mark-paid`);
  return response.data;
}
