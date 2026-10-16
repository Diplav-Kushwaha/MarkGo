import axiosInstance from "./axiosInstance";

/**
 * Product APIs for the new Products logic.
 *
 * Products and Services share one Item model in the database, but the backend
 * now serves them through separate code paths. Every request below declares
 * `type: "PRODUCT"`, which is what routes it to the product rules (new fields,
 * product-code duplicate rule, stock filters, summary) instead of the service
 * ones. `type` is injected here rather than at each call site so a caller can
 * never forget it.
 *
 * The helpers in `itemAdminApi.js` are deliberately left untouched: the Services
 * page still uses them and must keep its existing behaviour.
 */

const PRODUCT_TYPE = "PRODUCT";

/**
 * Company-wide product totals, unaffected by any list filter.
 * GET /api/admin/items/summary
 */
export const getProductSummary = async () => {
  const response = await axiosInstance.get("/api/admin/items/summary");
  return response.data;
};

/**
 * Paginated, filtered product list.
 * GET /api/admin/items?search=&status=&stock=&sort=&page=&pageSize=
 */
export const getProducts = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/items", {
    params: { ...params, type: PRODUCT_TYPE },
  });
  return response.data;
};

/** Fetch a single product. GET /api/admin/items/:id */
export const getProductById = async (productId) => {
  const response = await axiosInstance.get(`/api/admin/items/${productId}`);
  return response.data;
};

/** Create a product. POST /api/admin/items */
export const createProduct = async (payload) => {
  const response = await axiosInstance.post("/api/admin/items", {
    ...payload,
    type: PRODUCT_TYPE,
  });
  return response.data;
};

/** Update a product. PATCH /api/admin/items/:id */
export const updateProduct = async (productId, payload) => {
  const response = await axiosInstance.patch(`/api/admin/items/${productId}`, {
    ...payload,
    type: PRODUCT_TYPE,
  });
  return response.data;
};

/** Set a product Available / Not available. PATCH /api/admin/items/:id/status */
export const updateProductStatus = async (productId, status) => {
  const response = await axiosInstance.patch(`/api/admin/items/${productId}/status`, { status });
  return response.data;
};

/** Remove a single product from the catalogue. DELETE /api/admin/items/:id */
export const deleteProduct = async (productId) => {
  const response = await axiosInstance.delete(`/api/admin/items/${productId}`);
  return response.data;
};
