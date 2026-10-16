import axiosInstance from "./axiosInstance";

/**
 * Fetch the full set of units visible to the current company (built-in +
 * custom), returned as id/fullName/shortName/isPackage/isSystem. Used for the
 * base-unit dropdown and for deriving list stat cards.
 * GET /api/admin/units/options
 */
export const getUnitOptions = async () => {
  const response = await axiosInstance.get("/api/admin/units/options");
  return response.data;
};

/**
 * Fetch a paginated, filtered, searched list of units.
 * GET /api/admin/units?search=&source=&type=&page=&pageSize=
 */
export const getUnits = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/units", { params });
  return response.data;
};

/**
 * Fetch a single unit by id.
 * GET /api/admin/units/:id
 */
export const getUnitById = async (unitId) => {
  const response = await axiosInstance.get(`/api/admin/units/${unitId}`);
  return response.data;
};

/**
 * Create a new (custom) unit.
 * POST /api/admin/units
 */
export const createUnit = async (payload) => {
  const response = await axiosInstance.post("/api/admin/units", payload);
  return response.data;
};

/**
 * Update an existing unit.
 * PATCH /api/admin/units/:id
 */
export const updateUnit = async (unitId, payload) => {
  const response = await axiosInstance.patch(`/api/admin/units/${unitId}`, payload);
  return response.data;
};

/**
 * Delete a unit.
 * DELETE /api/admin/units/:id
 */
export const deleteUnit = async (unitId) => {
  const response = await axiosInstance.delete(`/api/admin/units/${unitId}`);
  return response.data;
};
