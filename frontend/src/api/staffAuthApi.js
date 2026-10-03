import axiosInstance from "./axiosInstance";

/**
 * Validates a staff invite token on page load
 * GET /api/staff/verify-invite?token=...
 */
export const verifyStaffInviteToken = async (token) => {
  const response = await axiosInstance.get(`/api/staff/verify-invite?token=${encodeURIComponent(token)}`);
  return response.data;
};

/**
 * Sets initial password using staff invite token
 * POST /api/staff/accept-invite
 */
export const acceptStaffInvite = async ({ token, password }) => {
  const response = await axiosInstance.post("/api/staff/accept-invite", {
    token,
    password,
  });
  return response.data;
};

/**
 * Staff sign in
 * POST /api/staff/login
 */
export const loginStaff = async ({ companySlug, email, password }) => {
  const response = await axiosInstance.post("/api/staff/login", {
    companySlug,
    email,
    password,
  });
  return response.data;
};

/**
 * Staff session refresh
 * POST /api/staff/refresh
 */
export const refreshStaffToken = async () => {
  const response = await axiosInstance.post("/api/staff/refresh");
  return response.data;
};

/**
 * Staff sign out
 * POST /api/staff/logout
 */
export const logoutStaff = async () => {
  const response = await axiosInstance.post("/api/staff/logout");
  return response.data;
};

/**
 * Fetch authenticated staff member's profile
 * GET /api/staff/me
 */
export const getStaffProfile = async () => {
  const response = await axiosInstance.get("/api/staff/me");
  return response.data;
};
