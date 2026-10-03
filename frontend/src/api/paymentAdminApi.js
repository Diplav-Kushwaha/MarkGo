import axiosInstance from "./axiosInstance";

/**
 * Fetch payments (money in from invoices, money out against bills).
 * GET /admin/payments
 */
export async function getPayments(params = {}) {
  const response = await axiosInstance.get("/api/admin/payments", { params });
  return response.data;
}

/**
 * Fetch payment totals (totalIn / totalOut / net).
 * GET /admin/payments/summary
 */
export async function getPaymentSummary(params = {}) {
  const response = await axiosInstance.get("/api/admin/payments/summary", { params });
  return response.data;
}

/**
 * Record a payment against an invoice.
 * POST /admin/payments/invoice/:invoiceId
 */
export async function recordInvoicePayment(invoiceId, payload) {
  const response = await axiosInstance.post(`/api/admin/payments/invoice/${invoiceId}`, payload);
  return response.data;
}

/**
 * Record a payment against a bill.
 * POST /admin/payments/bill/:billId
 */
export async function recordBillPayment(billId, payload) {
  const response = await axiosInstance.post(`/api/admin/payments/bill/${billId}`, payload);
  return response.data;
}
