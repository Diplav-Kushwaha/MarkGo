import axiosInstance from "./axiosInstance";

/**
 * Validates an accountant invite token on page load
 * GET /api/accountant/verify-invite?token=...
 */
export const verifyAccountantInviteToken = async (token) => {
  const response = await axiosInstance.get(`/api/accountant/verify-invite?token=${encodeURIComponent(token)}`);
  return response.data;
};

/**
 * Sets initial password using accountant invite token
 * POST /api/accountant/accept-invite
 */
export const acceptAccountantInvite = async ({ token, password }) => {
  const response = await axiosInstance.post("/api/accountant/accept-invite", {
    token,
    password,
  });
  return response.data;
};

/**
 * Accountant sign in
 * POST /api/accountant/login
 */
export const loginAccountant = async ({ companySlug, email, password }) => {
  const response = await axiosInstance.post("/api/accountant/login", {
    companySlug,
    email,
    password,
  });
  return response.data;
};

/**
 * Accountant session refresh
 * POST /api/accountant/refresh
 */
export const refreshAccountantToken = async () => {
  const response = await axiosInstance.post("/api/accountant/refresh");
  return response.data;
};

/**
 * Accountant sign out
 * POST /api/accountant/logout
 */
export const logoutAccountant = async () => {
  const response = await axiosInstance.post("/api/accountant/logout");
  return response.data;
};

/**
 * Fetch authenticated accountant's profile
 * GET /api/accountant/me
 */
export const getAccountantProfile = async () => {
  const response = await axiosInstance.get("/api/accountant/me");
  return response.data;
};
