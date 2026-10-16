import axiosInstance from "./axiosInstance";

/**
 * Customer dashboard API — strictly read-only helpers for the signed-in customer.
 *
 * Every helper below is a GET. Identity (which customer / company) is resolved
 * server-side from the customer access cookie, so nothing is passed to scope the
 * results. There are intentionally no create/update/delete helpers here, so no
 * customer page can ever issue a write.
 */

/** Customer's own profile. GET /api/customer/profile */
export const getCustomerProfile = async () => {
  const response = await axiosInstance.get("/api/customer/profile");
  return response.data;
};

/**
 * Products derived from the customer's own invoice line items.
 * GET /api/customer/purchased-products?search=&sort=&page=&limit=
 */
export const getPurchasedProducts = async (params = {}) => {
  const response = await axiosInstance.get("/api/customer/purchased-products", { params });
  return response.data;
};

/**
 * The customer's own invoices.
 * GET /api/customer/invoices?search=&status=&from=&to=&sort=&page=&limit=
 */
export const getCustomerInvoices = async (params = {}) => {
  const response = await axiosInstance.get("/api/customer/invoices", { params });
  return response.data;
};

/** One invoice of the customer (404 if it is not theirs). GET /api/customer/invoices/:id */
export const getCustomerInvoiceById = async (id) => {
  const response = await axiosInstance.get(`/api/customer/invoices/${id}`);
  return response.data;
};

/**
 * The customer's company products, customer-safe fields only.
 * GET /api/customer/products?search=&category=&availability=&sort=&page=&limit=
 */
export const getCustomerProducts = async (params = {}) => {
  const response = await axiosInstance.get("/api/customer/products", { params });
  return response.data;
};

/**
 * The customer's company services, customer-safe fields only.
 * GET /api/customer/services?search=&category=&availability=&sort=&page=&limit=
 */
export const getCustomerServices = async (params = {}) => {
  const response = await axiosInstance.get("/api/customer/services", { params });
  return response.data;
};
