import axiosInstance from "./axiosInstance";

/**
 * Validates an invite token on page load
 * GET /api/customer/verify-invite?token=...
 */
export const verifyCustomerInviteToken = async (token) => {
  const response = await axiosInstance.get(`/api/customer/verify-invite?token=${encodeURIComponent(token)}`);
  return response.data;
};

/**
 * Sets initial password using invite token
 * POST /api/customer/accept-invite
 */
export const acceptCustomerInvite = async ({ token, password }) => {
  const response = await axiosInstance.post("/api/customer/accept-invite", {
    token,
    password,
  });
  return response.data;
};

/**
 * Customer sign in
 * POST /api/customer/login
 */
export const loginCustomer = async ({ companySlug, email, password }) => {
  const response = await axiosInstance.post("/api/customer/login", {
    companySlug,
    email,
    password,
  });
  return response.data;
};

/**
 * Customer session refresh
 * POST /api/customer/refresh
 */
export const refreshCustomerToken = async () => {
  const response = await axiosInstance.post("/api/customer/refresh");
  return response.data;
};

/**
 * Customer sign out
 * POST /api/customer/logout
 */
export const logoutCustomer = async () => {
  const response = await axiosInstance.post("/api/customer/logout");
  return response.data;
};

/**
 * Fetch authenticated customer's profile
 * GET /api/customer/me
 */
export const getCustomerProfile = async () => {
  const response = await axiosInstance.get("/api/customer/me");
  return response.data;
};
