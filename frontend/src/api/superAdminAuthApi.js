import axiosInstance from "./axiosInstance";

export const loginSuperAdmin = async ({ email, password }) => {
  const response = await axiosInstance.post("/api/superadmin/login", {
    email,
    password,
  });
  return response.data;
};

export const logoutSuperAdmin = async () => {
  const response = await axiosInstance.post("/api/superadmin/logout");
  return response.data;
};

export const getSuperAdminProfile = async () => {
  const response = await axiosInstance.get("/api/superadmin/me");
  return response.data;
};

/**
 * Platform-wide company list.
 * Accepts (and forwards to the backend) search, page, pageSize, status,
 * sortBy (name | createdAt | email) and sortOrder (asc | desc).
 * Calling it with no arguments still works exactly as before.
 *
 * GET /api/superadmin/companies
 */
export const getAllCompanies = async (params = {}) => {
  const response = await axiosInstance.get("/api/superadmin/companies", { params });
  return response.data;
};

/**
 * Platform-wide totals for the Super Admin dashboard: company totals and
 * per-status breakdown, vendor/customer counts, invoice
 * count, total billed, total expense, profit/loss and the 5 newest companies.
 *
 * GET /api/superadmin/dashboard
 */
export const getSuperAdminDashboard = async () => {
  const response = await axiosInstance.get("/api/superadmin/dashboard");
  return response.data;
};

/**
 * Read-only details for one company: profile, profit/loss and headcount.
 * GET /api/superadmin/companies/:id
 */
export const getSuperAdminCompanyDetails = async (id) => {
  const response = await axiosInstance.get(`/api/superadmin/companies/${id}`);
  return response.data;
};
