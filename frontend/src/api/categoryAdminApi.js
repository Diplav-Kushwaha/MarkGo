import axiosInstance from "./axiosInstance";

/**
 * Fetch a paginated, filtered, searched list of categories.
 * GET /api/admin/categories?search=&source=&type=&page=&pageSize=
 */
export const getCategories = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/categories", { params });
  return response.data;
};

/**
 * Fetch a single category by id.
 * GET /api/admin/categories/:id
 */
export const getCategoryById = async (categoryId) => {
  const response = await axiosInstance.get(`/api/admin/categories/${categoryId}`);
  return response.data;
};

/**
 * Fetch the full set of categories visible to the current company, used for the
 * category picker on future product/service forms.
 * GET /api/admin/categories/options
 */
export const getCategoryOptions = async () => {
  const response = await axiosInstance.get("/api/admin/categories/options");
  return response.data;
};

/**
 * Create a new (custom) category.
 * POST /api/admin/categories
 */
export const createCategory = async (payload) => {
  const response = await axiosInstance.post("/api/admin/categories", payload);
  return response.data;
};

/**
 * Update an existing category.
 * PATCH /api/admin/categories/:id
 */
export const updateCategory = async (categoryId, payload) => {
  const response = await axiosInstance.patch(`/api/admin/categories/${categoryId}`, payload);
  return response.data;
};

/**
 * Delete a category.
 * DELETE /api/admin/categories/:id
 */
export const deleteCategory = async (categoryId) => {
  const response = await axiosInstance.delete(`/api/admin/categories/${categoryId}`);
  return response.data;
};
