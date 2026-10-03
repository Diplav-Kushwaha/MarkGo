import axiosInstance from "./axiosInstance";

/**
 * Create a new customer under the current company
 * POST /api/admin/customers
 */
export const createCustomer = async (customerData) => {
  const response = await axiosInstance.post("/api/admin/customers", customerData);
  return response.data;
};

/**
 * List customers with optional search, status, and pagination
 * GET /api/admin/customers?search=&status=&page=&pageSize=
 */
export const getCustomers = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/customers", { params });
  return response.data;
};

/**
 * Get customer by id
 * GET /api/admin/customers/:id
 */
export const getCustomerById = async (customerId) => {
  const response = await axiosInstance.get(`/api/admin/customers/${customerId}`);
  return response.data;
};

/**
 * Update customer details
 * PATCH /api/admin/customers/:id
 */
export const updateCustomer = async (customerId, payload) => {
  const response = await axiosInstance.patch(`/api/admin/customers/${customerId}`, payload);
  return response.data;
};

/**
 * Update customer status (ACTIVE or INACTIVE)
 * PATCH /api/admin/customers/:id/status
 */
export const updateCustomerStatus = async (customerId, status) => {
  const response = await axiosInstance.patch(`/api/admin/customers/${customerId}/status`, { status });
  return response.data;
};

/**
 * Generate an invite link for a customer
 * POST /api/admin/customers/:id/invite
 */
export const createCustomerInvite = async (customerId) => {
  const response = await axiosInstance.post(`/api/admin/customers/${customerId}/invite`);
  return response.data;
};

/**
 * Permanently delete a customer
 * DELETE /api/admin/customers/:id
 */
export const deleteCustomer = async (customerId) => {
  const response = await axiosInstance.delete(`/api/admin/customers/${customerId}`);
  return response.data;
};

/**
 * Fetch customer dashboard summary metrics
 * GET /api/admin/customers/stats
 */
export const getCustomerStats = async () => {
  const response = await axiosInstance.get("/api/admin/customers/stats");
  return response.data;
};

/**
 * Bulk actions on customers (ACTIVATE, DEACTIVATE, DELETE)
 * POST /api/admin/customers/bulk
 */
export const bulkActionCustomers = async ({ customerIds, action }) => {
  const response = await axiosInstance.post("/api/admin/customers/bulk", {
    customerIds,
    action,
  });
  return response.data;
};

/**
 * Export customer dataset for CSV/Excel
 * GET /api/admin/customers/export
 */
export const exportCustomers = async () => {
  const response = await axiosInstance.get("/api/admin/customers/export");
  return response.data;
};

/**
 * Mock / Dummy GSTIN Auto-fetch lookup
 * GET /api/admin/customers/lookup-gstin?gstin=...
 */
export const lookupCustomerGstin = async (gstin) => {
  const response = await axiosInstance.get(`/api/admin/customers/lookup-gstin?gstin=${encodeURIComponent(gstin)}`);
  return response.data;
};
