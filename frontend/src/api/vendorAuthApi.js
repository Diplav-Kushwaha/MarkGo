import axiosInstance from "./axiosInstance";

/**
 * Validates a vendor invite token on page load
 * GET /api/vendor/verify-invite?token=...
 */
export const verifyVendorInviteToken = async (token) => {
  const response = await axiosInstance.get(`/api/vendor/verify-invite?token=${encodeURIComponent(token)}`);
  return response.data;
};

/**
 * Sets initial password using vendor invite token
 * POST /api/vendor/accept-invite
 */
export const acceptVendorInvite = async ({ token, password }) => {
  const response = await axiosInstance.post("/api/vendor/accept-invite", {
    token,
    password,
  });
  return response.data;
};

/**
 * Vendor sign in
 * POST /api/vendor/login
 */
export const loginVendor = async ({ companySlug, phoneNumber, password }) => {
  const response = await axiosInstance.post("/api/vendor/login", {
    companySlug,
    phoneNumber,
    password,
  });
  return response.data;
};

/**
 * Vendor session refresh
 * POST /api/vendor/refresh
 */
export const refreshVendorToken = async () => {
  const response = await axiosInstance.post("/api/vendor/refresh");
  return response.data;
};

/**
 * Vendor sign out
 * POST /api/vendor/logout
 */
export const logoutVendor = async () => {
  const response = await axiosInstance.post("/api/vendor/logout");
  return response.data;
};

/**
 * Fetch authenticated vendor's profile
 * GET /api/vendor/me
 */
export const getVendorProfile = async () => {
  const response = await axiosInstance.get("/api/vendor/me");
  return response.data;
};
