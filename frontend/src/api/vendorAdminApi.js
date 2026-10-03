import axiosInstance from "./axiosInstance";

/**
 * Create a new vendor under the current company
 * POST /api/admin/vendors
 */
export const createVendor = async (vendorData) => {
  const response = await axiosInstance.post("/api/admin/vendors", vendorData);
  return response.data;
};

/**
 * List vendors with optional search, status, vendorType, category, pagination, and sorting
 * GET /api/admin/vendors
 */
export const getVendors = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/vendors", { params });
  return response.data;
};

/**
 * Get vendor by id (with linked addresses and relationship data)
 * GET /api/admin/vendors/:id
 */
export const getVendorById = async (vendorId) => {
  const response = await axiosInstance.get(`/api/admin/vendors/${vendorId}`);
  return response.data;
};

/**
 * Update vendor details
 * PATCH /api/admin/vendors/:id
 */
export const updateVendor = async (vendorId, payload) => {
  const response = await axiosInstance.patch(`/api/admin/vendors/${vendorId}`, payload);
  return response.data;
};

/**
 * Update vendor status (ACTIVE or INACTIVE)
 * PATCH /api/admin/vendors/:id/status
 */
export const updateVendorStatus = async (vendorId, status) => {
  const response = await axiosInstance.patch(`/api/admin/vendors/${vendorId}/status`, { status });
  return response.data;
};

/**
 * Generate an invite link for a vendor
 * POST /api/admin/vendors/:id/invite
 */
export const createVendorInvite = async (vendorId) => {
  const response = await axiosInstance.post(`/api/admin/vendors/${vendorId}/invite`);
  return response.data;
};

/**
 * Permanently delete (soft delete) a vendor
 * DELETE /api/admin/vendors/:id
 */
export const deleteVendor = async (vendorId) => {
  const response = await axiosInstance.delete(`/api/admin/vendors/${vendorId}`);
  return response.data;
};

/**
 * Fetch vendor dashboard summary metrics
 * GET /api/admin/vendors/stats
 */
export const getVendorStats = async () => {
  const response = await axiosInstance.get("/api/admin/vendors/stats");
  return response.data;
};

/**
 * Bulk actions on vendors (ACTIVATE, DEACTIVATE, DELETE)
 * POST /api/admin/vendors/bulk
 */
export const bulkActionVendors = async ({ vendorIds, action }) => {
  const response = await axiosInstance.post("/api/admin/vendors/bulk", {
    vendorIds,
    action,
  });
  return response.data;
};

/**
 * Export vendor dataset for CSV/Excel
 * GET /api/admin/vendors/export
 */
export const exportVendors = async () => {
  const response = await axiosInstance.get("/api/admin/vendors/export");
  return response.data;
};
