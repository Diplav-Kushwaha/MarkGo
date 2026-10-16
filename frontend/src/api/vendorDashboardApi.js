import axiosInstance from "./axiosInstance";

/**
 * Vendor dashboard API — strictly read-only helpers for the signed-in vendor.
 *
 * Every helper below is a GET. Identity (which vendor / company) is resolved
 * server-side from the vendor access cookie, so nothing is passed to scope the
 * results. There are intentionally no create/update/delete helpers here, so no
 * vendor page can ever issue a write.
 */

/** Vendor's own profile. GET /api/vendor/profile */
export const getVendorProfile = async () => {
  const response = await axiosInstance.get("/api/vendor/profile");
  return response.data;
};

/**
 * Products & services derived from the vendor's own bill line items.
 * GET /api/vendor/sold-products?search=&type=&sort=&page=&limit=
 */
export const getSoldProducts = async (params = {}) => {
  const response = await axiosInstance.get("/api/vendor/sold-products", { params });
  return response.data;
};

/**
 * The vendor's own bills.
 * GET /api/vendor/bills?search=&status=&from=&to=&sort=&page=&limit=
 */
export const getVendorBills = async (params = {}) => {
  const response = await axiosInstance.get("/api/vendor/bills", { params });
  return response.data;
};

/** One bill of the vendor (404 if it is not theirs). GET /api/vendor/bills/:id */
export const getVendorBillById = async (id) => {
  const response = await axiosInstance.get(`/api/vendor/bills/${id}`);
  return response.data;
};

/**
 * The vendor's company products, vendor-safe fields only.
 * GET /api/vendor/products?search=&category=&availability=&sort=&page=&limit=
 */
export const getVendorCompanyProducts = async (params = {}) => {
  const response = await axiosInstance.get("/api/vendor/products", { params });
  return response.data;
};

/**
 * The vendor's company services, vendor-safe fields only.
 * GET /api/vendor/services?search=&category=&availability=&sort=&page=&limit=
 */
export const getVendorCompanyServices = async (params = {}) => {
  const response = await axiosInstance.get("/api/vendor/services", { params });
  return response.data;
};
