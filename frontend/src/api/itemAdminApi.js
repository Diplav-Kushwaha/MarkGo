import axiosInstance from "./axiosInstance";

/**
 * Fetch catalog overview cards / stats
 * GET /api/admin/items/stats
 */
export const getItemStats = async () => {
  const response = await axiosInstance.get("/api/admin/items/stats");
  return response.data;
};

/**
 * Fetch paginated, filtered, searched items
 * GET /api/admin/items?search=&type=&category=&status=&stockLevel=&page=&pageSize=&sortBy=&sortOrder=
 */
export const getItems = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/items", { params });
  return response.data;
};

/**
 * Fetch single item by ID
 * GET /api/admin/items/:id
 */
export const getItemById = async (itemId) => {
  const response = await axiosInstance.get(`/api/admin/items/${itemId}`);
  return response.data;
};

/**
 * Create new Product or Service
 * POST /api/admin/items
 */
export const createItem = async (payload) => {
  const response = await axiosInstance.post("/api/admin/items", payload);
  return response.data;
};

/**
 * Update existing item
 * PATCH /api/admin/items/:id
 */
export const updateItem = async (itemId, payload) => {
  const response = await axiosInstance.patch(`/api/admin/items/${itemId}`, payload);
  return response.data;
};

/**
 * Toggle or set item status (ACTIVE or INACTIVE)
 * PATCH /api/admin/items/:id/status
 */
export const updateItemStatus = async (itemId, status) => {
  const response = await axiosInstance.patch(`/api/admin/items/${itemId}/status`, { status });
  return response.data;
};

/**
 * Soft delete an item
 * DELETE /api/admin/items/:id
 */
export const deleteItem = async (itemId) => {
  const response = await axiosInstance.delete(`/api/admin/items/${itemId}`);
  return response.data;
};

/**
 * Perform bulk operations (ACTIVATE, DEACTIVATE, DELETE, ASSIGN_CATEGORY)
 * POST /api/admin/items/bulk
 */
export const bulkActionItems = async ({ itemIds, action, category }) => {
  const response = await axiosInstance.post("/api/admin/items/bulk", {
    itemIds,
    action,
    category,
  });
  return response.data;
};

/**
 * Export catalog to CSV dataset
 * GET /api/admin/items/export
 */
export const exportItems = async () => {
  const response = await axiosInstance.get("/api/admin/items/export");
  return response.data;
};
