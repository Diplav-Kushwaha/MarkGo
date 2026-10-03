import axiosInstance from "./axiosInstance";

/**
 * Create a new accountant under the current company
 * POST /api/admin/accountants
 */
export const createAccountant = async (accountantData) => {
  const response = await axiosInstance.post("/api/admin/accountants", accountantData);
  return response.data;
};

/**
 * List accountants with optional search, status, and pagination
 * GET /api/admin/accountants?search=&status=&page=&pageSize=
 */
export const getAccountants = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/accountants", { params });
  return response.data;
};

/**
 * Get accountant by id
 * GET /api/admin/accountants/:id
 */
export const getAccountantById = async (accountantId) => {
  const response = await axiosInstance.get(`/api/admin/accountants/${accountantId}`);
  return response.data;
};

/**
 * Update accountant details
 * PATCH /api/admin/accountants/:id
 */
export const updateAccountant = async (accountantId, payload) => {
  const response = await axiosInstance.patch(`/api/admin/accountants/${accountantId}`, payload);
  return response.data;
};

/**
 * Update accountant status (ACTIVE or INACTIVE)
 * PATCH /api/admin/accountants/:id/status
 */
export const updateAccountantStatus = async (accountantId, status) => {
  const response = await axiosInstance.patch(`/api/admin/accountants/${accountantId}/status`, { status });
  return response.data;
};

/**
 * Generate an invite link for an accountant
 * POST /api/admin/accountants/:id/invite
 */
export const createAccountantInvite = async (accountantId) => {
  const response = await axiosInstance.post(`/api/admin/accountants/${accountantId}/invite`);
  return response.data;
};

/**
 * Permanently delete an accountant
 * DELETE /api/admin/accountants/:id
 */
export const deleteAccountant = async (accountantId) => {
  const response = await axiosInstance.delete(`/api/admin/accountants/${accountantId}`);
  return response.data;
};
