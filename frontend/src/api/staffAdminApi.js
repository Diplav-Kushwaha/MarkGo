import axiosInstance from "./axiosInstance";

/**
 * Create a new staff member under the current company
 * POST /api/admin/staff
 */
export const createStaff = async (staffData) => {
  const response = await axiosInstance.post("/api/admin/staff", staffData);
  return response.data;
};

/**
 * List staff members with optional search, status, and pagination
 * GET /api/admin/staff?search=&status=&page=&pageSize=
 */
export const getStaffList = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/staff", { params });
  return response.data;
};

/**
 * Get staff member by id
 * GET /api/admin/staff/:id
 */
export const getStaffById = async (staffId) => {
  const response = await axiosInstance.get(`/api/admin/staff/${staffId}`);
  return response.data;
};

/**
 * Update staff member details
 * PATCH /api/admin/staff/:id
 */
export const updateStaff = async (staffId, payload) => {
  const response = await axiosInstance.patch(`/api/admin/staff/${staffId}`, payload);
  return response.data;
};

/**
 * Update staff status (ACTIVE or INACTIVE)
 * PATCH /api/admin/staff/:id/status
 */
export const updateStaffStatus = async (staffId, status) => {
  const response = await axiosInstance.patch(`/api/admin/staff/${staffId}/status`, { status });
  return response.data;
};

/**
 * Generate an invite link for a staff member
 * POST /api/admin/staff/:id/invite
 */
export const createStaffInvite = async (staffId) => {
  const response = await axiosInstance.post(`/api/admin/staff/${staffId}/invite`);
  return response.data;
};

/**
 * Permanently delete a staff member
 * DELETE /api/admin/staff/:id
 */
export const deleteStaff = async (staffId) => {
  const response = await axiosInstance.delete(`/api/admin/staff/${staffId}`);
  return response.data;
};
