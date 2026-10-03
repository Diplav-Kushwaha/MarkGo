import axiosInstance from "./axiosInstance";

/**
 * Fetch all invoices for the company with optional filters.
 */
export async function getInvoices(params = {}) {
  const response = await axiosInstance.get("/api/admin/invoices", { params });
  return response.data;
}

/**
 * Fetch invoice financial summary.
 */
export async function getInvoiceSummary() {
  const response = await axiosInstance.get("/api/admin/invoices/summary");
  return response.data;
}

/**
 * Fetch a single invoice by ID with full details.
 */
export async function getInvoiceById(id) {
  const response = await axiosInstance.get(`/api/admin/invoices/${id}`);
  return response.data;
}

/**
 * Create a new invoice.
 */
export async function createInvoice(payload) {
  const response = await axiosInstance.post("/api/admin/invoices", payload);
  return response.data;
}

/**
 * Update an existing DRAFT invoice.
 */
export async function updateInvoice(id, payload) {
  const response = await axiosInstance.put(`/api/admin/invoices/${id}`, payload);
  return response.data;
}

/**
 * Delete a DRAFT invoice.
 */
export async function deleteInvoice(id) {
  const response = await axiosInstance.delete(`/api/admin/invoices/${id}`);
  return response.data;
}

/**
 * Perform a status action (send, cancel, mark_paid, void).
 */
export async function handleInvoiceStatusAction(id, action) {
  const response = await axiosInstance.patch(`/api/admin/invoices/${id}/status`, { action });
  return response.data;
}

/**
 * Record a payment for an invoice.
 */
export async function recordInvoicePayment(id, payload) {
  const response = await axiosInstance.post(`/api/admin/invoices/${id}/payments`, payload);
  return response.data;
}

/**
 * Duplicate an existing invoice.
 */
export async function duplicateInvoice(id) {
  const response = await axiosInstance.post(`/api/admin/invoices/${id}/duplicate`);
  return response.data;
}

/**
 * Trigger invoice email.
 */
export async function emailInvoice(id) {
  const response = await axiosInstance.post(`/api/admin/invoices/${id}/email`);
  return response.data;
}

/**
 * Fetch the invoice's print-ready document.
 *
 * The backend serves a self-contained, print-optimized HTML page (the browser's
 * "Save as PDF" turns it into a PDF). It is fetched through axiosInstance rather
 * than opened as a raw URL so the request carries the auth cookie, and so the
 * caller can print it with the same technique the Bills page uses.
 *
 * GET /api/admin/invoices/:id/pdf
 */
export async function getInvoicePrintHtml(id) {
  const response = await axiosInstance.get(`/api/admin/invoices/${id}/pdf`, {
    responseType: "text",
  });
  return response.data;
}
