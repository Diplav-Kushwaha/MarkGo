import axiosInstance from "./axiosInstance";
import { SERVICE_TYPE } from "../lib/serviceConstants";

/**
 * Service APIs for the new Services logic.
 *
 * Services and Products share one Item model in the database, but the backend
 * serves them through separate code paths. Every request below declares
 * `type: "SERVICE"`, which is what routes it to the service rules (serviceCode,
 * unit/category dropdowns, no stock) instead of the product ones. `type` is
 * injected here rather than at each call site so a caller can never forget it.
 *
 * The helpers in `itemAdminApi.js` are deliberately left untouched: the Products
 * page and the invoice pickers keep using them unchanged.
 *
 * Endpoint map (verified against the backend routes):
 *   GET    /api/admin/services/summary          -> totalServices / available / unavailable
 *   GET    /api/admin/items?type=SERVICE        -> list (search, status, sort, page, pageSize)
 *   GET    /api/admin/items/:id                 -> single service
 *   POST   /api/admin/items                     -> create
 *   PATCH  /api/admin/items/:id                 -> update
 *   PATCH  /api/admin/items/:id/status          -> ACTIVE / INACTIVE
 *   DELETE /api/admin/items/:id                 -> remove one service
 */

/**
 * Company-wide service totals, unaffected by any list filter.
 * GET /api/admin/services/summary
 */
export const getServiceSummary = async () => {
  const response = await axiosInstance.get("/api/admin/services/summary");
  return response.data;
};

/**
 * Paginated, filtered service list.
 * GET /api/admin/items?search=&status=&sort=&page=&pageSize=
 *
 * `status` takes the friendly spellings (`available` / `notavailable`); the
 * service path accepts the stored values too.
 */
export const getServices = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/items", {
    params: { ...params, type: SERVICE_TYPE },
  });
  return response.data;
};

/** Fetch a single service. GET /api/admin/items/:id */
export const getServiceById = async (serviceId) => {
  const response = await axiosInstance.get(`/api/admin/items/${serviceId}`);
  return response.data;
};

/**
 * Create a service. POST /api/admin/items
 *
 * The payload carries only the service fields (`name`, `serviceCode`,
 * `sellingPrice`, `sellingPriceTaxMode`, `unitId`, `categoryId` and the optional
 * `description`, `status`, `taxRate`); `type` is appended here.
 */
export const createService = async (payload) => {
  const response = await axiosInstance.post("/api/admin/items", {
    ...payload,
    type: SERVICE_TYPE,
  });
  return response.data;
};

/** Update a service. PATCH /api/admin/items/:id */
export const updateService = async (serviceId, payload) => {
  const response = await axiosInstance.patch(`/api/admin/items/${serviceId}`, {
    ...payload,
    type: SERVICE_TYPE,
  });
  return response.data;
};

/** Set a service Available / Not available. PATCH /api/admin/items/:id/status */
export const updateServiceStatus = async (serviceId, status) => {
  const response = await axiosInstance.patch(`/api/admin/items/${serviceId}/status`, { status });
  return response.data;
};

/** Remove a single service from the catalogue. DELETE /api/admin/items/:id */
export const deleteService = async (serviceId) => {
  const response = await axiosInstance.delete(`/api/admin/items/${serviceId}`);
  return response.data;
};
