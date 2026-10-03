import axiosInstance from "./axiosInstance";

/**
 * Public subscription endpoints — plans, and the dummy payment a new company
 * completes after choosing a paid plan. No authentication is involved, and the
 * CSRF header the backend wants on POSTs is attached automatically by the shared
 * axios interceptor.
 */

// GET /api/plans — active plans, Free first
export const getPlans = async () => {
  const response = await axiosInstance.get("/api/plans");
  return response.data;
};

// GET /api/subscription-payments/:paymentId — order summary
export const getPaymentSummary = async (paymentId) => {
  const response = await axiosInstance.get(`/api/subscription-payments/${paymentId}`);
  return response.data;
};

// POST /api/subscription-payments/:paymentId/confirm — the dummy "Pay now"
export const confirmDummyPayment = async (paymentId) => {
  const response = await axiosInstance.post(
    `/api/subscription-payments/${paymentId}/confirm`
  );
  return response.data;
};

// POST /api/subscription-payments/:paymentId/fail — the dummy "Simulate failure"
export const failDummyPayment = async (paymentId) => {
  const response = await axiosInstance.post(
    `/api/subscription-payments/${paymentId}/fail`
  );
  return response.data;
};