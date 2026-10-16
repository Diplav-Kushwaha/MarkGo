import axiosInstance from "./axiosInstance";

/**
 * Fetch the sales report for a required date range.
 * GET /admin/reports/sales?from=&to=
 */
export async function getSalesReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/sales", { params });
  return response.data;
}

/**
 * Fetch outstanding receivables and payables.
 * GET /admin/reports/outstanding
 */
export async function getOutstandingReport() {
  const response = await axiosInstance.get("/api/admin/reports/outstanding");
  return response.data;
}

// ---------------------------------------------------------------------------
// The ten reporting endpoints.
//
// Every function below maps to one GET route on /api/admin/reports and every
// one of those routes is company-admin only and read-only — no function here
// posts, patches or deletes anything. The company is taken from the session
// token server-side, so no call below sends one.
//
// `params` is passed straight to axios, which serialises empty strings; the
// backend treats "", "all" and a missing key identically as "no filter", so a
// caller can always send the raw state of its filter controls.
// ---------------------------------------------------------------------------

/** 1. Sales report — invoices in a date range. GET /admin/reports/sales-list */
export async function getSalesListReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/sales-list", { params });
  return response.data;
}

/** 2. Purchases report — bills in a date range. GET /admin/reports/purchases */
export async function getPurchasesReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/purchases", { params });
  return response.data;
}

/** 3. All transactions — every money movement. GET /admin/reports/transactions */
export async function getTransactionsReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/transactions", { params });
  return response.data;
}

/** 4. Profit & loss — overall or by day / month / year. GET /admin/reports/profit-loss */
export async function getProfitLossReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/profit-loss", { params });
  return response.data;
}

/** 5. Product-wise profit & loss. GET /admin/reports/sold-products */
export async function getSoldProductsReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/sold-products", { params });
  return response.data;
}

/** 6. Service-wise profit & loss. GET /admin/reports/sold-services */
export async function getSoldServicesReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/sold-services", { params });
  return response.data;
}

/**
 * The invoices one sold product or service appeared on.
 * GET /admin/reports/sold-items/lines?itemId=...&itemType=...
 */
export async function getSoldItemLines(itemId, itemType, params = {}) {
  if (!itemType) {
    throw new Error("Item type is required to fetch sold item lines.");
  }

  const response = await axiosInstance.get("/api/admin/reports/sold-items/lines", {
    params: { ...params, itemId, itemType },
  });
  return response.data;
}

/** 7. All customers. GET /admin/reports/customers */
export async function getCustomersReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/customers", { params });
  return response.data;
}

/** 8. All vendors. GET /admin/reports/vendors */
export async function getVendorsReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/vendors", { params });
  return response.data;
}

/** 9. All products. GET /admin/reports/products */
export async function getProductsReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/products", { params });
  return response.data;
}

/** 10. All services. GET /admin/reports/services */
export async function getServicesReport(params = {}) {
  const response = await axiosInstance.get("/api/admin/reports/services", { params });
  return response.data;
}
